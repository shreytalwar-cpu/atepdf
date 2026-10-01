import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Platform, AppState} from 'react-native';
import {releaseInputFiles} from '@core/job-controller';
import type {Artifact} from '@core/local-file-store';
import {createController, chooseFiles, sampleFiles, save, ocrAvailable} from '../platform/runtime';
import {OutboundDenied} from '@planner/outbound/gate';
import {LOCAL_ONLY_MESSAGE} from '@planner/client';
import {privateInstruction,hasRejectedSecretDraft,safeOrdinaryText,SECRET_CHAT_WARNING} from '@planner/privacy';
import {isClarificationAnswer,pendingFromResponse,withPendingClarification} from '@planner/clarification';
import {plannerStatus,requestPlan,plannerAvailable,type PlannerStatus} from '../platform/planner';
import {validateEnvelope,type PendingClarification,type Request as PlannerRequest,type Envelope, type Step} from '@contracts/protocol';
import {WorkspaceVault,WorkspaceExpiredError,StaleSaveError,blockedMessages,expiredMessage,savedArtifacts,CLEANUP_INCOMPLETE,type WorkspaceSnapshot} from '@core/workspace-vault';
import {CheckpointScheduler,WorkspaceSession} from '@core/workspace-checkpoints';
import {DAY_MS,RETENTION_DAYS,type PersistedEntry,type RetentionMode} from '@core/workspace-checkpoint';
import {createWorkspaceBackend,workspaceClock} from '../platform/workspace';
import {temporaryFiles} from '../platform/temporary';
import type {RetentionImpact,StorageView} from '../components/PrivacyStorage';

