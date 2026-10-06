import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes,randomUUID,createHash,scrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { roles,distillProfile } from './personas.mjs';
import { TaskPool } from './pool.mjs';
const derive=promisify(scrypt),pool=new TaskPool();
export const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const digest=value=>createHash('sha256').update(value).digest('hex');
async function passwordHash(password,salt=randomBytes(16).toString('hex')){const key=await derive(password,salt,64);return salt+':'+key.toString('hex');}
async function passwordMatches(password,stored){
  const [salt,expected]=String(stored||'').split(':');
  if(!salt||!expected||expected.length%2)return false;
  try{
    const got=(await passwordHash(password,salt)).split(':')[1];
    const a=Buffer.from(got,'hex'),b=Buffer.from(expected,'hex');
    if(a.length!==b.length)return false;
    return timingSafeEqual(a,b);
  }catch{return false;}
}
export function openStore(path){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT UNIQUE,profile TEXT NOT NULL DEFAULT '{}',hand TEXT,revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,sender TEXT NOT NULL,recipient TEXT,scene TEXT NOT NULL,body TEXT NOT NULL,at INTEGER NOT NULL,npc INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS messages_thread ON messages(sender,recipient,seq);
    CREATE INDEX IF NOT EXISTS messages_room ON messages(scene,recipient,seq);
    CREATE TABLE IF NOT EXISTS operations(id TEXT NOT NULL,account TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(id,account));
    CREATE TABLE IF NOT EXISTS controllers(account TEXT PRIMARY KEY,client TEXT NOT NULL,at INTEGER NOT NULL);`);
  if(!db.prepare('PRAGMA table_info(accounts)').all().some(c=>c.name==='seasoning'))db.exec("ALTER TABLE accounts ADD COLUMN seasoning TEXT NOT NULL DEFAULT '[]'");
  if(!db.prepare('PRAGMA table_info(accounts)').all().some(c=>c.name==='progress_revision'))db.exec("ALTER TABLE accounts ADD COLUMN progress_revision INTEGER NOT NULL DEFAULT 0");
  const byId=id=>db.prepare('SELECT * FROM accounts WHERE id=?').get(id);
  const byRole=role=>db.prepare('SELECT * FROM accounts WHERE role=?').get(role);
  const publicAccount=row=>row?{id:row.id,username:row.username,role:row.role,hand:row.hand,revision:row.revision,progressVersion:row.progress_revision,seasoning:JSON.parse(row.seasoning||'[]')}:null;
  const createSession=id=>{const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),id,Date.now()+7*86400000);return token;};
  return {db,byId,byRole,publicAccount,
    async register(username,password,role=null){
      if(typeof username!=='string'||!/^[-\p{L}\p{N}_]{2,24}$/u.test(username))fail(400,'用户名需为 2–24 个字母、数字、汉字或下划线');
      if(typeof password!=='string'||password.length<10||password.length>128)fail(400,'密码需为 10–128 位');
      if(role!==null&&!roles.includes(role))fail(400,'请选择有效角色');
      return pool.run(async()=>{const hash=await passwordHash(password),id=randomUUID();if(role&&byRole(role))fail(409,'这个角色已注册，请使用已有账号登录');if(db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n>=8)fail(409,'八个内测账号已创建');try{db.prepare('INSERT INTO accounts(id,username,password,role,profile) VALUES(?,?,?,?,?)').run(id,username,hash,role,JSON.stringify(role?distillProfile({},role):{}));}catch(e){if(e.code?.includes('SQLITE'))fail(409,'用户名或角色已被使用');throw e;}return {token:createSession(id),user:publicAccount(byId(id))};});
    },
    async login(username,password){
      if(typeof username!=='string'||typeof password!=='string'||password.length>128)fail(401,'用户名或密码不正确');
      return pool.run(async()=>{const row=db.prepare('SELECT * FROM accounts WHERE username=?').get(username);const fallback='00000000000000000000000000000000:'+Buffer.alloc(64).toString('hex');const matches=await passwordMatches(password,row?.password||fallback);if(!row||!matches)fail(401,'用户名或密码不正确');return {token:createSession(row.id),user:publicAccount(row)};});
    },
    session(token){if(!token)return null;const row=db.prepare('SELECT a.* FROM sessions s JOIN accounts a ON s.account=a.id WHERE s.token=? AND s.expires>?').get(digest(token),Date.now());return publicAccount(row);},
    logout(token){if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));},
    roster(){return roles.map(role=>({role,claimed:!!byRole(role)}));},
    claim(id,role){if(!roles.includes(role))fail(400,'请选择有效角色');if(byId(id).role)fail(409,'你已经领取了角色');try{db.prepare('UPDATE accounts SET role=?,profile=? WHERE id=? AND role IS NULL').run(role,JSON.stringify(distillProfile({},role)),id);}catch(e){if(e.code?.includes('SQLITE'))fail(409,'这个角色刚被别人领取了');throw e;}return publicAccount(byId(id));},
    profile(id,input){const row=byId(id);if(!row.role)fail(409,'请先领取角色');const profile=distillProfile(input,row.role);db.prepare('UPDATE accounts SET profile=? WHERE id=?').run(JSON.stringify(profile),id);return publicAccount(byId(id));},
    hand(id,hand,revision){const row=byId(id);if(row.revision!==revision)return publicAccount(row);if(row.hand!==hand)db.prepare("UPDATE accounts SET hand=?,seasoning='[]',revision=revision+1 WHERE id=? AND revision=?").run(hand,id,revision);return publicAccount(byId(id));},
    message(sender,recipient,scene,body,id,npc=false){if(typeof id!=='string'||id.length>120)fail(400,'消息编号无效');const existing=db.prepare('SELECT * FROM messages WHERE id=?').get(sender+':'+id);if(existing)return existing;db.prepare('INSERT INTO messages(id,sender,recipient,scene,body,at,npc) VALUES(?,?,?,?,?,?,?)').run(sender+':'+id,sender,recipient,scene,body,Date.now(),Number(npc));return db.prepare('SELECT * FROM messages WHERE id=?').get(sender+':'+id);},
    history(role,peer,scene){return peer?db.prepare('SELECT * FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY seq DESC LIMIT 60').all(role,peer,peer,role).reverse():db.prepare('SELECT * FROM messages WHERE scene=? AND recipient IS NULL ORDER BY seq DESC LIMIT 60').all(scene).reverse();},
    gift(id,toRole,requestId,revision){
      const replay=db.prepare('SELECT result FROM operations WHERE account=? AND id=?').get(id,requestId);if(replay)return JSON.parse(replay.result);
      db.exec('BEGIN IMMEDIATE');try{
        const from=byId(id),to=byRole(toRole);if(!from.hand||from.revision!==revision)fail(409,'手中物品已改变，请重试');if(!to||to.id===id)fail(400,'请选择另一位玩家');if(to.hand)fail(409,'对方手中已有物品');
        db.prepare("UPDATE accounts SET hand=NULL,seasoning='[]',revision=revision+1 WHERE id=?").run(id);db.prepare('UPDATE accounts SET hand=?,seasoning=?,revision=revision+1 WHERE id=?').run(from.hand,from.seasoning,to.id);
        const result={item:from.hand,from:from.role,to:toRole};db.prepare('INSERT INTO operations VALUES(?,?,?)').run(requestId,id,JSON.stringify(result));db.exec('COMMIT');return result;
      }catch(e){db.exec('ROLLBACK');throw e;}
    },close(){db.close();}
  };
}
