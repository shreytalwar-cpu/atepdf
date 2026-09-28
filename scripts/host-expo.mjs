import {cp,mkdir,readdir} from 'node:fs/promises';
// Copy only a generated Expo export; Next serves exactly the same interface.
await mkdir('apps/web/public',{recursive:true});
for(const item of await readdir('apps/universal/dist-web'))await cp(`apps/universal/dist-web/${item}`,`apps/web/public/${item}`,{recursive:true});
