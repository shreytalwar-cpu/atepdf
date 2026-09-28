import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {appRoot} from '@/services/local-paths';
export const dynamic='force-dynamic';
export async function GET(){return new Response(await readFile(join(appRoot,'apps/universal/dist-web/index.html'),'utf8'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});}
