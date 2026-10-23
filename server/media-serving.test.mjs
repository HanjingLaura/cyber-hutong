import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMvpServer} from './app.mjs';

test('self-hosted MV and audio serve correct media types and byte ranges',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'hutong-media-'));
 const app=createMvpServer({dbPath:':memory:',staticDir:dir});
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 await writeFile(join(dir,'track.m4a'),Buffer.from('0123456789'));
 await writeFile(join(dir,'mv.mp4'),Buffer.from('0123456789'));
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const root='http://127.0.0.1:'+app.server.address().port;
 const audio=await fetch(root+'/track.m4a');assert.equal(audio.headers.get('content-type'),'audio/mp4');
 const video=await fetch(root+'/mv.mp4',{headers:{Range:'bytes=2-5'}});
 assert.equal(video.status,206);assert.equal(video.headers.get('content-type'),'video/mp4');
 assert.equal(video.headers.get('content-range'),'bytes 2-5/10');assert.equal(await video.text(),'2345');
 const suffix=await fetch(root+'/mv.mp4',{headers:{Range:'bytes=-3'}});assert.equal(await suffix.text(),'789');
 assert.equal((await fetch(root+'/mv.mp4',{headers:{Range:'bytes=10-'}})).status,416);
});
