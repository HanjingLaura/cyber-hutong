import geometry from '../shared/interactions.json' with {type:'json'};
export const celinePolicy={visitMin:5*60000,visitMax:9*60000,speechMin:90*1000,speechMax:180*1000};
export function celineQuestion(roll){return roll<.60?'Amber 呢？':roll<.85?'Jilly 呢？':'Amber 这孩子。';}
/** One shared visitor, with persisted random choices rather than per-browser rolls. */
export function createCeline(store,{random=Math.random,now=Date.now}={}){
 const db=store.db;db.exec('CREATE TABLE IF NOT EXISTS world_npcs(id TEXT PRIMARY KEY,state TEXT NOT NULL)');
 let state=JSON.parse(db.prepare("SELECT state FROM world_npcs WHERE id='celine'").get()?.state??'null');
 const delay=(min,max)=>min+Math.floor(random()*(max-min));
 const save=()=>db.prepare("INSERT INTO world_npcs VALUES('celine',?) ON CONFLICT(id) DO UPDATE SET state=excluded.state").run(JSON.stringify(state));
 function snapshot(people=[],at=now()){
  let changed=false;
  if(!state||at>=state.nextVisit){const roll=random();state={scene:roll<.4?'hawaii':roll<.8?'hutong':null,started:at,nextVisit:at+delay(celinePolicy.visitMin,celinePolicy.visitMax),nextSpeech:at+delay(45000,90000),question:'',until:0};changed=true;}
  if(state.scene&&at>=state.nextSpeech){state.question=celineQuestion(random());state.until=at+6000;state.nextSpeech=at+delay(celinePolicy.speechMin,celinePolicy.speechMax);changed=true;}
  if(changed)save();
  const phase=((at-state.started)%90000)/1000,home=geometry.hawaii.seats.HL3,occupied=people.some(p=>p.scene==='hawaii'&&p.seat==='HL3');
  let x=480,y=194,facing=0,mode='standing',seat=null;
  if(state.scene==='hawaii'){
   if(phase<55&&!occupied){[x,y]=home.at;seat='HL3';mode='seated';}
   else if(phase>=55&&phase<65||phase>=80){const t=phase<65?(phase-55)/10:(90-phase)/10,vertical=home.approach[1]-194,travel=t*(vertical+36);x=home.approach[0]-Math.max(0,travel-vertical);y=home.approach[1]-Math.min(vertical,travel);mode='walking';facing=travel<vertical?(phase>=80?0:2):(phase>=80?1:3);}
   else{x=home.approach[0]-36;y=194;}
   if(occupied&&phase<55){x=home.approach[0]-36;y=194;}
  }else if(state.scene==='hutong'){
   if(phase>=45&&phase<60){x=480-(phase-45)*4;mode='walking';facing=3;}
   else if(phase>=60&&phase<75)x=420;
   else if(phase>=75){x=420+(phase-75)*4;mode='walking';facing=1;}
  }
  // Waiting visitors do not push a seated member or stand in their exit point.
  if(mode==='walking'&&people.some(p=>p.scene===state.scene&&Math.hypot(p.x-x,p.y-y)<23)){mode='standing';y=194;x=state.scene==='hawaii'?home.approach[0]-36:480;}
  return{...state,id:'celine',x,y,facing,mode,seat,motion:at-state.started,updatedAt:at,question:state.until>at?state.question:''};
 }
 return{snapshot};
}
