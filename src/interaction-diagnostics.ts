type Entry={at:number;stage:string;[key:string]:string|number|boolean|null};
const entries:Entry[]=[];
const fields=['path','action','object','device','requestId','status','durationMs','scene','focus','controller','connected','transitioning','recovery','keyboard','input','target','disabled','busy','prevented','reason'];
/** Local bounded metadata only: never copy request bodies, profiles or messages. */
export function traceInteraction(stage:string,detail:Record<string,unknown>={}){
 const entry:Entry={at:Date.now(),stage};
 for(const key of fields){const value=detail[key];if(typeof value==='boolean'||typeof value==='number'||value===null)entry[key]=value;else if(typeof value==='string')entry[key]=value.slice(0,120);}
 entries.push(entry);if(entries.length>256)entries.shift();
}
export function interactionDiagnostics(){return entries.map(entry=>({...entry}));}
