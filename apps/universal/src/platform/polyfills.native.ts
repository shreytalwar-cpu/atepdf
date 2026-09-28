import * as Crypto from 'expo-crypto';
// Hermes uses platform randomness and SHA-256; these values never leave the device.
if(!globalThis.crypto?.subtle){
  const crypto={randomUUID:Crypto.randomUUID,getRandomValues:Crypto.getRandomValues,subtle:{digest:(algorithm:string,data:BufferSource)=>{
    if(algorithm!=='SHA-256')throw new Error('Unsupported local digest.');
    return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,data);
  }}};
  Object.defineProperty(globalThis,'crypto',{value:crypto,configurable:true});
}
// Only JSON-compatible metadata is cloned by the shared contracts/store.
if(typeof globalThis.structuredClone!=='function')globalThis.structuredClone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
if(!AbortSignal.prototype.throwIfAborted)AbortSignal.prototype.throwIfAborted=function(){if(this.aborted)throw new Error('Cancelled.');};
