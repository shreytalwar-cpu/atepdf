// Owned ephemeral static server. Never constructs the developer gateway or reads .local.
import {createServer} from 'node:http';
import {readFile,realpath,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {extname,resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
const root=await realpath('apps/universal/dist-web');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.wasm':'application/wasm','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml','.gz':'application/gzip'};
// Build an immutable exact URL allowlist before listening. Request data never
// becomes a filesystem path, including encoded traversal or symlink escapes.
const assets=new Map();
async function index(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);
    if(entry.isSymbolicLink())throw new Error('Export assets must not contain symlinks');
    if(entry.isDirectory())await index(path);
    else if(entry.isFile())assets.set('/'+path.slice(root.length+1).split(sep).join('/'),
      {bytes:await readFile(path),type:mime[extname(path)]||'application/octet-stream'});
  }
}
await index(root);
const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'");
  if(req.url.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');res.writeHead(403);res.end('{"error":"Verification server: hosted AI disabled"}');return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const asset=assets.get(pathname==='/'?'/index.html':pathname);
    if(!asset)throw new Error('Not found');
    res.setHeader('Content-Type',asset.type);res.end(req.method==='HEAD'?undefined:asset.bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}`;
try{
  for(const path of ['/%2e%2e%2fpackage.json','/%2e%2e%2f.node-version','/.local/openai-key','/api/planner']){
    const response=await fetch(url+path,{method:path==='/api/planner'?'POST':'GET'});
    if(response.status!==(path==='/api/planner'?403:404))throw new Error('Static allowlist/disabled API refusal failed');
  }
  const browser=await chromium.launch();const version=browser.version();await browser.close();
  const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','scripts/verification/playwright.config.mts'],
    {stdio:'inherit',env:{...process.env,ATEPDF_BASE_URL:url,ATEPDF_VERIFICATION_URL:url}});
  const terminate=()=>child.kill('SIGTERM');
  process.once('SIGTERM',terminate);process.once('SIGINT',terminate);
  const [status,signal]=await once(child,'exit');
  process.removeListener('SIGTERM',terminate);process.removeListener('SIGINT',terminate);
  await mkdir('.build',{recursive:true});
  const html=await readFile(resolve(root,'index.html'),'utf8');
  const scripts={};
  for(const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)){
    const path=await realpath(resolve(root,'.'+match[1]));
    if(!path.startsWith(root+sep))throw new Error('Export script outside root');
    scripts[match[1]]=createHash('sha256').update(await readFile(path)).digest('hex');
  }
  await writeFile('.build/verification-browser.json',JSON.stringify({url,browser:version,scripts,exportHtmlSha256:
    createHash('sha256').update(await readFile(resolve(root,'index.html'))).digest('hex'),status,signal,
    report:JSON.parse(await readFile('.build/browser-results.json','utf8'))},null,2)+'\n');
  if(status!==0||signal)throw new Error(`Browser checks failed: ${status} ${signal||''}`);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
