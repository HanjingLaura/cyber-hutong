import test from 'node:test';
import assert from 'node:assert/strict';
import {ktvSongs,songDuration,emptyKtvPlayer,changeKtvPlayer,ktvPlayback,ktvBeatResult} from '../shared/ktv.mjs';

test('requested MV library uses full video lengths and credits',()=>{
 assert.deepEqual(ktvSongs.map(s=>s.id),['power','beauty-and-a-beat','lover-boy-88','eyes-nose-lips']);
 for(const song of ktvSongs){assert.match(song.videoId,/^[\w-]{11}$/);assert.ok(song.artist);assert.ok(songDuration(song)>120000);}
});
test('MV queue stays on the first song past 32 beats, pauses, then advances at its full length',()=>{
 const song=ktvSongs[0],duration=songDuration(song);
 let state=changeKtvPlayer(emptyKtvPlayer(),'queue',song.id,1000);
 state=changeKtvPlayer(state,'queue',ktvSongs[1].id,1000);
 assert.equal(ktvPlayback(state,31000).song.id,song.id);
 state=changeKtvPlayer(state,'play',undefined,31000);
 assert.equal(ktvPlayback(state,101000).elapsed,30000);
 state=changeKtvPlayer(state,'play',undefined,101000);
 assert.equal(ktvPlayback(state,101000+duration-30000).song.id,ktvSongs[1].id);
 assert.equal(ktvBeatResult(64*60000/song.bpm,song.bpm).points,100);
});
