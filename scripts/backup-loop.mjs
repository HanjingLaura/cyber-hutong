import {copyDatabase} from './database.mjs';
import {existsSync} from 'node:fs';
const source=process.env.HUTONG_DB||'data/mvp.sqlite';
function backup(){if(!existsSync(source))return;const stamp=new Date().toISOString().replace(/[:.]/g,'-');try{console.log(JSON.stringify({event:'backup',file:copyDatabase(source,`data/backups/mvp-${stamp}.sqlite`)}));}catch(e){console.error(JSON.stringify({event:'backup-failed',error:e.message}));}}
backup();setInterval(backup,86400000);
