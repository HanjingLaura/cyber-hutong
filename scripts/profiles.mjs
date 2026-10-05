import {readFileSync,existsSync} from 'node:fs';
import {openStore} from '../server/store.mjs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.argv[2])throw new Error('用法：node scripts/profiles.mjs 私有资料.json');
const data=JSON.parse(readFileSync(process.argv[2],'utf8')),inputs=Array.isArray(data)?data:[data],store=openStore(process.env.HUTONG_DB||'data/mvp.sqlite');
try{const rows=inputs.map(p=>{const row=store.byRole(p.role);if(!row)throw new Error(`角色 ${p.role} 尚未领取`);return[row,p];});store.db.exec('BEGIN IMMEDIATE');try{for(const [row,p]of rows)store.profile(row.id,p);store.db.exec('COMMIT');console.log(`已更新 ${rows.length} 位角色的后台资料。`);}catch(e){store.db.exec('ROLLBACK');throw e;}}finally{store.close();}
