export const AGENT_DELAY_MS=5*60_000;
export const BROWSER_TIMEOUT_MS=60_000;

// Browser acknowledgments, rather than server SSE writes, establish liveness.
// Each tab has its own row; generation checks protect a reconnect from an old close.
export function createAgentPresence(db,{now=Date.now,onLive=()=>{}}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS browser_presence(
  account TEXT NOT NULL,client TEXT NOT NULL,generation TEXT NOT NULL,
  at INTEGER NOT NULL,closed_at INTEGER,PRIMARY KEY(account,client));`);
 const rows=id=>db.prepare('SELECT * FROM browser_presence WHERE account=?').all(id);
 const known=id=>rows(id).length>0;
 const online=(id,at=now())=>rows(id).some(r=>r.closed_at===null&&at-r.at<BROWSER_TIMEOUT_MS);
 const offlineSince=id=>{
  const entries=rows(id);
  if(entries.length)return Math.max(...entries.map(r=>r.closed_at===null?r.at+BROWSER_TIMEOUT_MS:Math.min(r.closed_at,r.at+BROWSER_TIMEOUT_MS)));
  const legacy=db.prepare('SELECT at FROM live_presence WHERE account=?').get(id);
  return legacy?legacy.at+BROWSER_TIMEOUT_MS:(db.prepare('SELECT claimed_at FROM role_claims WHERE account=?').get(id)?.claimed_at??0);
 };
 const takeoverAt=id=>offlineSince(id)+AGENT_DELAY_MS;
 return{known,online,offlineSince,takeoverAt,
  canDrive(id,at=now()){return !online(id,at)&&at>=takeoverAt(id);},
  connect(id,client,generation){db.prepare('INSERT INTO browser_presence VALUES(?,?,?,?,NULL) ON CONFLICT(account,client) DO UPDATE SET generation=excluded.generation,at=excluded.at,closed_at=NULL').run(id,client,generation,now());onLive(id);},
  heartbeat(id,client){const live=db.prepare('UPDATE browser_presence SET at=? WHERE account=? AND client=? AND closed_at IS NULL').run(now(),id,client).changes>0;if(live)onLive(id);return live;},
  disconnect(id,client,generation){return db.prepare('UPDATE browser_presence SET closed_at=? WHERE account=? AND client=? AND generation=? AND closed_at IS NULL').run(now(),id,client,generation).changes>0;},
 };
}
