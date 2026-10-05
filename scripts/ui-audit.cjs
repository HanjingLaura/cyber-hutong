async(page)=>{
 const browser=page.context().browser();let p;
 for(const c of browser.contexts())for(const q of c.pages())if(await q.evaluate(()=>window.__socialPreview?.bridge.user?.role==='suki').catch(()=>false))p=q;
 if(!p)throw new Error('Start the isolated eight-browser acceptance session first');
 const rooms=await p.evaluate(()=>window.__auditRooms);
 const interactions=await p.evaluate(()=>window.__auditInteractions);
 const targets=['hutong','rest','hawaii','bathroom','concert','arcade','noodle','gym','dance','perler','rehearsal','elevator','subway','pop'];
 const results=await p.evaluate(()=>window.__uiAudit??[]);
 for(const target of targets.filter(t=>!results.some(r=>r.room===t)||results.find(r=>r.room===t).seatPaths.some(s=>s.operation.seat!==s.id||!s.operation.stood))){
  await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.__socialPreview.bridge.stand();});await p.waitForTimeout(450);
  await p.evaluate(async rooms=>{const b=window.__socialPreview.bridge;document.querySelectorAll('dialog[open]').forEach(d=>d.close());b.stand();const state=b.state(),exit=rooms[state.scene].exit;await fetch('/__fixture',{method:'POST',body:JSON.stringify({role:'suki',x:exit[0]-8,y:exit[1]})});b.apply({...state,x:exit[0]-8,y:exit[1]});document.querySelector('.world').focus();},rooms);
  await p.waitForTimeout(300);await p.keyboard.down('ArrowRight');await p.waitForTimeout(80);await p.keyboard.up('ArrowRight');await p.keyboard.press('e');
  await p.locator('#location-map[open]').waitFor({timeout:2000});await p.locator(`[data-place="${target}"]`).click();await p.locator('[data-enter]').click();
  await p.waitForFunction(target=>window.__socialPreview.bridge.state()?.scene===target&&!document.querySelector('#location-map').open,target,{timeout:16000});
  const report=await p.evaluate(({target,geometry})=>{const b=window.__socialPreview.bridge,s=b.active,exit=b.state();const pass=(x,y)=>{if(typeof s.canWalk==='function')return s.canWalk(x,y);return (x>=69&&x<=603&&y>=166&&y<=221)||(x>=586&&x<=608&&y>=105&&y<=282);};
   const reachable=[];for(const [id,seat]of Object.entries(geometry.seats)){const seen=new Set(),queue=[[Math.round(exit.x/4)*4,Math.round(exit.y/4)*4]];let found=false;
    for(let cursor=0;cursor<queue.length&&cursor<16000;cursor++){const [x,y]=queue[cursor];if(Math.hypot(x-seat.approach[0],y-seat.approach[1])<12){found=true;break;}for(const [dx,dy]of [[4,0],[-4,0],[0,4],[0,-4]]){const nx=x+dx,ny=y+dy,key=nx+':'+ny;if(!seen.has(key)&&pass(nx,ny)){seen.add(key);queue.push([nx,ny]);}}}reachable.push({id,reachable:found});}
   return{room:target,entry:exit,seatPaths:reachable,canvas:[s.game.canvas.width,s.game.canvas.height],errors:window.__acceptanceErrors};},{target,geometry:interactions[target]});
  for(const [id,seat]of Object.entries(interactions[target].seats)){
   await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());window.__socialPreview.bridge.stand();});await p.waitForTimeout(450);
   await p.evaluate(async({id,seat})=>{const b=window.__socialPreview.bridge;document.querySelectorAll('dialog[open]').forEach(d=>d.close());b.stand();await fetch('/__fixture',{method:'POST',body:JSON.stringify({role:'suki',x:seat.approach[0]-10,y:seat.approach[1]})});b.apply({...b.state(),x:seat.approach[0]-10,y:seat.approach[1]});document.querySelector('.world').focus();},{id,seat});
   await p.waitForTimeout(300);await p.keyboard.down('ArrowRight');await p.waitForTimeout(90);await p.keyboard.up('ArrowRight');await p.keyboard.press('e');if(target==='bathroom'&&!await p.evaluate(()=>window.__socialPreview.bridge.state()?.seat)){await p.waitForTimeout(250);await p.keyboard.press('e');}await p.waitForTimeout(180);
   const seated=await p.evaluate(()=>({state:window.__socialPreview.bridge.state(),notice:document.querySelector('#game-notice').textContent}));
   if(await p.locator('dialog[open]').count())await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.waitForTimeout(130);
   report.seatPaths.find(s=>s.id===id).operation={seat:seated.state?.seat,position:[seated.state?.x,seated.state?.y],notice:seated.notice,stood:!(await p.evaluate(()=>window.__socialPreview.bridge.state()?.seat))};
  }
  const index=results.findIndex(r=>r.room===report.room);if(index>=0)results[index]=report;else results.push(report);await p.evaluate(results=>window.__uiAudit=results,results);
 }
 return results.map(r=>({room:r.room,seats:r.seatPaths.length,failures:r.seatPaths.filter(s=>!s.reachable||s.operation.seat!==s.id||!s.operation.stood)}));
}
