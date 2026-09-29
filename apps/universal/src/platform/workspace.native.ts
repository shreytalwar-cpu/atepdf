import {encodeToBase64,decodeFromBase64} from 'pdf-lib';
import type {WorkspaceVaultBackend} from '@core/workspace-vault';
import NativePDF from '../../modules/atepdf-pdf';

// Mac Catalyst private workspace (ADR 0010). Absent elsewhere, which keeps the
// existing session-only behavior on iPhone, iPad and Android.
export function createWorkspaceBackend():WorkspaceVaultBackend|null{
  const m=NativePDF;
  if(m?.workspaceAvailable!==true||!m.workspaceKeyStatusAsync||!m.workspaceExistsAsync||!m.workspaceWriteSealedAsync||!m.workspaceReadOpenedAsync||!m.workspaceListAsync||!m.workspaceRemoveAsync||!m.workspaceSyncDirectoryAsync||!m.workspaceCleanStagingAsync)return null;
  const {workspaceKeyStatusAsync,workspaceExistsAsync,workspaceWriteSealedAsync,workspaceReadOpenedAsync,workspaceListAsync,workspaceRemoveAsync,workspaceSyncDirectoryAsync,workspaceCleanStagingAsync}=m;
  return {
    keyStatus:create=>workspaceKeyStatusAsync(create),
    exists:name=>workspaceExistsAsync(name),
    writeSealed:(name,plain,associatedData)=>workspaceWriteSealedAsync(name,encodeToBase64(plain),associatedData),
    readOpened:async(name,associatedData)=>{
      const result=await workspaceReadOpenedAsync(name,associatedData);
      if(result.status!=='ok')return {status:result.status};
      if(typeof result.base64!=='string')return {status:'auth'};
      return {status:'ok',bytes:decodeFromBase64(result.base64)};
    },
    list:directory=>workspaceListAsync(directory),
    remove:name=>workspaceRemoveAsync(name),
    syncDirectory:directory=>workspaceSyncDirectoryAsync(directory),
    cleanStaging:()=>workspaceCleanStagingAsync(),
  };
}
