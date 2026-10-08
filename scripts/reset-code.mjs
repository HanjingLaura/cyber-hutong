import {existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {openStore} from '../server/store.mjs';
import {prepareReplica} from '../server/replica.mjs';

// The organizer runs this with trusted database credentials. Codes never enter Git or a public API.
export async function issueResetCode({username,dbPath,client,prefix='hutong_online'}){
 if(typeof username!=='string'||!username.length||username.length>24)throw new Error('请提供账号的准确用户名');
 let directory,replica,store,transaction=false;
 try{
   if(client){
     directory=mkdtempSync(join(tmpdir(),'hutong-reset-code-'));dbPath=join(directory,'game.sqlite');
     replica=await prepareReplica(dbPath,client,{prefix,flushEveryMs:0,log:{warn(){},error(){}}});
   }else if(!dbPath||!existsSync(dbPath))throw new Error('本地数据库不存在，请指定 --db，或使用 --production');
   store=openStore(dbPath);replica?.attach(store.db);
   store.db.exec('SAVEPOINT reset_code_issue');transaction=true;
   const issued=store.createPasswordReset(username);
   if(replica)await replica.flush({allowTransaction:true});
   store.db.exec('RELEASE reset_code_issue');transaction=false;
   return issued;
 }finally{
   if(transaction)store.db.exec('ROLLBACK TO reset_code_issue; RELEASE reset_code_issue');
   await replica?.close();store?.close();
   if(directory){
     const target=resolve(directory),root=resolve(tmpdir())+sep;
     if(!target.startsWith(root)||!basename(target).startsWith('hutong-reset-code-'))throw new Error('临时目录路径无效');
     rmSync(target,{recursive:true,force:true});
   }
 }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let client;
 try{
   const {values}=parseArgs({options:{username:{type:'string'},production:{type:'boolean'},db:{type:'string'},'env-file':{type:'string'},help:{type:'boolean'}}});
   if(values.help){console.log('用法：npm run account:reset-code -- --username laura [--production --env-file .env.production.local | --db data/mvp.sqlite]');}
   else{
     if(values['env-file'])process.loadEnvFile(values['env-file']);
     if(values.production){
       if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw new Error('正式环境需要 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN');
       const {createClient}=await import('@libsql/client');client=createClient({url:process.env.TURSO_DATABASE_URL.trim(),authToken:process.env.TURSO_AUTH_TOKEN.trim()});
     }
     const issued=await issueResetCode({username:values.username,dbPath:values.db||process.env.HUTONG_DB||'data/mvp.sqlite',client,prefix:process.env.HUTONG_TURSO_PREFIX||'hutong_online'});
     const expiry=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(issued.expires);
     console.log(`用户名：${issued.username}\n一次性重置码：${issued.code}\n有效至：${expiry}（北京时间）\n请私下交给账号本人；重新生成会使此前重置码失效。`);
   }
 }catch(e){console.error(e.status?e.message:e.message?.startsWith('本地数据库')||e.message?.startsWith('正式环境')||e.message?.startsWith('请提供')?e.message:'生成重置码失败，请检查参数、数据库连接与权限');process.exitCode=1;}
 finally{client?.close();}
}
