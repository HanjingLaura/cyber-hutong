import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fail} from './store.mjs';
import {decodeAlbumSeed} from './album-seed.mjs';
import rooms from '../shared/rooms.json' with {type:'json'};
import {roles} from './personas.mjs';

export const ALBUM_IMAGE_LIMIT=768*1024;
const CHUNK=64*1024,QUOTA=32*1024*1024;
const initial=JSON.parse(readFileSync(new URL('./album-seeds/photos.json',import.meta.url),'utf8'));

// Accept only the JPEG that the browser's canvas produces; reject active content and oversized dimensions.
export function jpegSize(bytes){
  if(bytes.length<12||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)fail(400,'图片格式不正确，请重新选择照片');
  let at=2,size;
  while(at+4<bytes.length){
    if(bytes[at++]!==255)fail(400,'图片格式不正确');
    while(bytes[at]===255)at++;
    const marker=bytes[at++];
    if(marker===218)break;
    if(marker===217)break;
    if(marker===1||marker>=208&&marker<=215)continue;
    const len=bytes.readUInt16BE(at);
    if(len<2||at+len>bytes.length)fail(400,'图片内容不完整');
    if([192,193,194].includes(marker)){
      if(len<8)fail(400,'图片尺寸不正确');
      size={height:bytes.readUInt16BE(at+3),width:bytes.readUInt16BE(at+5)};
    }
    at+=len;
  }
  if(!size||!size.width||!size.height||size.width>4096||size.height>4096||size.width*size.height>8_000_000)fail(400,'图片尺寸过大，请重新选择照片');
  return size;
}