// The workspace: the only owner of conversation, controller, persistence, planning and
// retention state. Presentation reads it and calls its commands; it never re-derives them.
export const formatSize = (n: number) => n < 1_000_000 ? `${(n / 1000).toFixed(1)} kB` : `${(n / 1_000_000).toFixed(2)} MB`;
export const pageCount = (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`;
const localResultTitle = (type: Action, page = 2) => type === 'merge' ? 'Merged PDF' : type === 'remove' ? `PDF with page ${page} removed` : type === 'ocr' ? 'Searchable PDF' : type === 'chain' ? 'Searchable, optimised PDF' : 'Optimised PDF';
const localCapabilityHelp = `I can merge PDFs, remove pages${ocrAvailable ? ', make scanned English PDFs searchable' : ''}, and compress supported images inside a PDF. Add PDFs, then use a quick action or type “remove page 2”. Type “undo” to restore the previous result.\n\nThese tasks work without an AI connection. Connecting AI is optional for more flexible requests.`;
function plannedResultTitle(steps: Step[]) {
  const last = steps.at(-1);
  if (last?.operation === 'select_pages') {
    const pages = (last.params.pages as {indices: number[]}).indices;
    return pages.length === 1 ? localResultTitle('remove', pages[0]) : `PDF with ${pages.length} pages removed`;
  }
  if (steps.some(step => step.operation === 'ocr_pdf') && last?.operation === 'compress_pdf') return localResultTitle('chain');
  return localResultTitle(last?.operation === 'merge_pdf' ? 'merge' : last?.operation === 'ocr_pdf' ? 'ocr' : 'compress');
}
export type Action = 'merge' | 'ocr' | 'remove' | 'compress' | 'chain';
const visibleConnection=(status:PlannerStatus)=>{const {token:_,...visible}=status;return visible;};
export type DisplayArtifact=Pick<Artifact,'ref'|'pageCount'|'sizeBytes'|'note'>;
// request/envelope/revision are live, in-memory only. The durable projection
// (toPersisted) keeps display facts and never these executable fields.
// notice and choices are display-only (never persisted): how an outcome is presented, and the
// options a clarification offered. The text itself is unchanged and remains the record.
export type Notice = 'error' | 'cancelled' | 'refused' | 'unavailable';
export type Entry = {id: number; role: 'user' | 'assistant'; text: string; notice?: Notice; choices?: string[]; restored?: true; files?: {name: string; size: number; ref?:string}[]; artifact?: DisplayArtifact; resultTitle?: string; choice?: 'compress' | 'chain' | 'clear' | 'execute' | 'connect' | 'native-link' | 'native-pair' | 'connection-help'; revision?: number; request?:PlannerRequest; envelope?:Envelope};
const toPersisted=(e:Entry):PersistedEntry=>({id:e.id,role:e.role,text:e.text,...(e.files?{files:e.files.map(f=>({name:f.name,size:f.size}))}:{}),...(e.artifact?{artifactRef:e.artifact.ref}:{}),...(e.resultTitle!==undefined?{resultTitle:e.resultTitle}:{}),...(e.choice?{choice:e.choice}:{})});
// cleanup: shown until removal of old copies is verified, then cleared.
export type WorkspaceNotice={text:string;retry?:boolean;cleanup?:boolean};
const CLEANUP_PENDING_NOTICE='Some of atePDF’s earlier PDF copies couldn’t be removed from this Mac yet. They stay encrypted and can’t be opened in atePDF; it will keep trying to remove them.';
const SAVE_FAILED_NOTICE='atePDF couldn’t save the latest changes on this Mac. Your last saved workspace is kept.';
const SAVE_PAUSED_NOTICE='atePDF couldn’t confirm what was last saved on this Mac, so saving is paused until atePDF opens again.';
// SHR-40 notices. Removal is only stated once verified; otherwise what remains is said.
const UNAVAILABLE_NOTICE='atePDF can’t save your workspace on this Mac right now. This session won’t be restored after you quit.';
const DELETED_STATUS='atePDF’s local data was deleted from this Mac.';
const DELETE_INCOMPLETE='Your workspace was deleted, but some of atePDF’s encrypted files couldn’t be removed from this Mac yet. They can’t be opened in atePDF; it will keep trying to remove them.';
const TEMPORARY_INCOMPLETE='Your workspace was deleted, but some temporary files couldn’t be removed yet. atePDF removes them the next time it opens.';
const QUIT_CLEANUP_INCOMPLETE='atePDF stopped saving this workspace, but some of its earlier encrypted files couldn’t be removed from this Mac yet. They can’t be opened in atePDF; it will keep trying to remove them.';
const expiredNotice=(mode:RetentionMode,cleanupComplete:boolean)=>`${expiredMessage(mode)}${cleanupComplete?'':' Some of its encrypted files couldn’t be removed yet; atePDF will keep trying.'}`;
export function useWorkspace() {
  const [controller] = useState(createController);
  const [backend] = useState(createWorkspaceBackend);
  const vault = useRef<WorkspaceVault|null>(null);
  const [session] = useState(() => new WorkspaceSession(()=>controller.cancel()));
  const resettingRef = useRef(false);
  const [restoring, setRestoring] = useState(backend !== null), [restoredDraft, setRestoredDraft] = useState<string|null>(null);
  const [notice, setNotice] = useState<WorkspaceNotice|null>(null), [durable, setDurable] = useState(false);
  // Retention setting of the open workspace; null while it can't be changed (restoring, blocked, unavailable).
  const [retention, setRetention] = useState<RetentionMode|null>(null);
  const [storage, setStorage] = useState<StorageView>({measuring: false, workspace: null, temporary: null});
  const [deleting, setDeleting] = useState(false), [storageStatus, setStorageStatus] = useState<string|null>(null);
  // A clear, expiry or deletion transaction is running.
  const [resetting, setResettingState] = useState(false);
  const setResetting = (value:boolean) => {resettingRef.current=value;setResettingState(value);};
  // ready: restore finished; only then may chat/draft changes be checkpointed.
  const ready = useRef(backend === null), opened = useRef(false), openingVault = useRef(false);
  const restoredEntries = useRef<Entry[]|null>(null), draftRef = useRef<string|null>(null);
  // Chat/draft checkpoints; suspended for the whole Start over transaction.
  const runChatSave = useRef<() => Promise<void>>(async () => {}), chatSaveFailed = useRef<(error: unknown) => void>(() => {});
  const [checkpoints] = useState(() => new CheckpointScheduler(() => runChatSave.current(), error => chatSaveFailed.current(error)));
  useEffect(() => () => {session.advance();controller.cancel();checkpoints.dispose();}, [checkpoints, session, controller]);
  // Picker, sample and drop completions carry a ticket; emptying the workspace voids it.
  const [clearCount, setClearCount] = useState(0);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot), store = controller.store;
  const [entries, setEntries] = useState<Entry[]>([]), [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null), [privacy, setPrivacy] = useState(false) /* Privacy & Storage pane visible */, [choice, setChoice] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null), [receipts, setReceipts] = useState<Record<string, string>>({});
  const savingLock = useRef(false), receiptEpoch = useRef(0);
  const renderedClearEpoch=receiptEpoch.current;
  const nextId = useRef(0), operation = useRef(false), cancelRequested = useRef(false);
  const [planning,setPlanning]=useState(false),[connection,setConnection]=useState<Omit<PlannerStatus,'token'>|null>(null);
  const plannerAbort=useRef<AbortController|null>(null),connectionAbort=useRef<AbortController|null>(null);
  // The planning request that holds the operation lock and its loading/planning state.
  // Only that request's own finalizer releases them, so a late finalizer can never
  // clear the state of a newer operation.
  const planningOwner=useRef<AbortController|null>(null);
  const connectionToken=useRef<string|null>(null);
  const pendingClarification=useRef<PendingClarification|null>(null);
  // The assistant message holding the open question, for presentation only; the binding
  // itself stays in pendingClarification and is cleared with it.
  const [question,setQuestion]=useState<number|null>(null);
  const clearPending=()=>{pendingClarification.current=null;setQuestion(null);};
  // working: a job, import or planning request is active. busy also covers restore and resets.
  const working = state.busy || loading || planning, busy = working || restoring || resetting;
  const busyRef = useRef(busy); busyRef.current = busy;
  const entriesRef = useRef<Entry[]>(entries); entriesRef.current = entries;
  const currentEntry = entries.findLast(e => e.artifact), current = currentEntry?.id;
  const focus = store.focus ? store.list.find(f => f.ref === store.focus) : null;
  const append = (entry: Omit<Entry, 'id'>) => { const id = ++nextId.current; const artifact=entry.artifact?{ref:entry.artifact.ref,pageCount:entry.artifact.pageCount,sizeBytes:entry.artifact.sizeBytes,note:safeOrdinaryText(entry.artifact.note)}:undefined; setEntries(previous => [...previous, {...entry, text:safeOrdinaryText(entry.text), files:entry.files?.map(file=>({...file,name:safeOrdinaryText(file.name)})), artifact, id}]); return id; };
  const say = (text: string, notice?: Notice) => append({role: 'assistant', text, ...(notice ? {notice} : {})});
  // The controller's own commit saves its new state; chat and draft saves use the
  // last durable store state so they never make an unconfirmed commit durable early.
  const snapshot = (view: ReturnType<typeof controller.durableState> = controller.durableState(true)): WorkspaceSnapshot => ({...view, bytes: ref => store.get(ref).bytes, conversation: entriesRef.current.map(toPersisted), draft: draftRef.current});
  const saveFailed = (v: WorkspaceVault) => setNotice({text: v.blockedReason === 'clock' ? blockedMessages.clock : v.mode === 'blocked' ? SAVE_PAUSED_NOTICE : SAVE_FAILED_NOTICE});
  // A cleanup notice stays until the vault has verified the old copies are gone.
  const cleanupSettled = (v: WorkspaceVault) => { if (!v.cleanupPending) setNotice(previous => previous?.cleanup ? null : previous); };
  runChatSave.current = async () => {
    const v = vault.current, current = session.ticket();
    if (!ready.current || !v || v.mode !== 'writable') return;
    try { await v.save(() => {if(!current()||vault.current!==v)throw new StaleSaveError();return snapshot(controller.durableState(false));},current); if(current())cleanupSettled(v); }
    catch(error) {
      // Expiry is a durable transition even when the triggering writer is stale.
      if(error instanceof WorkspaceExpiredError)chatSaveFailed.current(error);
      else if(!(error instanceof StaleSaveError)&&vault.current===v)saveFailed(v);
    }
  };
  chatSaveFailed.current = error => { if (error instanceof WorkspaceExpiredError) { runExpiry(async () => ({kind: 'expired', mode: error.mode, cleanupComplete: error.cleanupComplete})); return; } if (vault.current) saveFailed(vault.current); };
  const saveChat = () => checkpoints.now();
  const noteDraft = (text: string) => {
    // A composer subscription from before Clear/expiry may briefly publish its
    // old text while the replacement view renders. It owns no new checkpoint.
    if(renderedClearEpoch!==receiptEpoch.current)return;
    const next = text.trim() ? text : null;
    if (next === draftRef.current) return;
    draftRef.current = next;
    // Draft changes are coalesced; only the last completed checkpoint is promised.
    checkpoints.draft();
  };
  // Connect the controller's commits to a writable vault. Called after open and after
  // Delete local data, which can turn a blocked workspace into a new writable one.
  const attach = (v: WorkspaceVault) => {
    if (v.mode !== 'writable') { controller.setDurability(null); setDurable(false); setRetention(null); return; }
    controller.setDurability({save: async signal => {
      const owned=session.ticket();
      try {
        await v.save(() => {if(!owned()||vault.current!==v)throw new StaleSaveError();return snapshot();},()=>owned()&&!signal?.aborted);
        if(owned())cleanupSettled(v);
      } catch(error) {
        if(error instanceof WorkspaceExpiredError)runExpiry(async () => ({kind:'expired',mode:error.mode,cleanupComplete:error.cleanupComplete}));
        else if(!(error instanceof StaleSaveError)&&vault.current===v)saveFailed(v);
        throw error;
      }
    },clear:()=>v.clear()});
    setDurable(true); setRetention(v.retention);
  };
  const openWorkspace = async () => {
    if (!backend) return;
    const current = session.ticket();
    ready.current = false; setRestoring(true); setNotice(null); controller.setDurability(null); setDurable(false); setRetention(null);
    restoredEntries.current = entriesRef.current;
    const v = new WorkspaceVault(backend, {redact: safeOrdinaryText, now: workspaceClock()}); vault.current = v;
    try {
      openingVault.current = true;
      const outcome = await v.open();
      openingVault.current = false;
      if(!current()||vault.current!==v)return;
      if (outcome.kind === 'restored') {
        const saved = outcome.checkpoint;
        try { await controller.restore(savedArtifacts(saved, outcome.bytes), saved.originals, saved.history, saved.revision); }
        catch { if(!current())return; v.block(); setNotice({text: `${blockedMessages['missing-artifact']} New work in this session won’t be saved.`}); return; }
        if(!current())return;
        const restored: Entry[] = saved.conversation.map(p => { const meta = p.artifactRef ? store.get(p.artifactRef).meta : null; return {id: p.id, role: p.role, text: p.text, ...(p.files ? {files: p.files} : {}), ...(meta ? {artifact: {ref: meta.ref, pageCount: meta.pageCount, sizeBytes: meta.sizeBytes, note: safeOrdinaryText(meta.note)}} : {}), ...(p.resultTitle !== undefined ? {resultTitle: p.resultTitle} : {}), ...(p.choice ? {choice: p.choice} : {})}; });
        nextId.current = restored.reduce((n, e) => Math.max(n, e.id), 0);
        // A result committed just before quitting may not have its chat card yet.
        if (store.focus && restored.findLast(e => e.artifact)?.artifact?.ref !== store.focus) { const meta = store.get(store.focus).meta; restored.push({id: ++nextId.current, role: 'assistant', text: 'Here’s your current result.', artifact: {ref: meta.ref, pageCount: meta.pageCount, sizeBytes: meta.sizeBytes, note: safeOrdinaryText(meta.note)}}); }
        restoredEntries.current = restored; entriesRef.current = restored; setEntries(restored);
        draftRef.current = saved.draft?.text ?? null; setRestoredDraft(draftRef.current);
        if (outcome.recoveredPrevious) setNotice({text: 'atePDF couldn’t open your most recent save, so it restored the one before it.'});
        else if (outcome.cleanupPending) setNotice({text: CLEANUP_PENDING_NOTICE, cleanup: true});
      } else if (outcome.kind === 'empty') {
        if (outcome.cleanupPending) setNotice({text: CLEANUP_PENDING_NOTICE, cleanup: true});
      } else if (outcome.kind === 'expired') setNotice({text: expiredNotice(outcome.retention, !outcome.cleanupPending), cleanup: outcome.cleanupPending});
      else if (outcome.kind === 'blocked') setNotice({text: `${blockedMessages[outcome.reason]} New work in this session won’t be saved.`, retry: outcome.retryable});
      else if (outcome.kind === 'unavailable') setNotice({text: UNAVAILABLE_NOTICE});
      attach(v);
    } catch {if(current())setNotice({text:'atePDF can’t open the saved workspace right now. This session won’t be saved.'});}
    finally { openingVault.current = false; if(current()){ready.current = true; setRestoring(false);} }
  };
  useEffect(() => { if (opened.current) return; opened.current = true; void openWorkspace(); }, []);
  useEffect(() => {
    // Every committed chat change is checkpointed; the restored transcript itself is not a new activity.
    if (restoring || entries === restoredEntries.current) return;
    saveChat();
  }, [entries, restoring]);
  const canRetryRestore = !!notice?.retry && !entries.length && !store.list.length;
  const retryRestore = () => { if (canRetryRestore && !busy) void openWorkspace(); };
  // Empty the chat/draft view (and anything built on it) after a durable clear.
  const resetView = () => {
    const empty: Entry[] = []; entriesRef.current = empty; restoredEntries.current = empty; draftRef.current = null;
    // This reset owns the replacement session. Old picker/planner finalizers are
    // correctly stale, so they cannot be responsible for releasing its UI flags.
    planningOwner.current=null;operation.current=false;setLoading(false);setPlanning(false);
    receiptEpoch.current++; connectionToken.current=null; clearPending(); setChoice(null); setPreview(null); setReceipts({}); setEntries(empty); setClearCount(n => n + 1);
  };
  // Stop and join active work: planning is aborted, jobs are cancelled (a commit that
  // is already saving finishes or is withdrawn), and in-flight handlers finish first.
  const stopWork = async () => {
    clearPending(); plannerAbort.current?.abort(); connectionAbort.current?.abort(); controller.cancel();
    await controller.settle();
    for (let i = 0; operation.current && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 25));
  };
  const refreshStorage = async () => {
    const v = vault.current; if (!backend) return;
    setStorage(previous => ({...previous, measuring: true}));
    let workspace: StorageView['workspace'] = null;
    try { workspace = v ? await v.usage() : null; } catch { /* shown as not measurable, never as zero */ }
    setStorage({measuring: false, workspace, temporary: temporaryFiles ? temporaryFiles.usage() : 0});
  };
  // Retention expiry (ADR 0010): at launch (in the vault), on return to atePDF, before
  // an action, and when a save finds the period has passed. The whole workspace goes.
  const expiring = useRef(false), privacyOpen = useRef(false); privacyOpen.current = privacy;
  type Expiry = {kind: 'current'} | {kind: 'clock'} | {kind: 'expired'; mode: RetentionMode; cleanupComplete: boolean};
  function runExpiry(work: () => Promise<Expiry>) {
    if (expiring.current) return; expiring.current = true;
    session.advance();
    void checkpoints.exclusive(async () => {
      setResetting(true);
      try {
        await stopWork();
        const result = await work();
        if (result.kind === 'clock') { setNotice({text: blockedMessages.clock}); setRetention(null); return; }
        if (result.kind !== 'expired') return;
        await controller.clear(async () => ({cleanupComplete: result.cleanupComplete}));
        resetView(); setNotice({text: expiredNotice(result.mode, result.cleanupComplete), cleanup: !result.cleanupComplete});
      } finally { setResetting(false); }
    }).catch(() => { /* another workspace change is running; the next check repeats this */ }).finally(() => { expiring.current = false; if (privacyOpen.current) void refreshStorage(); });
  }
  /** True when the workspace is due (or its age unknown), so the requested action must not run. */
  const expiryDue = () => {
    const v = vault.current;
    if (!v || v.mode !== 'writable' || v.expiryState() === 'current') return false;
    runExpiry(() => v.expireIfDue()); return true;
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active' && !busyRef.current) expiryDue(); });
    return () => subscription.remove();
  }, []);
  const retentionImpact = (mode: RetentionMode): RetentionImpact => {
    const v = vault.current; if (!v || v.mode !== 'writable' || mode === v.retention) return null;
    if (mode === 'quit') return {kind: 'quit'};
    const idle = v.idleIfExpiring(mode, entriesRef.current.length > 0 || store.list.length > 0 || !!draftRef.current);
    return idle === null ? null : {kind: 'expire', days: RETENTION_DAYS[mode] ?? 0, idleDays: Math.floor(idle / DAY_MS)};
  };
  const changeRetention = (mode: RetentionMode) => {
    const v = vault.current; if (!v || v.mode !== 'writable' || busy) return;
    setStorageStatus(null);
    void checkpoints.exclusive(async () => {
      setResetting(true);
      try {
        const change = await v.setRetention(mode, () => snapshot(controller.durableState(false)));
        if (change.kind === 'expired') {
          session.advance();
          await controller.clear(async () => ({cleanupComplete: change.cleanupComplete}));
          resetView(); setNotice({text: expiredNotice(mode, change.cleanupComplete), cleanup: !change.cleanupComplete});
        } else if (change.kind === 'cleared' && !change.cleanupComplete) setNotice({text: QUIT_CLEANUP_INCOMPLETE, cleanup: true});
      } finally { setResetting(false); }
    }).catch(error => { setStorageStatus(error instanceof Error ? error.message : 'atePDF couldn’t change this setting.'); if (v.mode === 'blocked') saveFailed(v); })
      .finally(() => { setRetention(v.mode === 'writable' ? v.retention : null); void refreshStorage(); });
  };
  // Delete local data: every atePDF-managed workspace file and temporary copy. Active
  // work is stopped first; external originals and saved PDFs are never touched.
  const deleteLocalData = () => {
    const v = vault.current; if (!v || deleting || saving || restoring) return;
    setDeleting(true); setStorageStatus(null);
    // From here on, a picker, sample or drop that was still pending is discarded.
    session.advance();
    void checkpoints.exclusive(async () => {
      setResetting(true);
      try {
        await stopWork();
        await controller.clear(() => v.deleteAll());
        if (controller.state.stage === 'failed' && controller.state.error) return {error: controller.state.error, complete: false};
        resetView();
        return {error: null, complete: controller.state.message !== CLEANUP_INCOMPLETE};
      } finally { setResetting(false); }
    }).then(result => {
      if (result.error) { setStorageStatus(result.error); if (v.mode === 'blocked' && v.blockedReason === null) setNotice({text: SAVE_PAUSED_NOTICE}); return; }
      // Only after the workspace is gone: nothing can be reading these copies now.
      const temporaryCleared = temporaryFiles ? temporaryFiles.clear() : true;
      attach(v);
      setNotice(!result.complete ? {text: DELETE_INCOMPLETE, cleanup: true} : v.mode === 'unavailable' ? {text: UNAVAILABLE_NOTICE} : null);
      setStorageStatus(!result.complete ? DELETE_INCOMPLETE : !temporaryCleared ? TEMPORARY_INCOMPLETE : DELETED_STATUS);
    }, error => setStorageStatus(error instanceof Error ? error.message : 'atePDF couldn’t delete its local data.'))
      .finally(() => { setDeleting(false); void refreshStorage(); });
  };
  useEffect(() => { if (privacy) { setStorageStatus(null); void refreshStorage(); } }, [privacy]);
  const showHelp = () => {
    if (busy || expiryDue()) return;
    clearPending();
    setChoice(null);
    append({role:'user',text:'What can I do with my PDFs?'});
    say(localCapabilityHelp);
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fn = (e: BeforeUnloadEvent) => { if (store.list.length || controller.state.busy) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', fn); return () => window.removeEventListener('beforeunload', fn);
  }, [store, controller]);
  const finish = (previous: string | null, text: string, resultTitle: string) => {
    if (controller.state.error) say(controller.state.error, 'error');
    else if (controller.state.stage === 'cancelled') say(controller.state.message, 'cancelled');
    else if (store.focus && store.focus !== previous) append({role: 'assistant', text, artifact: store.get(store.focus).meta, resultTitle});
    else say(controller.state.message || 'No new result was created.');
  };
  // Admission starts before a picker/fetch and is checked again before import.
  // A replacement can invalidate a pending selection without waiting for its OS
  // dialog, while a running local engine must drain before another job starts.
  const invalidate = () => {
    session.advance();clearPending();plannerAbort.current?.abort();connectionAbort.current?.abort();controller.cancel();
    planningOwner.current=null;operation.current=false;setLoading(false);setPlanning(false);setChoice(null);
    if(!ready.current){vault.current?.block();ready.current=true;setRestoring(false);setNotice({text:'Restoring was cancelled. New work in this session won’t be saved. Reopen atePDF to restore or clear the saved workspace.',retry:true});}
  };
  const beginImport = () => {if(!resettingRef.current){cancelRequested.current=false;invalidate();}return session.ticket();};
  const importFiles = async (files: File[], current = beginImport()) => {
    if(!current()||resettingRef.current||expiryDue()||!files.length){await releaseInputFiles(files);if(current()&&!resettingRef.current)setLoading(false);return;}
    setLoading(true);
    await controller.settle();
    if(!current()||resettingRef.current){await releaseInputFiles(files);return;}
    operation.current=true;setChoice(null);clearPending();
    const originalStart=store.originals.length;
    const importedEntry=append({role: 'user', text: `I’ve added ${files.length === 1 ? 'a PDF' : `${files.length} PDFs`}.`, files: files.map(f => ({name: f.name, size: f.size}))});
    try {
      await controller.import(files);
      if(!current())return;
      if (controller.state.error || controller.state.stage === 'cancelled') say(controller.state.error || controller.state.message, controller.state.error ? 'error' : 'cancelled');
      else {setEntries(previous=>previous.map(entry=>entry.id===importedEntry?{...entry,files:entry.files?.map((file,i)=>({...file,ref:store.originals[originalStart+i]}))}:entry));say(`Your ${store.originals.length} ${store.originals.length === 1 ? 'PDF is' : 'PDFs are'} ready. ${store.originals.map(r => store.get(r).meta.pageCount).reduce((a, b) => a + b, 0)} pages in total. ${store.focus ? 'Follow-ups still use the current result; Merge uses all originals in the order added.' : 'What would you like to do? Merge uses the order you added them.'}`);}
    } catch (e) { if(current())say(e instanceof Error ? e.message : 'Files could not be opened.', 'error'); }
    finally { if(current()){operation.current=false;setLoading(false);} }
  };
  const pick = async (sample = false) => {
    if(resettingRef.current||expiryDue())return;
    const current=beginImport(),signal=session.signal;
    setLoading(true);
    try { await importFiles(await (sample ? sampleFiles(signal) : chooseFiles(signal)),current); }
    catch (e) { if(current())say(e instanceof Error ? e.message : 'Files could not be opened.', 'error'); }
    finally { if(current())setLoading(false); }
  };
  const executeLocal = async (type: Action, page = 2, current=session.ticket()) => {
    const previous = store.focus;
    try {
      await controller.quick(type, page);
      if(!current())return;
      finish(previous, type === 'remove' ? `I removed page ${page}. Here’s the new copy.` : type === 'merge' ? 'I merged your PDFs in the order added. Here’s your PDF.' : type === 'ocr' ? 'Your searchable copy is ready.' : type === 'chain' ? 'Your merged, searchable and optimised copy is ready.' : 'I checked the optimised copy. Here’s the result.', localResultTitle(type, page));
    } catch (e) { if(current())say(e instanceof Error ? e.message : 'This action could not finish.', 'error'); }
  };
  const execute = async (type: Action, page = 2) => {
    if (operation.current) return;
    cancelRequested.current=false;operation.current = true;const current=session.ticket();
    try { await executeLocal(type,page); }
    finally { if(current())operation.current = false; }
  };
  const action = (type: Action, text: string, page = 2) => {
    if (busy || operation.current || expiryDue()) return;
    clearPending();
    setChoice(null); append({role: 'user', text});
    // Explicit actions already specify the operation. Compile locally through
    // controller.quick; AI availability and connection checks are irrelevant.
    if ((type === 'compress' || type === 'chain') && store.originals.length) {
      const id = append({role: 'assistant', text: 'I can re-encode supported JPEG images at their original dimensions. Image quality may change; text and vectors stay intact. Some PDFs may not get smaller. Shall I create a new copy for you to preview?', choice: type, revision: store.revision});
      setChoice(id); return;
    }
    void execute(type, page);
  };
  const undoLocal = async (admitted = session.ticket()) => {
    if (!admitted()) return;
    if (!store.canUndo) { say('There’s no earlier result to restore yet. Your original files are unchanged.'); return; }
    invalidate();const current=session.ticket();
    await controller.undo();
    if(!current())return;
    if (controller.state.stage === 'failed' && controller.state.error) { say(controller.state.error, 'error'); return; }
    append({role: 'assistant', text: 'I restored your previous result. Your original files are unchanged.', restored: true, artifact: store.get(store.focus!).meta, resultTitle: entriesRef.current.findLast(entry => entry.artifact?.ref === store.focus)?.resultTitle});
  };
  const undo = () => {
    if (busy || expiryDue()) return;
    clearPending();
    setChoice(null); append({role: 'user', text: 'Undo the last change.'});
    void undoLocal();
  };
  const submit = (draft: string) => {
    if (busy || operation.current || !draft.trim() || expiryDue()) return;
    const text = draft.trim();
    // Reject before either a transcript append or clarification binding.
    if (hasRejectedSecretDraft(text)) { say(SECRET_CHAT_WARNING, 'refused'); return; }
    const command = text.replace(/[.!]$/, '').toLowerCase();
    const pending=pendingClarification.current;
    if(pending){
      clearPending();
      if(/^(?:cancel|never mind|stop)(?:[.!])?$/i.test(text)){setChoice(null);append({role:'user',text});say('Okay. That request is cancelled. Your files are unchanged.','cancelled');return;}
      if(isClarificationAnswer(text,pending)){setChoice(null);append({role:'user',text});void preparePlanning(text,undefined,pending);return;}
    }
    const remove = command.match(/^remove (?:physical )?page (\d+)(?: from (?:the )?(?:merged )?result)?$/);
    if(plannerAvailable){
      const fallback=remove?{type:'remove' as const,page:Number(remove[1])}:['merge', 'merge pdfs', 'merge these pdfs'].includes(command)?{type:'merge' as const,page:2}:['make searchable','ocr'].includes(command)?{type:'ocr' as const,page:2}:command==='compress'?{type:'compress' as const,page:2}:command==='merge, ocr, compress'?{type:'chain' as const,page:2}:command==='undo'?{type:'undo' as const,page:2}:undefined;
      setChoice(null);append({role:'user',text});void preparePlanning(text,fallback);return;
    }
    if (command === 'undo') undo();
    else if (remove) action('remove', text, Number(remove[1]));
    else if (['merge', 'merge pdfs', 'merge these pdfs'].includes(command)) action('merge', text);
    else if (['make searchable', 'ocr'].includes(command)) action('ocr', text);
    else if (command === 'compress') action('compress', text);
    else if (command === 'merge, ocr, compress') action('chain', text);
    else { setChoice(null); append({role:'user',text}); void preparePlanning(text); }
  };
  // Connection status completions are bound to the workspace session they started in
  // (current): one that settles after Start over, expiry or Delete local data changes
  // no chat, connection state or saved workspace. Aborting is only an optimisation.
  const checkConnection=async(signal?:AbortSignal,quiet=false,current=session.ticket())=>{
    if(!plannerAvailable){if(!quiet)say('AI connection is not available on this device yet. Local quick actions still work.');return null;}
    try{const status=await plannerStatus(signal);signal?.throwIfAborted();if(!current())return null;setConnection(visibleConnection(status));return status;}
    catch(error){if(signal?.aborted)throw error;if(!quiet&&current())say('The local planner gateway is unavailable. You can still use the quick actions.');return null;}
  };
  /** True while the session that requested it (current) is still the active one. */
  const refreshConnection=async(current=session.ticket())=>{
    try{const status=visibleConnection(await plannerStatus(session.signal));if(current())setConnection(status);}
    catch{if(current())setConnection(previous=>previous?{...previous,enabled:false}:null);}
    return current();
  };
  // Settings ▸ AI ▸ Developer connection. The check belongs to the workspace session it
  // started in, like every planner call: a reply after Start over, expiry or Delete local
  // data sets no connection state or token. It never writes to the conversation.
  const inspectConnection=async():Promise<'ready'|'unavailable'|'stale'>=>{
    cancelRequested.current=false;
    const current=session.ticket(),abort=new AbortController();connectionAbort.current?.abort();connectionAbort.current=abort;
    let status:PlannerStatus|null;
    try{status=await checkConnection(abort.signal,true,current);}catch{return 'stale';}
    if(!current())return 'stale';
    if(!status)return 'unavailable';
    connectionToken.current=status.token;
    return 'ready';
  };
  const preparePlanning=async(text:string,fallback?:{type:Action|'undo';page:number},continuation?:PendingClarification)=>{
    if(operation.current)return;
    cancelRequested.current=false;
    // One ticket for the whole submission: setup, planning, choices, local execution,
    // errors and the finalizer. After Start over, expiry or Delete local data it is
    // stale, so a late reply (even from a transport that ignores abort) writes no
    // chat, checkpoint or connection state and starts nothing in the new session.
    const current=session.ticket(),abort=new AbortController();
    operation.current=true;setLoading(true);plannerAbort.current=abort;planningOwner.current=abort;
    try{
      // One submission owns setup, planning and local execution. Only the
      // positive metadata projection crosses the planner boundary.
      const instruction=privateInstruction(text,store.list);
      const currentRequest=controller.request(instruction,continuation);
      const request=continuation?withPendingClarification(currentRequest,continuation):currentRequest;
      const status=await checkConnection(abort.signal,true,current);
      abort.signal.throwIfAborted();
      if(!current())return;
      if(!status?.enabled){
        if(fallback){
          setLoading(false);
          if(fallback.type==='undo')await undoLocal(current);
          else if((fallback.type==='compress'||fallback.type==='chain')&&store.originals.length){const id=append({role:'assistant',text:'I can re-encode supported JPEG images at their original dimensions. Image quality may change; text and vectors stay intact. Some PDFs may not get smaller. Shall I create a new copy for you to preview?',choice:fallback.type,revision:store.revision});setChoice(id);}
          else await executeLocal(fallback.type,fallback.page,current);
          return;
        }
        const help = /^(?:what (?:can you|can atepdf|do you) do|(?:how )?can you help(?: me)?|help|what (?:are your|are atepdf.?s) capabilities)[?.!]*$/i.test(text.trim());
        const reason = status?.gateAvailable===false ? LOCAL_ONLY_MESSAGE : !plannerAvailable ? 'AI planning is not available on this device yet.' : status?.connected ? 'AI planning is paused. Open AI connection to check the local request allowance.' : status ? 'OpenAI is not connected yet. You can connect it here for conversational help.' : 'The AI connection is unavailable. Check that atepdf’s local server is running, then try AI connection again.';
        const id = append({role:'assistant', text: help ? localCapabilityHelp : `${reason} You can still use Merge, Compress${ocrAvailable ? ' or Make searchable' : ''}. Your files are unchanged.`, choice:plannerAvailable?'connection-help':undefined, ...(help ? {} : {notice:'unavailable' as const})});
        setChoice(id);return;
      }
      setLoading(false);setPlanning(true);
      const result=await requestPlan(request,status.token,abort.signal,()=>{
        abort.signal.throwIfAborted();
        if(!current()||store.revision!==request.workspaceRevision)throw new Error('Files changed.');
        const latest=controller.request(privateInstruction(text,store.list),continuation);
        latest.requestId=request.requestId;
        return continuation?withPendingClarification(latest,continuation):latest;
      });
      abort.signal.throwIfAborted();
      if(!current())return;
      if(store.revision!==request.workspaceRevision)throw new Error('Your files changed. Please ask again.');
      // requestPlan validates clarification shape and response binding too.
      if(result.planner.status==='undo'){await undoLocal(current);return;}
      if(result.planner.status!=='plan'){
        if(result.planner.status==='clarify')pendingClarification.current=pendingFromResponse(request,result.planner);
        const clarification=result.planner.clarification!;
        const asked=append({role:'assistant',text:clarification.question,...(pendingClarification.current&&clarification.choices?.length?{choices:clarification.choices.map(choice=>safeOrdinaryText(choice))}:{})});
        if(pendingClarification.current)setQuestion(asked);
        return;
      }
      const envelope=validateEnvelope(result,request,store.revision);
      setPlanning(false);
      // Retain a choice only when the requested operation can change image
      // quality. Safe copy-producing plans run after full local validation.
      if(envelope.planner.steps.some(step=>step.operation==='compress_pdf'&&step.params.preset!=='lossless')){
        const id=append({role:'assistant',text:'I can make a smaller copy by optimising its images. Image quality may change; your originals will stay intact.',choice:'execute',revision:store.revision,request,envelope});setChoice(id);return;
      }
      if(plannerAbort.current===abort)plannerAbort.current=null;
      const previous=store.focus;
      await controller.execute(envelope,request);
      if(current())finish(previous,'Your new PDF is ready.',plannedResultTitle(envelope.planner.steps));
    }catch(e){if(current())say(e instanceof OutboundDenied?LOCAL_ONLY_MESSAGE:abort.signal.aborted?'Planning cancelled. No local files changed.':e instanceof Error?e.message:'This request could not finish. Your files are unchanged.',e instanceof OutboundDenied?'refused':abort.signal.aborted?'cancelled':'error');}
    finally{
      if(planningOwner.current===abort){planningOwner.current=null;operation.current=false;setLoading(false);setPlanning(false);}
      if(plannerAbort.current===abort)plannerAbort.current=null;
      // A stale request never checks the connection for the replacement session.
      if(current()&&plannerAvailable)void refreshConnection(current);
    }
  };
  const executePlanned=async(entry:Entry)=>{
    if(!entry.envelope||!entry.request||operation.current)return;
    cancelRequested.current=false;operation.current=true;const previous=store.focus,current=session.ticket();
    try{await controller.execute(entry.envelope,entry.request);if(current())finish(previous,'Your new copy is ready. I checked it with an independent PDF reader.',plannedResultTitle(entry.envelope.planner.steps));}
    catch(e){if(current())say(e instanceof Error?e.message:'The plan could not be applied.','error');}finally{if(current())operation.current=false;}
  };
  const cancel=()=>{
    // Opening the durable head cannot be abandoned into a session-only workspace.
    if(openingVault.current||resettingRef.current||cancelRequested.current)return;
    cancelRequested.current=true;
    const pending=loading||planning||state.busy||restoring,wasPlanning=!!plannerAbort.current;
    invalidate();
    if(!pending)return;
    if(controller.state.busy){
      say('Cancellation requested. Local work may need to finish before it stops; its late reply will be discarded.');
      // This is the acknowledgement of this Cancel, with its own new ticket.
      // Another import/reset makes it stale too; engine replies keep their old ticket.
      const current=session.ticket();
      void controller.settle().then(()=>{if(!current())return;if(controller.state.stage==='cancelled')say(controller.state.message,'cancelled');else if(controller.state.stage==='failed'&&controller.state.error)say(controller.state.error,'error');});
    }else say(wasPlanning?'Planning cancelled. No local files changed.':'Cancelled. Pending replies will be discarded.','cancelled');
  };
  // Start over (the confirmation sheet's destructive action). Clears the conversation and
  // atePDF's copies; the Keep workspace setting stays. Allowed while planning or importing
  // (SHR-44 cancels that work first); the sheet disables it while a local job runs.
  const startOver = () => {
    if (resettingRef.current) return;
    if(!durable&&vault.current?.mode==='blocked'){say('atePDF can’t clear the saved workspace in this session. Reopen atePDF before clearing it; the saved files are still kept.');return;}
    invalidate();setResetting(true);setLoading(true);const current=session.ticket();
    // One transaction: chat/draft checkpoints are suspended (and pending draft
    // saves cancelled) until the clear settles. An empty workspace is shown only
    // once the new epoch is verified, and the chat/draft view is reset before
    // checkpointing resumes, so nothing from before can be saved into it.
    // Session-only (no saved workspace): nothing durable to wait for, so the view
    // is reset immediately, exactly as before persistence existed.
    if (!durable) { void (async()=>{try{await controller.settle();if(!current())return;await controller.clear();if(current())resetView();}finally{if(current()){setResetting(false);setLoading(false);}}})(); return; }
    void checkpoints.exclusive(async () => {
      await controller.settle();if(!current())return null;
      await controller.clear();if(!current())return null;
      if (controller.state.stage === 'failed' && controller.state.error) return controller.state.error;
      resetView();
      const writable = vault.current?.mode === 'writable', incomplete = controller.state.message === CLEANUP_INCOMPLETE;
      setNotice(previous => incomplete ? {text: CLEANUP_INCOMPLETE, cleanup: true} : writable ? null : previous);
      return null;
    }).then(error => { if (!current()||!error) return; say(error); if (vault.current?.mode === 'blocked') setNotice({text: SAVE_PAUSED_NOTICE}); }).finally(()=>{if(current()){setResetting(false);setLoading(false);}});
  };
  const confirm = (entry: Entry) => {
    if (choice !== entry.id || resettingRef.current || (busy && entry.choice !== 'clear')) return;
    setChoice(null);
    if (entry.revision !== store.revision) { say('Your files changed. Please ask again so I use the current files.'); return; }
    if(entry.choice==='connect'||entry.choice==='native-link'||entry.choice==='native-pair'||entry.choice==='connection-help')return;
    if(entry.choice==='execute'){void executePlanned(entry);return;}
    if (entry.choice === 'clear') { startOver(); return; }
    if (entry.choice) { append({role: 'user', text: 'Yes, create an optimised copy.'}); void execute(entry.choice); }
  };
  const keepCurrent = (entry: Entry) => {
    if (choice !== entry.id) return;
    setChoice(null); append({role: 'user', text: 'Keep things as they are.'}); say('Okay. Your current files and result are unchanged.');
  };
  const exportResult = async (artifact: DisplayArtifact) => {
    if (savingLock.current || resettingRef.current) return;
    const epoch=receiptEpoch.current,hash=store.get(artifact.ref).meta.checksum;
    const owns=()=>receiptEpoch.current===epoch&&store.list.some(f=>f.ref===artifact.ref&&f.checksum===hash);
    savingLock.current=true;
    setSaving(artifact.ref);
    try { const outcome = await save(store.get(artifact.ref).bytes); if(!owns())return;setReceipts(previous => ({...previous, [artifact.ref]: outcome === 'shared' ? 'Share sheet closed · check the destination you chose' : outcome === 'saved' ? 'Saved to your device' : outcome === 'cancelled' ? 'Ready · save cancelled' : 'Download started · check your downloads'})); }
    catch (e) { if(owns())setReceipts(previous => ({...previous, [artifact.ref]: safeOrdinaryText(e instanceof Error ? e.message : 'Saving failed. Try again.')})); }
    finally { savingLock.current=false;setSaving(null); }
  };
  // The workspace is kept on disk between launches (not Delete when atePDF quits).
  const keeping = durable && retention !== 'quit';
  const retentionNote = !backend ? null : restoring ? 'Available once your workspace opens.' : durable ? null
    : vault.current?.mode === 'blocked' ? 'This can’t be changed until your saved workspace opens. You can still delete it below.'
    : 'atePDF can’t save your workspace on this Mac right now, so nothing is kept after you quit.';
  // stopping: Stop was requested while a local job is still running; it ends when the controller settles.
  return {controller, state, store, entries, busy, working, loading, stopping: cancelRequested.current && state.busy, current, currentTitle:currentEntry?.resultTitle, focus, preview, setPreview, privacy, setPrivacy,
    choice, setChoice, saving, receipts, append, say, showHelp, importFiles, pick, action, undo, submit, confirm, keepCurrent, startOver, exportResult, planning, connection, connectionToken, inspectConnection, refreshConnection, cancel, clearPending, question,
    session, ticket: () => session.ticket(), restoring, restoredDraft, noteDraft, notice, durable, keeping, canRetryRestore, retryRestore, clearCount,
    capable: backend !== null, retention, retentionNote, retentionImpact, changeRetention, storage, deleteLocalData, deleting, storageStatus};
}
