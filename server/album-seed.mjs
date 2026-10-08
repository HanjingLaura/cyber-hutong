import {createDecipheriv} from 'node:crypto';
import {fail} from './store.mjs';

// Public Git history contains ciphertext only. The deployment holds the private key.
export function decodeAlbumSeed(photo,key=process.env.ALBUM_SEED_KEY){
  if(typeof key!=='string'||!/^[a-f0-9]{64}$/i.test(key))fail(503,'照片正在准备，请稍后再试');
  try{
    const decoder=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(photo.iv,'base64'));
    decoder.setAuthTag(Buffer.from(photo.tag,'base64'));
    return Buffer.concat([decoder.update(Buffer.from(photo.image,'base64')),decoder.final()]);
  }catch{fail(503,'照片正在准备，请稍后再试');}
}
