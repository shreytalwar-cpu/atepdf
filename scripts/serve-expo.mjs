// Local-only server for verifying the exported Expo application, without Next.js.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createGateway} from '../.build/planner/gateway.mjs';
import {LocalConfig} from '../.build/planner/local-config.mjs';
const gateway=createGateway(new LocalConfig(resolve('.local')));
const root=resolve('apps/universal/dist-web'),port=Number(process.env.ATEPDF_PORT||3211);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.pdf':'application/pdf','.wasm':'application/wasm','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml'};
const csp="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";
createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',csp);res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  if(req.url==='/api/planner'||req.url==='/api/planner/status'||req.url==='/api/planner/key'){
    const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
    try {const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,signal:abort.signal,...(req.method==='POST'?{body:req,duplex:'half'}:{})});const response=await gateway(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}catch{res.writeHead(400);res.end('{"error":"Invalid local request"}');}return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('Not found');const bytes=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'localhost',()=>console.log(`atepdf Expo local preview: http://localhost:${port}`));