export function createAlbum(store,{seedImage=decodeAlbumSeed}={}){
  const db=store.db;
  db.exec(`CREATE TABLE IF NOT EXISTS album_photos(
    id TEXT PRIMARY KEY,owner TEXT NOT NULL,scene TEXT NOT NULL,caption TEXT NOT NULL,
    visibility TEXT NOT NULL,recipients TEXT NOT NULL,bytes INTEGER NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,
    created INTEGER NOT NULL,updated INTEGER NOT NULL,request_id TEXT NOT NULL,UNIQUE(owner,request_id));
    CREATE INDEX IF NOT EXISTS album_scene ON album_photos(scene,created);
    CREATE TABLE IF NOT EXISTS album_photo_chunks(photo TEXT NOT NULL,part INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(photo,part));`);
  // No FK on chunks: the replication log publishes chunks before metadata, so partial uploads remain invisible.
  const seeds=new Map(initial.map(p=>[p.id,{...p,created:0,updated:0,owner:null}]));
  const find=id=>seeds.get(id)||db.prepare('SELECT * FROM album_photos WHERE id=?').get(String(id));
  const audience=p=>Array.isArray(p.recipients)?p.recipients:JSON.parse(p.recipients);
  const visible=(p,user)=>p.owner===user.id||p.visibility==='public'||audience(p).includes(p.owner?user.id:user.role);
  const info=(p,user)=>({id:p.id,scene:p.scene,caption:p.caption,width:p.width,height:p.height,created:p.created,updated:p.updated,
    owner:p.owner?store.byId(p.owner)?.role:null,editable:p.owner===user.id,visibility:p.visibility,
    ...(p.owner===user.id?{recipients:audience(p).map(id=>store.byId(id)?.role).filter(Boolean)}:{})});
  const checkScene=scene=>{if(typeof scene!=='string'||!Object.hasOwn(rooms,scene))fail(400,'场景不正确');};
  function share(input,user){
    if(!['public','selected'].includes(input.visibility))fail(400,'请选择照片的可见范围');
    if(!Array.isArray(input.recipients)||input.recipients.length>8||input.recipients.some(role=>!roles.includes(role)))fail(400,'请选择有效的成员');
    const recipients=[...new Set(input.recipients)].filter(role=>role!==user.role).map(role=>{
      const member=store.byRole(role);if(!member)fail(400,'这位成员还没有领取角色');return member.id;
    });
    return {visibility:input.visibility,recipients:JSON.stringify(input.visibility==='public'?[]:recipients)};
  }
  const commit=fn=>{db.exec('SAVEPOINT album_operation');try{const result=fn();db.exec('RELEASE album_operation');return result;}catch(e){db.exec('ROLLBACK TO album_operation; RELEASE album_operation');throw e;}};
  return {
    list(scene,user){
      checkScene(scene);
      const photos=[...db.prepare('SELECT * FROM album_photos WHERE scene=? ORDER BY created DESC,id DESC').all(scene),...seeds.values()].filter(p=>p.scene===scene&&visible(p,user)).map(p=>info(p,user));
      return {scene,photos,members:roles.map(role=>({role,claimed:!!store.byRole(role)}))};
    },
    upload(input,user,scene){
      checkScene(input.scene);if(input.scene!==scene)fail(409,'场景已变化，请重新打开相册再上传');
      if(typeof input.requestId!=='string'||!/^[\w-]{8,80}$/.test(input.requestId))fail(400,'上传编号不正确');
      const existing=db.prepare('SELECT * FROM album_photos WHERE owner=? AND request_id=?').get(user.id,input.requestId);
      if(existing)return info(existing,user);
      const permissions=share(input,user);
      if(typeof input.caption!=='string'||input.caption.length>120)fail(400,'照片说明最多 120 个字');
      if(typeof input.image!=='string'||input.image.length>Math.ceil(ALBUM_IMAGE_LIMIT/3)*4)fail(413,'照片太大，请压缩后重试');
      if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input.image))fail(400,'图片内容不正确');
      const image=Buffer.from(input.image,'base64'),size=jpegSize(image);
      if(image.toString('base64')!==input.image)fail(400,'图片内容不正确');
      if(image.length>ALBUM_IMAGE_LIMIT)fail(413,'照片太大，请压缩后重试');
      const used=db.prepare('SELECT COALESCE(SUM(bytes),0) AS n FROM album_photos WHERE owner=?').get(user.id).n;
      if(used+image.length>QUOTA)fail(409,'相册空间已满，请删除一些自己的照片后重试');
      // The same retry routed to two cold instances must address the same remote row.
      const id='photo-'+createHash('sha256').update(user.id+'\0'+input.requestId).digest('hex');
      const now=Date.now(),photo={id,owner:user.id,scene,caption:input.caption.trim(),...permissions,bytes:image.length,...size,created:now,updated:now,request_id:input.requestId};
      commit(()=>{
        db.prepare('DELETE FROM album_photo_chunks WHERE photo=?').run(photo.id);
        const insert=db.prepare('INSERT INTO album_photo_chunks VALUES(?,?,?)');
        for(let offset=0,part=0;offset<image.length;offset+=CHUNK,part++)insert.run(photo.id,part,image.subarray(offset,offset+CHUNK));
        db.prepare('INSERT INTO album_photos VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(...['id','owner','scene','caption','visibility','recipients','bytes','width','height','created','updated','request_id'].map(key=>photo[key]));
      });
      return info(photo,user);
    },
    image(id,user){
      const photo=find(id);if(!photo||!visible(photo,user))fail(404,'照片不存在或没有查看权限');
      if(!photo.owner)return seedImage(photo);
      const parts=db.prepare('SELECT part,data FROM album_photo_chunks WHERE photo=? ORDER BY part').all(photo.id);
      if(parts.some((p,i)=>p.part!==i))fail(503,'照片正在同步，请稍后重试');
      const image=Buffer.concat(parts.map(p=>Buffer.from(p.data)));
      if(image.length!==photo.bytes)fail(503,'照片正在同步，请稍后重试');
      return image;
    },
    update(input,user){
      const photo=find(input.id);if(!photo)fail(404,'照片不存在');
      if(photo.owner!==user.id)fail(403,'只能修改自己上传的照片');
      if(input.action==='delete'){
        commit(()=>{db.prepare('DELETE FROM album_photos WHERE id=?').run(photo.id);db.prepare('DELETE FROM album_photo_chunks WHERE photo=?').run(photo.id);});return {ok:true};
      }
      if(input.action!=='share')fail(400,'操作不正确');
      const permissions=share(input,user),updated=Math.max(Date.now(),photo.updated+1);
      db.prepare('UPDATE album_photos SET visibility=?,recipients=?,updated=? WHERE id=?').run(permissions.visibility,permissions.recipients,updated,photo.id);
      return {photo:info({...photo,...permissions,updated},user)};
    },
  };
}
