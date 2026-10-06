import test from 'node:test';
import assert from 'node:assert/strict';
import {createMvpServer} from './app.mjs';
import assigned from '../shared/workstations.json' with {type:'json'};
import geometry from '../shared/interactions.json' with {type:'json'};

test('each member works only at their assigned desk and can rest in another chair',async t=>{
 const app=createMvpServer({dbPath:':memory:'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());
 const root='http://127.0.0.1:'+app.server.address().port;
 for(const [role,home]of Object.entries(assigned.hutong)){
  let cookie='';const api=async(path,input)=>{const response=await fetch(root+'/api/'+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(input)});return {status:response.status,data:await response.json(),response};};
  const account=await api('register',{username:'desk_'+role,password:'test-password-123'});cookie=account.response.headers.get('set-cookie').split(';')[0];await api('claim',{role});await api('control',{client:role});
  const p=[...app.players.values()].find(p=>p.role===role);
  const other=Object.values(assigned.hutong).find(seat=>seat!==home);
  for(const [seat,activity]of [[home,'working'],[other,'sit']]){
   const anchor=geometry.hutong.seats[seat];Object.assign(p,{x:anchor.approach[0],y:anchor.approach[1],seat:null,activity:'walk'});
   const result=await api('presence',{client:role,scene:'hutong',x:anchor.at[0],y:anchor.at[1],facing:0,seat,hand:null,revision:0,activity:'working'});
   assert.equal(result.status,200,role+' can sit');assert.equal(result.data.player.activity,activity,role+' work authorization');assert.equal(result.data.player.seat,seat);
   assert.equal(app.life.journal(p.id).length,0,'routine desk work stays out of look-back');
   const pictured=JSON.parse(app.store.db.prepare('SELECT data FROM experiences WHERE account=? ORDER BY seq DESC LIMIT 1').get(p.id).data).actors.find(actor=>actor.role===role);
   assert.equal(pictured.activity,activity);assert.equal(pictured.seat,seat);assert.equal(pictured.y,anchor.at[1]);
   p.seat=null;p.activity='walk';
  }
 }
});
