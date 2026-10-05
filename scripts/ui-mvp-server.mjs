import { createMvpServer } from '../server/app.mjs';
const app=createMvpServer({dbPath:'output/ui-acceptance.sqlite'});
// Loopback-only fixture positions for browser acceptance; never in the real app.
const handler=app.server.listeners('request')[0];app.server.removeListener('request',handler);
app.server.on('request',async(req,res)=>{if(req.url==='/__fixture'&&req.method==='POST'){let raw='';for await(const part of req)raw+=part;const input=JSON.parse(raw);const p=[...app.players.values()].find(p=>p.role===input.role);if(p)Object.assign(p,{x:input.x,y:input.y,scene:input.scene??p.scene,seat:input.seat??null,at:Date.now()-3000});res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:!!p}));}else handler(req,res);});
app.server.listen(8789,'127.0.0.1',()=>console.log('isolated UI smoke server :8789'));
process.on('SIGTERM',()=>{app.close();process.exit(0);});
