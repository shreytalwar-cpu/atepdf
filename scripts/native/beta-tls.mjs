import {constants} from 'node:fs';
import {lstat,mkdir,open,chmod,readFile,unlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {isIPv4} from 'node:net';
import {X509Certificate,createPrivateKey,createPublicKey,timingSafeEqual} from 'node:crypto';

function privateHost(host){const [a,b]=host.split('.').map(Number);return isIPv4(host)&&(host==='127.0.0.1'||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168));}
async function privateDirectory(path){const info=await lstat(path);if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid()||(info.mode&0o077)!==0)throw new Error('Beta TLS storage must be a private owned directory.');}
async function readPrivate(path){const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const info=await file.stat();if(!info.isFile()||info.uid!==process.getuid()||(info.mode&0o077)!==0||info.size>16_384)throw new Error('Unsafe beta TLS file.');return await file.readFile();}finally{await file.close();}}
export async function loadBetaTLS(directory,host,port=3443){
  if(!privateHost(host)||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose one private IPv4 address and an unprivileged port.');
  await privateDirectory(dirname(directory));await privateDirectory(directory);
  const key=await readPrivate(join(directory,'key.pem')),cert=await readPrivate(join(directory,'cert.pem'));
  const certificates=cert.toString().match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if(certificates?.length!==2)throw new Error('The beta certificate chain is incomplete.');
  const certificate=new X509Certificate(certificates[0]),anchor=new X509Certificate(certificates[1]),publicKey=createPublicKey(createPrivateKey(key)).export({type:'spki',format:'der'}),certKey=certificate.publicKey.export({type:'spki',format:'der'});
  if(certificate.ca||!anchor.ca||!certificate.verify(anchor.publicKey))throw new Error('Invalid beta certificate chain.');
  if(publicKey.length!==certKey.length||!timingSafeEqual(publicKey,certKey)||!certificate.checkIP(host)||Date.parse(certificate.validFrom)>Date.now()||Date.parse(certificate.validTo)<=Date.now()+60_000)throw new Error('Beta certificate is mismatched or expired. Prepare a new, separate TLS directory and pair again.');
  return {key,cert,endpoint:{origin:`https://${host}:${port}`,fingerprint:certificate.fingerprint256.replaceAll(':','').toLowerCase()},expiresAt:certificate.validTo};
}
/** Creates only a new owned directory. Never overwrites credentials or changes system trust. */
export async function prepareBetaTLS(directory,host,port=3443){
  if(!privateHost(host)||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose one private IPv4 address and an unprivileged port.');
  await mkdir(dirname(directory),{mode:0o700,recursive:true});await privateDirectory(dirname(directory));
  try{await mkdir(directory,{mode:0o700});}catch(error){if(error.code==='EEXIST')return loadBetaTLS(directory,host,port);throw error;}
  const config=join(directory,'certificate.cnf');
  const handle=await open(config,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await handle.writeFile(`[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ca_extensions\n[dn]\nCN=atepdf private beta issuer\n[ca_extensions]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n[server_extensions]\nsubjectAltName=IP:${host}\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n`);}finally{await handle.close();}
  // Arguments are structured, never shell-interpolated. OpenSSL emits no key to stdout.
  const run=args=>{if(spawnSync('/usr/bin/openssl',args,{stdio:'ignore',timeout:30_000}).status!==0)throw new Error('Could not prepare beta TLS. The partial directory was preserved for inspection.');};
  run(['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','7','-config',config,'-keyout',join(directory,'ca-key.pem'),'-out',join(directory,'ca.pem')]);
  run(['req','-new','-newkey','rsa:2048','-nodes','-sha256','-config',config,'-subj','/CN=atepdf private beta server','-keyout',join(directory,'key.pem'),'-out',join(directory,'server.csr')]);
  run(['x509','-req','-sha256','-days','7','-in',join(directory,'server.csr'),'-CA',join(directory,'ca.pem'),'-CAkey',join(directory,'ca-key.pem'),'-CAcreateserial','-extfile',config,'-extensions','server_extensions','-out',join(directory,'leaf.pem')]);
  const certificateFile=await open(join(directory,'cert.pem'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await certificateFile.writeFile(Buffer.concat([await readFile(join(directory,'leaf.pem')),await readFile(join(directory,'ca.pem'))]));}finally{await certificateFile.close();}
  await unlink(join(directory,'ca-key.pem')); // The private issuer cannot mint another leaf after setup.
  await chmod(join(directory,'key.pem'),0o600);await chmod(join(directory,'cert.pem'),0o600);
  return loadBetaTLS(directory,host,port);
}
async function main(){
  const [host,directory]=process.argv.slice(2);
  try{if(!host||!directory)throw new Error('Usage: node scripts/native/beta-tls.mjs PRIVATE_IPV4 NEW_PRIVATE_DIRECTORY');const value=await prepareBetaTLS(resolve(directory),host);console.log(JSON.stringify({origin:value.endpoint.origin,fingerprint:value.endpoint.fingerprint,expiresAt:value.expiresAt,serverStarted:false,systemTrustChanged:false},null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void main();
