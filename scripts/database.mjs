import {DatabaseSync} from 'node:sqlite';
import {resolve,dirname} from 'node:path';
import {mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// VACUUM INTO includes committed WAL content and produces one consistent file.
export function copyDatabase(source,target){
 source=resolve(source);target=resolve(target);
 if(!existsSync(source))throw new Error('源数据库不存在');
 if(source===target||existsSync(target))throw new Error('目标已存在，请使用新文件名');
 mkdirSync(dirname(target),{recursive:true});
 const db=new DatabaseSync(source,{readOnly:true});
 try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('数据库完整性检查失败');db.prepare('VACUUM INTO ?').run(target);}finally{db.close();}
 const restored=new DatabaseSync(target,{readOnly:true});
 try{if(restored.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('副本完整性检查失败');}finally{restored.close();}
 return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const restore=process.argv[2]==='restore';
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const source=restore?process.argv[3]:process.env.HUTONG_DB||'data/mvp.sqlite';
 if(!source)throw new Error('用法：npm run db:restore -- 备份路径 [新数据库路径]');
 console.log(copyDatabase(source,process.argv[restore?4:3]||(restore?'data/mvp-restored.sqlite':`data/backups/mvp-${stamp}.sqlite`)));
}
