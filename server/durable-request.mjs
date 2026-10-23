// Hold response headers (including cookies) and events until the authoritative
// persistence hook commits. Local savepoints also roll back idempotency receipts.
export function durableRequests({db,handle,before=async()=>{},commit,suspend,capture,restore,publish}){
 let queue=Promise.resolve();
 async function run(req,res){
  suspend(true);let saved,transaction=false;
  try{
   await before(req);
   if(req.method!=='POST'||!commit){await handle(req,res);publish();return;}
   saved=capture();db.exec('SAVEPOINT http_request');transaction=true;
   const headers=new Map(),chunks=[];
   const staged={statusCode:200,headersSent:false,writableEnded:false,
    setHeader(k,v){headers.set(k,v);},
    writeHead(status,values={}){this.statusCode=status;this.headersSent=true;for(const [k,v]of Object.entries(values))headers.set(k,v);},
    write(value){chunks.push(value);return true;},
    end(value){if(value!==undefined)chunks.push(value);this.writableEnded=true;}};
   await handle(req,staged);
   if(staged.statusCode>=400){db.exec('ROLLBACK TO http_request; RELEASE http_request');transaction=false;restore(saved);}
   else{await commit();db.exec('RELEASE http_request');transaction=false;publish();}
   for(const [k,v]of headers)res.setHeader(k,v);
   res.writeHead(staged.statusCode);res.end(chunks.length?Buffer.concat(chunks.map(c=>Buffer.isBuffer(c)?c:Buffer.from(c))):undefined);
  }catch(e){
   if(transaction){db.exec('ROLLBACK TO http_request; RELEASE http_request');restore(saved);}
   if(!res.headersSent){res.writeHead(e.status||503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:e.status?e.message:'保存暂时不可用，请稍后重试'}));}else res.end();
  }finally{suspend(false);}
 }
 const request=async(req,res)=>{
  // Read uploads before entering the writer queue: a slow/aborted body must not
  // pause the world or block unrelated users. The bounded timer owns this read.
  if(req.method==='POST')try{req.hutongBody=await readUpload(req,/\/api\/albums\/?(?:\?|$)/.test(req.url)?1_060_000:/\/api\/agent-profile\/?(?:\?|$)/.test(req.url)?65536:16384);}catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json; charset=utf-8',...(e.status===408?{Connection:'close'}:{})});res.end(JSON.stringify({error:e.message}));return;}
  const job=queue.then(()=>run(req,res));queue=job.catch(()=>{});return job;
 };
 // Model generation runs outside the writer queue. Only its short database
 // reservation/finalization enters this queue, with the same durability gate.
 request.mutate=operation=>{
  const job=queue.then(async()=>{
   suspend(true);let saved,transaction=false;
   try{
    await before({method:'POST',url:'/api/agent-task',headers:{}});saved=capture();
    db.exec('SAVEPOINT background_request');transaction=true;
    const value=operation();
    if(value&&typeof value.then==='function')throw new Error('Background mutations must be synchronous');
    if(commit)await commit();db.exec('RELEASE background_request');transaction=false;publish();return value;
   }catch(error){if(transaction){db.exec('ROLLBACK TO background_request; RELEASE background_request');restore(saved);}throw error;}
   finally{suspend(false);}
  });queue=job.catch(()=>{});return job;
 };
 return request;
}

function readUpload(req,limit){return new Promise((resolve,reject)=>{
 // Some Node function adapters provide a body after consuming the stream.
 if(req.body!==undefined||req.readableEnded){const value=req.body??'',bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value));if(bytes.length>limit)reject(Object.assign(new Error('请求内容过长'),{status:413}));else resolve(bytes);return;}
 let size=0,parts=[],settled=false;const done=(error)=>{if(settled)return;settled=true;clearTimeout(timer);req.removeListener('data',data);req.removeListener('end',end);req.removeListener('error',fail);req.removeListener('aborted',aborted);if(error){
  // A readable 413 must not reset TCP while the client is still uploading.
  // Discard the remainder outside the writer queue, with a bounded lifetime.
  if(!req.destroyed&&!req.readableEnded){const guard=setTimeout(()=>req.destroy(),10000);guard.unref?.();const clear=()=>clearTimeout(guard);req.once('end',clear);req.once('close',clear);req.on('error',()=>{});req.resume();}
  reject(error);
 }else resolve(Buffer.concat(parts));};
 const fail=error=>done(error),aborted=()=>done(Object.assign(new Error('请求已中断'),{status:400}));
 const data=part=>{size+=part.length;if(size>limit)done(Object.assign(new Error('请求内容过长'),{status:413}));else parts.push(part);};
 const end=()=>done();const timer=setTimeout(()=>done(Object.assign(new Error('请求上传超时，请重试'),{status:408})),10000);timer.unref?.();
 if(Number(req.headers['content-length'])>limit){done(Object.assign(new Error('请求内容过长'),{status:413}));return;}
 req.on('data',data);req.once('end',end);req.once('error',fail);req.once('aborted',aborted);
 });}
