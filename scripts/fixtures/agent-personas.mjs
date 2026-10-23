import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {defaultPersonaDirectory} from '../../server/agent-personas.mjs';
import {roles} from '../../server/personas.mjs';

// Disposable backend files; never alters the actual eight persona files.
export async function prepareAgentPersonas(output,overrides={}){
 const directory=join(output,'personas');await mkdir(directory,{recursive:true});
 for(const role of roles){const original=JSON.parse(await readFile(join(defaultPersonaDirectory,role+'.json'),'utf8'));await writeFile(join(directory,role+'.json'),JSON.stringify({...original,...overrides[role],role},null,2));}
 return directory;
}
