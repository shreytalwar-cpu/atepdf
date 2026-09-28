import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
export const appRoot=existsSync(join(process.cwd(),'apps/universal/package.json'))?process.cwd():resolve(process.cwd(),'../..');
