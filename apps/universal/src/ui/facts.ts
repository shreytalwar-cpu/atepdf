import {formatSize, pageCount, type Entry} from '../workspace/useWorkspace';

export const facts = (pages: number, bytes: number) => `${pageCount(pages)} · ${formatSize(bytes)}`;
/** SHR-42: a result's stable number among this workspace's results (unchanged by Undo). */
export const resultNumber = (w: {store: {list: {ref: string; original: boolean}[]}}, ref: string) => w.store.list.filter(file => !file.original).findIndex(file => file.ref === ref) + 1;
export const isProposal = (entry: Entry) => !!entry.choice && ['compress', 'chain', 'execute'].includes(entry.choice);
/** The acknowledgement of Stop while local work drains; the activity row already says “Stopping…”. */
export const isStopAcknowledgement = (entry: Entry) => entry.role === 'assistant' && entry.text.startsWith('Cancellation requested.');
