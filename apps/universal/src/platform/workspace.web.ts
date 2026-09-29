import type {WorkspaceVaultBackend} from '@core/workspace-vault';
// The browser keeps its existing in-tab session. Durable storage is Mac-only (ADR 0010).
export const createWorkspaceBackend=():WorkspaceVaultBackend|null=>null;
