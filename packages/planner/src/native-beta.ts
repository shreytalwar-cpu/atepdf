import {createServer} from 'node:https';
import {isIPv4} from 'node:net';
import {X509Certificate} from 'node:crypto';

export type NativeEndpoint={origin:string;fingerprint:string};
export function isPrivateIPv4(host:string){
  if(!isIPv4(host))return false;
  const [a,b]=host.split('.').map(Number);
  return host==='127.0.0.1'||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
export function validateNativeEndpoint(endpoint:NativeEndpoint){
  const url=new URL(endpoint.origin);
  if(url.origin!==endpoint.origin||url.protocol!=='https:'||!isPrivateIPv4(url.hostname)||!url.port||Number(url.port)<1024||!/^[a-f0-9]{64}$/.test(endpoint.fingerprint))throw new Error('Invalid private beta endpoint.');
  return endpoint;
}
/** The certificate pin is paired out-of-band with the one-use secret. Neither is model input. */
export function packBetaPairing(pairing:{code:string;expiresAt:number},endpoint:NativeEndpoint){
  validateNativeEndpoint(endpoint);
  if(!/^atepdf-local:(3210|3211|3212):[a-f0-9]{64}$/.test(pairing.code))throw new Error('Invalid local pairing.');
  return {code:'atepdf-beta:'+Buffer.from(JSON.stringify({v:1,...endpoint,...pairing})).toString('base64url'),expiresAt:pairing.expiresAt};
}

/** Returns an unbound server. Starting private-network access is an explicit launcher choice. */
export function createNativeBetaServer({gateway,origin,loopbackOrigin,key,cert}:{gateway:(r:Request)=>Promise<Response>;origin:string;loopbackOrigin:string;key:string|Buffer;cert:string|Buffer}){
  const certificate=new X509Certificate(cert),fingerprint=certificate.fingerprint256.replaceAll(':','').toLowerCase();
  validateNativeEndpoint({origin,fingerprint});
  const endpoint=new URL(origin),loopback=new URL(loopbackOrigin);
  if(loopback.origin!==loopbackOrigin||loopback.protocol!=='http:'||loopback.hostname!=='localhost'||!['3210','3211','3212'].includes(loopback.port))throw new Error('Invalid beta loopback origin.');
  if(!certificate.checkIP(endpoint.hostname)||Date.parse(certificate.validTo)<=Date.now()||Date.parse(certificate.validFrom)>Date.now())throw new Error('Certificate does not cover this beta endpoint.');
  const paths=new Map([['/api/native/pair','POST'],['/api/native/planner','POST'],['/api/native/planner/status','GET'],['/api/native/disconnect','POST']]);
  const peers=new Map<string,{start:number;count:number}>();
  const server=createServer({key,cert,minVersion:'TLSv1.2',maxHeaderSize:8192,requestTimeout:10_000,headersTimeout:10_000},async(req,res)=>{
    const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
    const reply=(status:number)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end('{"error":"Private native connection unavailable."}');};
    try{
      // The Wi-Fi listener serves no web app, key setup, pairing issuance, diagnostics or files.
      if(req.headers.host!==endpoint.host||req.headers.origin!==undefined||req.headers['sec-fetch-site']!==undefined||paths.get(req.url??'')!==req.method)return reply(403);
      const address=req.socket.remoteAddress??'',now=Date.now();
      for(const [peer,bucket]of peers)if(now-bucket.start>=60_000)peers.delete(peer);
      let bucket=peers.get(address);
      if(!bucket){if(peers.size>=128)return reply(429);bucket={start:now,count:0};peers.set(address,bucket);}
      if(++bucket.count>120)return reply(429);
      if(Number(req.headers['content-length'])>24_000)return reply(413);
      const parts:Buffer[]=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>24_000)return reply(413);parts.push(Buffer.from(chunk));}
      const headers=new Headers({host:loopback.host});
      // Positive projection: never forward proxy headers, cookies or request identifiers.
      for(const name of ['content-type','authorization']){const value=req.headers[name];if(typeof value==='string')headers.set(name,value);}
      const request=new Request(loopbackOrigin+req.url,{method:req.method,headers,signal:abort.signal,...(req.method==='POST'?{body:Buffer.concat(parts)}:{})});
      const response=await gateway(request);
      if(!res.destroyed){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());}
    }catch{if(!res.destroyed&&!res.headersSent)reply(400);}
  });
  server.maxConnections=32;server.maxHeadersCount=32;server.keepAliveTimeout=1000;server.setTimeout(40_000,socket=>socket.destroy());
  server.on('tlsClientError',()=>{}); // No raw request/certificate/credential logging.
  return server;
}
