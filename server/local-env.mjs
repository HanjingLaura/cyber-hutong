import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Existing process variables win, then .env.local, then .env defaults.
export function loadLocalEnvironment(cwd=process.cwd()){
 for(const name of ['.env.local','.env']){const path=resolve(cwd,name);if(existsSync(path))process.loadEnvFile(path);}
}
