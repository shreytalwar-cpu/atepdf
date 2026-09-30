// Synthetic local catalog harness: run on unmodified main before implementation,
// then on this branch. No PDFs or metadata are sent to a provider.
import {LocalFileStore} from '../../../packages/core/src/local-file-store';
import {JobController} from '../../../packages/core/src/job-controller';
import {validateRequest} from '../../../packages/planner/src/request';
const store=new LocalFileStore(),controller=new JobController(store,{worker:async()=>{throw Error('Not executed');},inspect:async()=>{throw Error('Not executed');},recognize:async()=>[]});
const inspection={pages:[{text:'LOCAL SYNTHETIC CANARY',width:612,height:792,rotation:0}]};
const samples=[];
for(let n=1;n<=121;n++){
  const original=n<=2;
  store.commit([await store.prepare(new Uint8Array([n]),original?`synthetic-${n}.pdf`:'atepdf-result.pdf',inspection,original,`${original?'file':'out'}_${n.toString(16).padStart(32,'0')}`)],store.revision);
  if([40,41,100,101,121].includes(n)){
    let request;
    try{
      request=controller.request('Compress the current result');const payload=validateRequest(request);
      samples.push({retained:n,projected:request.files.length,selection:request.selectionRefs.length,originals:request.originalRefs.length,focus:request.focusedResultRef,status:'accepted',payloadBytes:Buffer.byteLength(JSON.stringify(payload)),payload});
    }catch(error){samples.push({retained:n,projected:request?.files.length,stage:request?'planner-validation':'shared-request-construction',error:(error as Error).message});}
  }
}
console.log(JSON.stringify(samples,null,2));
