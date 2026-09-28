import {join} from 'node:path';
import {createGateway} from '@planner/gateway';
import {LocalConfig} from '@planner/local-config';
import {appRoot} from './local-paths';
const state=globalThis as typeof globalThis & {atepdfGateway?:ReturnType<typeof createGateway>};
export const gateway=state.atepdfGateway??=createGateway(new LocalConfig(join(appRoot,'.local')));
