// Activity model (SHR-106 polish): what the activity row says and how its progress bar behaves,
// derived only from controller, planner and engine state. Pure, so it is unit tested directly.
// No invented progress: a bar is determinate only when a real count exists (files checked,
// completed steps of a multi-step request, or the engine's own "n of N" report).
import type {JobState} from '@core/job-controller';
import type {Operation} from '@contracts/protocol';

export type ActivityMode = 'determinate' | 'indeterminate' | 'verifying' | 'cancelling';
export type Activity = {
  label: string; detail?: string; mode: ActivityMode; value?: number; count?: string;
  /** Where the work happens, shown beside the label: local PDF work, or the AI request. */
  where: 'local' | 'ai' | null;
};
export type ActivityInput = {
  state: Pick<JobState, 'busy' | 'stage' | 'message' | 'progress'>;
  planning: boolean; loading: boolean; stopping: boolean;
  /** The system file dialog is open: the person is choosing, atePDF isn't working. */
  choosing?: boolean;
  /** The AI request has taken longer than the slow threshold. */
  slow: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Operation-aware labels. Units come from the accepted recipe (files, pages) or stored inspections. */
const list = (items: number[]) => items.length === 1 ? String(items[0]) : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
export function stepLabel(operation: Operation | undefined, units?: number, pages?: number[]) {
  switch (operation) {
    case 'merge_pdf': return units ? `Combining ${plural(units, 'PDF')}…` : 'Combining PDFs…';
    case 'select_pages': return pages?.length && pages.length <= 4 ? `Removing ${pages.length === 1 ? 'page' : 'pages'} ${list(pages)}…` : units ? `Removing ${plural(units, 'page')}…` : 'Removing pages…';
    case 'ocr_pdf': return units === 0 ? 'Checking for scanned pages…' : units ? `Making ${plural(units, 'scanned page')} searchable…` : 'Making scanned pages searchable…';
    case 'compress_pdf': return 'Compressing images…';
    default: return 'Working…';
  }
}

/** The engine's own count within a step ("Merged 1 of 2 files"). */
export function engineCount(message: string): {done: number; total: number} | null {
  const match = /^Merged (\d+) of (\d+) files$/.exec(message);
  if (!match) return null;
  const done = Number(match[1]), total = Number(match[2]);
  return total > 0 && done <= total ? {done, total} : null;
}

/** Engine reports worth showing, in the product's words. Anything else stays out of the row. */
export function engineDetail(message: string): string | undefined {
  let match: RegExpExecArray | null;
  if ((match = /^Recognised page (\d+) of (\d+)$/.exec(message))) return `Page ${match[1]} of ${match[2]} recognised`;
  if ((match = /^Recognising English · (\d+)%$/.exec(message))) return `Recognising text · ${match[1]}%`;
  if (message === 'Loading on-device English recognition') return 'Loading text recognition';
  if (message === 'Recognising English on your device') return 'Recognising text on this Mac';
  if ((match = /^Added searchable text to page (\d+)$/.exec(message))) return `Adding text to page ${match[1]}`;
  return undefined;
}

export function describeActivity({state, planning, loading, stopping, slow, choosing = false}: ActivityInput): Activity | null {
  if (stopping) return {label: 'Cancelling…', detail: 'Finishing the current step safely.', mode: 'cancelling', where: 'local'};
  if (state.busy) {
    const progress = state.progress;
    if (progress?.kind === 'import') {
      const total = progress.steps.length, done = progress.steps.filter(step => step.status === 'complete').length;
      const label = `Adding ${total === 1 ? 'your PDF' : `${total} PDFs`}…`;
      return total > 1 ? {label, mode: 'determinate', value: done / total, count: `${done} of ${total} checked`, where: 'local'} : {label, mode: 'indeterminate', where: 'local'};
    }
    // The result passed its checks and is being kept (the durable commit).
    if (state.stage === 'complete') return {label: 'Finishing…', mode: 'indeterminate', where: 'local'};
    const index = progress?.currentStep ?? null;
    const step = index === null ? undefined : progress!.steps[index];
    const total = progress?.steps.length ?? 0;
    const verifying = state.stage === 'validating' || step?.status === 'validating';
    const active = !verifying && step?.status === 'active';
    const counted = active ? engineCount(state.message) : null;
    const multi = total > 1 && index !== null;
    // Completed steps, plus the engine's count within the current step when it reports one.
    const value = verifying ? undefined : multi ? (index! + (counted ? counted.done / counted.total : 0)) / total : counted ? counted.done / counted.total : undefined;
    return {
      label: verifying ? 'Checking the result…' : stepLabel(step?.operation, step?.units, step?.pages),
      detail: active ? engineDetail(state.message) : undefined,
      mode: verifying ? 'verifying' : value === undefined ? 'indeterminate' : 'determinate',
      ...(value === undefined ? {} : {value}),
      count: multi ? `Step ${index! + 1} of ${total}` : counted ? `${counted.done} of ${counted.total}` : undefined,
      where: 'local',
    };
  }
  // While the instruction is with atePDF AI, the row says so (SHR-36): that is a transfer, not a stage.
  if (planning) return {label: slow ? 'Still working…' : 'Working…', detail: slow ? 'Waiting for atePDF AI. You can stop; nothing has changed.' : 'Sending your instruction to atePDF AI.', mode: 'indeterminate', where: 'ai'};
  if (loading && !choosing) return {label: 'Getting ready…', mode: 'indeterminate', where: null};
  return null;
}

// Presence (owner direction, INTERACTION_MODEL 5–7): fast work stays fast. A reply is never
// held for an animation or a minimum duration. The only wait is for the reply that lands a tick
// after the work ends (at most REPLY_GRACE), so no frame shows neither the activity nor its
// outcome. The activity row itself appears only once work has run for SHOW_AFTER, so
// near-instant work resolves straight into its artifact.
export const SHOW_AFTER = 150, REPLY_GRACE = 180;
export type Outcome = 'complete' | 'failed' | 'cancelled' | 'other';
export type Presence = {phase: 'idle' | 'active' | 'settling'; shownAt: number; lastCount: number; cut: number; until: number; outcome: Outcome | null};
export const IDLE: Presence = {phase: 'idle', shownAt: 0, lastCount: 0, cut: 0, until: 0, outcome: null};
export type PresenceInput = {
  working: boolean; count: number; now: number;
  /** Outcome of the newest entry after the held position (null when there is none yet). */
  newest: Outcome | null;
  /** A new request was made after the held position. */
  userAfter: boolean;
};

export function stepPresence(previous: Presence, {working, count, now, newest, userAfter}: PresenceInput): Presence {
  if (working) return previous.phase === 'active' ? {...previous, lastCount: count}
    // Work that resumes while waiting for a reply (a request that was interpreted, then runs) is one activity.
    : {phase: 'active', shownAt: previous.phase === 'settling' ? previous.shownAt : now, lastCount: count, cut: 0, until: 0, outcome: null};
  if (previous.phase === 'active') {
    // The reply is already here (or the work was stopped): show it now.
    if (newest !== null) return IDLE;
    return {phase: 'settling', shownAt: previous.shownAt, lastCount: previous.lastCount, cut: previous.lastCount, until: now + REPLY_GRACE, outcome: null};
  }
  if (previous.phase === 'settling') {
    // The reply landed, a new request was made, the conversation was reset, or the grace ran out.
    if (newest !== null || userAfter || count < previous.cut || now >= previous.until) return IDLE;
    return previous;
  }
  return previous;
}

/** How a reply ends a task, for presence: a result, a failure or refusal, a cancellation, or other text. */
export function outcomeOf(entry: {artifact?: unknown; notice?: string} | undefined): Outcome | null {
  if (!entry) return null;
  if (entry.artifact) return 'complete';
  if (entry.notice === 'cancelled') return 'cancelled';
  if (entry.notice === 'error' || entry.notice === 'refused') return 'failed';
  return 'other';
}
