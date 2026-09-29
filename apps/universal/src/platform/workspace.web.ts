import type {WorkspaceVaultBackend} from '@core/workspace-vault';
// The browser keeps its existing in-tab session. Durable storage is Mac-only (ADR 0010).
// Browser tests may install an in-memory stand-in and a fake clock before the page
// loads; nothing in the web app creates one.
type TestHook={backend?:WorkspaceVaultBackend;now?:()=>Date};
const hook=()=>(globalThis as {__ATEPDF_TEST_WORKSPACE__?:TestHook}).__ATEPDF_TEST_WORKSPACE__;
export const createWorkspaceBackend=():WorkspaceVaultBackend|null=>hook()?.backend??null;
export const workspaceClock=():(()=>Date)|undefined=>hook()?.now;
