import {createServer} from 'node:http';
import {cp,mkdir,mkdtemp,readFile,readdir,rm,writeFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,extname,resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import Ajv2020 from 'ajv/dist/2020.js';
import {capabilities} from '../../packages/contracts/src/protocol';
import {classify,observe,sha256,summarizeCases,verifyOutput,type Observation} from './matrix-core';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const actions={merge_pdf:'merge',select_pages:'remove',ocr_pdf:'ocr',compress_pdf:'compress'} as const;
type Fixture={id:string;path:string;sha256:string;pageCount:number;pageOrder:unknown;features:string[];visibleMarkers:string[];
  readerExpectation:string;operationExpectations:{operation:string;disposition:string;basis:string;reason:string}[]};
type BrowserResult={admission:{status:string;reason:string|null};error:string|null;stage:string;
  promoted:boolean;originalsUnchanged:boolean;output:string|null;note:string|null;ocr:{page:number;words:string[]}[];
  pageVerification:{version:number;operation:string;status:string}|null};
type Row=Record<string,unknown>&{id:string;fixtureId:string;operation:string;classification:string;reason:string|null};

async function assets(temp:string){
  const engines=join(temp,'engines');await mkdir(engines);
  const pdf=dirname(require.resolve('pdfjs-dist/package.json'));
  await cp(join(pdf,'build/pdf.worker.min.mjs'),join(engines,'pdf.worker.min.mjs'));
  for(const folder of ['standard_fonts','cmaps','wasm'])await cp(join(pdf,folder),join(engines,folder),{recursive:true});
  const tess=dirname(require.resolve('tesseract.js/package.json'));
  await cp(join(tess,'dist/worker.min.js'),join(engines,'tesseract-worker.min.js'));
  const core=dirname(createRequire(join(tess,'package.json')).resolve('tesseract.js-core/package.json'));
  for(const file of await readdir(core))if(/\.wasm(\.js)?$/.test(file))await cp(join(core,file),join(engines,file));
  const eng=dirname(require.resolve('@tesseract.js-data/eng/package.json'));
  await cp(join(eng,'4.0.0/eng.traineddata.gz'),join(engines,'eng.traineddata.gz'));
  for(const [entry,outfile] of [
    ['tests/compatibility/browser-entry.ts',join(temp,'bundle.js')],
    ['packages/web-pdf/src/pdf.worker.ts',join(engines,'atepdf.worker.js')],
  ])await build({absWorkingDir:root,entryPoints:[entry],bundle:true,format:'esm',platform:'browser',
    target:'es2022',outfile,logLevel:'silent'});
}

export async function runMatrix(outputDir:string){
  // Never overwrite historical evidence. Reruns choose a fresh destination.
  try{await stat(outputDir);throw new Error('Choose a new, nonexistent output directory.');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const manifestBytes=await readFile(join(root,'tests/fixtures/corpus/manifest.json'));
  const fixtures=(JSON.parse(manifestBytes.toString()).fixtures as Fixture[]);
  const registry=JSON.parse(await readFile(join(root,'packages/contracts/schemas/operation-registry.json'),'utf8'));
  const inputs=new Map<string,Uint8Array>();
  for(const fixture of fixtures){
    const bytes=new Uint8Array(await readFile(join(root,fixture.path)));
    if(sha256(bytes)!==fixture.sha256)throw new Error('Fixture hash mismatch: '+fixture.id);
    inputs.set(fixture.id,bytes);
  }
  const temp=await mkdtemp(join(tmpdir(),'atepdf-shr46-'));
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  const server=createServer(async(request,response)=>{
    try{
      const path=new URL(request.url??'/','http://localhost').pathname;
      if(path==='/'){response.setHeader('Content-Type','text/html');response.end('<script type="module" src="/bundle.js"></script>');return;}
      if(path.startsWith('/fixtures/')){
        const bytes=inputs.get(path.slice('/fixtures/'.length));
        if(!bytes){response.writeHead(404).end();return;}
        response.setHeader('Content-Type','application/pdf');response.end(bytes);return;
      }
      const file=resolve(temp,'.'+path);
      if(!file.startsWith(temp+'/')){response.writeHead(403).end();return;}
      response.setHeader('Content-Type',extname(file)==='.js'||extname(file)==='.mjs'?'text/javascript':
        extname(file)==='.wasm'?'application/wasm':'application/octet-stream');
      response.end(await readFile(file));
    }catch{response.writeHead(404).end();}
  });
  try{
    await assets(temp);
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const address=server.address();if(!address||typeof address==='string')throw new Error('Test listener unavailable.');
    const origin='http://127.0.0.1:'+address.port;
    browser=await chromium.launch({channel:'chrome',headless:true});
    const context=await browser.newContext();
    const blockedRequests:string[]=[];
    await context.route('**/*',route=>{
      if(new URL(route.request().url()).origin===origin)return route.continue();
      blockedRequests.push(route.request().url());return route.abort();
    });
    const page=await context.newPage();await page.goto(origin);
    await page.waitForFunction(()=>typeof (window as unknown as {runMatrixCase?:unknown}).runMatrixCase==='function');
    const rows:Row[]=[],observations=new Map<string,Observation>();
    const renders:{source:string;path:string}[]=[];
    const observation=async(id:string)=>{
      if(!observations.has(id))observations.set(id,await observe(inputs.get(id)!));
      return observations.get(id)!;
    };
    for(const fixture of fixtures)for(const operation of capabilities){
      const id=fixture.id+'/'+operation;
      const partner=fixture.id==='ordinary-appendix'?'ordinary-brief':'ordinary-appendix';
      const ids=operation==='merge_pdf'?[fixture.id,partner]:[fixture.id];
      const row:Row={
        id,fixtureId:fixture.id,operation,classification:'NOT_RUN',reason:null,
        environment:'chrome-web-worker',executor:'JobController + packages/web-pdf',
        reader:'PDF.js 6.3.289; supplementary pdf-lib structural comparison',
        input:ids.map(id=>{const f=fixtures.find(item=>item.id===id)!;return {
          fixtureId:id,sha256:f.sha256,pageCount:f.pageCount,pageOrder:f.pageOrder,features:f.features};}),
        parameters:operation==='select_pages'?{removePhysicalPages:[2]}:operation==='compress_pdf'?{preset:'balanced'}:
          operation==='ocr_pdf'?{languages:['eng'],existingText:'preserve'}:{ordering:'as_provided'},
        policy:fixture.operationExpectations.filter(item=>item.operation===operation),
        admission:{status:'not_run',reason:null},execution:{status:'not_run',reason:null,pageIdentity:{status:'not_run',required:['merge_pdf','select_pages'].includes(operation)}},
        result:null,independent:{reader:'not_run',structural:'not_run',issues:[]},
        visual:{status:'NOT_RUN',reason:'Post-transform rendering/OCR placement remains SHR-48.',
          inputReference:'tests/fixtures/corpus/README.md'},
        originalUnchanged:true,noPartialPromotion:true,evidenceLocation:'matrix.json#'+id,
      };
      if(operation==='select_pages'&&fixture.pageCount<2){
        row.reason='No valid page-removal scenario: the one-page input must retain a page.';
        rows.push(row);continue;
      }
      if(fixture.readerExpectation==='damaged'){
        const child=spawnSync(process.execPath,['--max-old-space-size=128','--import','tsx',
          join(root,'tests/compatibility/damaged-child.mts'),join(root,fixture.path)],
          {cwd:root,encoding:'utf8',timeout:5000,maxBuffer:4096});
        const answer=child.status===0&&!child.error?JSON.parse(child.stdout):{
          admitted:false,error:'Bounded admission child failed: '+(child.error?.message??child.signal??child.stderr.slice(0,200))};
        const error=answer.admitted?'Damaged input was admitted; no transform attempted.':answer.error;
        row.environment='node-bounded-admission';row.executor='preflight only; 128 MiB, 5 seconds';
        row.admission={status:answer.admitted?'admitted':'rejected',reason:error};
        row.reason=error;row.classification=classify({implemented:true,ran:true,error,
          noPromotion:true,originalUnchanged:true});rows.push(row);continue;
      }
      let got:BrowserResult;
      try{
        got=await page.evaluate(async({ids,action})=>
          (window as unknown as {runMatrixCase:(ids:string[],action:string)=>Promise<BrowserResult>})
            .runMatrixCase(ids,action),{ids,action:actions[operation]});
      }catch(error){
        row.reason='Browser harness execution failed: '+(error instanceof Error?error.message:String(error));
        row.classification='FAILED';rows.push(row);continue;
      }
      row.admission=got.admission;
      const requiresPageIdentity=operation==='merge_pdf'||operation==='select_pages';
      const gatePassed=got.pageVerification?.version===1&&got.pageVerification.operation===operation&&got.pageVerification.status==='passed';
      row.execution={status:got.admission.status==='rejected'?'not_run':got.error?'failed':'completed',
        reason:got.error,note:got.note,recognizedPages:got.ocr,pageIdentity:{required:requiresPageIdentity,
          status:!requiresPageIdentity?'not_required':got.admission.status==='rejected'?'not_run':gatePassed?'passed':'failed',receipt:got.pageVerification}};
      row.originalUnchanged=got.originalsUnchanged&&ids.every(id=>sha256(inputs.get(id)!)===fixtures.find(f=>f.id===id)!.sha256);
      row.noPartialPromotion=!got.error||!got.promoted;
      if(got.error){
        row.reason=got.error;row.classification=classify({implemented:true,ran:true,error:got.error,
          noPromotion:!got.promoted,originalUnchanged:row.originalUnchanged===true});
      }else if(!got.output){
        row.reason='The controller completed without a PDF result.';row.classification='FAILED';
      }else{
        const bytes=new Uint8Array(Buffer.from(got.output,'base64'));
        const artifact=join(temp,id.replace('/','--')+'.pdf');
        await writeFile(artifact,bytes);
        // Read the actual saved copy back; the verifier never trusts an engine success receipt.
        const saved=new Uint8Array(await readFile(artifact));
        const source=await Promise.all(ids.map(observation));
        let expected:Observation={pages:source.flatMap(x=>x.pages),annotations:source.flatMap(x=>x.annotations)};
        if(operation==='select_pages')expected={
          pages:expected.pages.filter((_,i)=>i!==1),annotations:expected.annotations.filter((_,i)=>i!==1)};
        const words=new Map(got.ocr.map(item=>[item.page,item.words.join(' ')]));
        const verification=await verifyOutput(saved,expected,{addedWords:words,allowImageReencode:operation==='compress_pdf'});
        if(operation==='ocr_pdf'&&got.ocr.length&&verification.actual){
          const scannedIndex=fixture.id==='hybrid-note'?1:0;
          if(['raster-note','hybrid-note','image-heavy'].includes(fixture.id)&&
            !verification.actual.pages[scannedIndex].text.replace(/\s+/g,'').toLowerCase().includes('paperworkmadesimple')){
            verification.issues.push('Known synthetic scan phrase was not recognized.');
            verification.structural='failed';
          }
        }
        if(operation==='compress_pdf'&&saved.length>inputs.get(fixture.id)!.length){
          verification.issues.push('Compression returned a larger result instead of retaining the input.');
          verification.structural='failed';
        }
        // Declared/encoded mismatch has no approved decoder-preservation oracle yet.
        const partial=fixture.features.includes('encoded_dimension_mismatch');
        row.classification=classify({implemented:true,ran:true,verification,partialCoverage:partial,
          originalUnchanged:row.originalUnchanged===true});
        row.reason=verification.issues.join('; ')|| (partial?'Encoded-versus-declared raster dimensions remain unverified.':null);
        if(requiresPageIdentity&&!gatePassed){row.classification='FAILED';row.reason='Required production page verification receipt is missing.';}
        row.independent={...verification,actual:verification.actual};
        row.expected=expected;
        row.result={sha256:sha256(saved),sizeBytes:saved.length,pageCount:verification.actual?.pages.length??null,
          savedAndReopened:verification.reader==='passed',retained:false,note:got.note};
        const representative=id==='ordinary-brief/merge_pdf'?[1]:id==='geometry-font/merge_pdf'?[1,3]:
          id==='hybrid-note/ocr_pdf'?[2]:id==='image-heavy/compress_pdf'?[1]:[];
        if(process.env.ATEPDF_MATRIX_RENDERER&&verification.reader==='passed'){
          const references=[];
          for(const pageNumber of representative){
            const prefix=join(temp,id.replace('/','--')+'-page-'+pageNumber);
            const render=spawnSync(process.env.ATEPDF_MATRIX_RENDERER,
              ['-f',String(pageNumber),'-l',String(pageNumber),'-scale-to','1024','-singlefile','-png',artifact,prefix],
              {encoding:'utf8',timeout:15000,maxBuffer:4096});
            if(render.status!==0||render.error)throw new Error('Representative render failed: '+id);
            const path='renders/'+id.replace('/','--')+'-page-'+pageNumber+'.png';
            references.push({path,sha256:sha256(await readFile(prefix+'.png')),page:pageNumber,maximumDimension:1024});
            renders.push({source:prefix+'.png',path});
          }
          if(references.length)row.visual={...(row.visual as object),renderReferences:references,
            reason:'Representative output rendered by Poppler; no appearance comparison or OCR-placement acceptance performed (SHR-48).'};
        }
      }
      rows.push(row);console.log(id+': '+row.classification);
    }
    for(const fixture of fixtures)for(const expectation of fixture.operationExpectations){
      if(expectation.operation==='import'||capabilities.includes(expectation.operation as typeof capabilities[number]))continue;
      rows.push({id:fixture.id+'/'+expectation.operation,fixtureId:fixture.id,operation:expectation.operation,
        environment:'none',executor:null,reader:null,input:[{fixtureId:fixture.id,sha256:fixture.sha256,pageCount:fixture.pageCount,
          pageOrder:fixture.pageOrder,features:fixture.features}],parameters:null,policy:[expectation],
        admission:{status:'not_run',reason:null},execution:{status:'not_run',reason:null,pageIdentity:{required:false,status:'not_run'}},result:null,
        independent:{reader:'not_run',structural:'not_run',issues:[]},visual:{status:'NOT_RUN',reason:'No executor.'},
        originalUnchanged:true,noPartialPromotion:true,evidenceLocation:'matrix.json#'+fixture.id+'/'+expectation.operation,
        classification:'NOT_IMPLEMENTED',reason:'No active executor on current main.'});
    }
    for(const fixture of fixtures)if(sha256(await readFile(join(root,fixture.path)))!==fixture.sha256)
      throw new Error('Original fixture changed: '+fixture.id);
    if(blockedRequests.length)throw new Error('The harness attempted external network access.');
    const summaryCounts=summarizeCases(rows),counts=summaryCounts.counts;
    const runtimeFiles=['packages/contracts/src/protocol.ts','packages/core/src/job-controller.ts',
      'packages/core/src/local-file-store.ts','packages/web-pdf/src/engine.ts','packages/web-pdf/src/content-admission.ts',
      'packages/web-pdf/src/client.ts','packages/web-pdf/src/page-structure.ts','packages/core/src/page-verification.ts','packages/web-pdf/src/pdf.worker.ts','package.json',
      'tests/compatibility/matrix-core.ts','tests/compatibility/browser-entry.ts',
      'tests/compatibility/run.mts','tests/compatibility/damaged-child.mts','tests/compatibility/matrix.schema.v2.json'];
    const sourceHashes=Object.fromEntries(await Promise.all(runtimeFiles.map(async path=>[path,sha256(await readFile(join(root,path)))])));
    const matrix={schemaVersion:2,source:{commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      files:sourceHashes,manifestSha256:sha256(manifestBytes)},environment:{node:process.version,
      browser:browser.version(),platform:process.platform,architecture:process.arch,nativeApp:'NOT_RUN',
      externalRequests:blockedRequests.length},operationInventory:registry.operations.map((op:{id:string})=>({
        operation:op.id,status:capabilities.includes(op.id as typeof capabilities[number])?'IMPLEMENTED':'NOT_IMPLEMENTED'})),
      summary:summaryCounts,cases:rows};
    const validate=new Ajv2020({allErrors:true}).compile(JSON.parse(await readFile(join(root,'tests/compatibility/matrix.schema.v2.json'),'utf8')));
    if(!validate(matrix))throw new Error('Matrix schema failed: '+JSON.stringify(validate.errors));
    await mkdir(outputDir,{recursive:true});
    if(renders.length)await mkdir(join(outputDir,'renders'));
    for(const render of renders)await cp(render.source,join(outputDir,render.path),{errorOnExist:true,force:false});
    await writeFile(join(outputDir,'matrix.json'),JSON.stringify(matrix,null,2)+'\n',{flag:'wx'});
    const summary='# SHR-46 observed browser compatibility matrix\n\nSource: '+matrix.source.commit+
      '. All outputs were saved temporarily, independently reopened, hashed, and removed after inspection.\n\n'+
      'Executed '+matrix.summary.executed+' of '+matrix.summary.total+' recorded scenarios. Counts: '+
      Object.entries(counts).map(([key,value])=>key+' '+value).join('; ')+'. Rejections and failures remain in the executed denominator.\n\n'+
      '| Fixture | Operation | Classification | Reason / note |\n| --- | --- | --- | --- |\n'+
      rows.map(row=>'| '+[row.fixtureId,row.operation,row.classification,(row.reason??'Checked properties passed; visual verification NOT_RUN.').replaceAll('|','/').replaceAll('\n',' ')].join(' | ')+' |').join('\n')+
      '\n\nBrowser service/helper evidence only. Actual Mac-app acceptance and post-transform visual/OCR-placement verification were NOT_RUN.\n';
    await writeFile(join(outputDir,'summary.md'),summary,{flag:'wx'});
    console.log(JSON.stringify(matrix.summary));return matrix;
  }finally{
    await browser?.close();await new Promise<void>(resolve=>server.close(()=>resolve()));
    await rm(temp,{recursive:true,force:true});
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const index=process.argv.indexOf('--output-dir');
  if(index<0||!process.argv[index+1])throw new Error('Usage: node --import tsx tests/compatibility/run.mts --output-dir NEW_DIRECTORY');
  await runMatrix(resolve(process.argv[index+1]));
}
