import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createCipheriv} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {decodeAlbumSeed} from './album-seed.mjs';

test('initial album ciphertext requires the correct private key and rejects tampering',()=>{
  const jpeg=readFileSync(new URL('./fixtures/album-photo.jpg',import.meta.url)),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const photo={iv:iv.toString('base64'),image:Buffer.concat([cipher.update(jpeg),cipher.final()]).toString('base64'),tag:cipher.getAuthTag().toString('base64')};
  assert.deepEqual(decodeAlbumSeed(photo,key.toString('hex')),jpeg);
  for(const invalid of ['',undefined,'not-a-key',randomBytes(32).toString('hex')])assert.throws(()=>decodeAlbumSeed(photo,invalid),e=>e.status===503);
  assert.throws(()=>decodeAlbumSeed({...photo,tag:Buffer.alloc(16).toString('base64')},key.toString('hex')),e=>e.status===503);
});
