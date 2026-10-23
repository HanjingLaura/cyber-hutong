/** Share downloaded, decoded images with Phaser's global texture cache. */
export function createTexturePrefetcher({textures,makeImage=()=>new Image(),connection=()=>navigator.connection,
 defer=()=>new Promise(resolve=>requestAnimationFrame(resolve)),setTimer=setTimeout,clearTimer=clearTimeout}){
 const jobs=new Map(),queue=[];let active=0,reconciling=false,disposed=false;
 const allowed=()=>{const c=connection();return !c?.saveData&&!['2g','slow-2g'].includes(c?.effectiveType);};
 function finish(job,error){
  if(job.done)return;job.done=true;clearTimer(job.timer);jobs.delete(job.key);
  if(job.image){job.image.onload=null;job.image.onerror=null;if(error)job.image.removeAttribute('src');}
  if(job.started)active--;
  if(error)job.reject(error);else job.resolve();
  if(!reconciling)drain();
 }
 function timeout(job){clearTimer(job.timer);job.timer=setTimer(()=>finish(job,new Error('素材载入超时，请重试')),job.required?30000:12000);}
 function drain(){
  while(!disposed&&active<2&&queue.length){
   const job=queue.shift();if(job.done)continue;
   if(textures.exists(job.key)){finish(job);continue;}
   job.started=true;active++;const image=makeImage();job.image=image;timeout(job);
   image.decoding='async';image.fetchPriority='high';
   image.onload=async()=>{try{
    await image.decode?.();if(job.done||disposed)return;
    await defer();if(job.done||disposed)return;
    if(!textures.exists(job.key))textures.addImage(job.key,image);
    finish(job);
   }catch{finish(job,new Error('素材解码失败，请重试'));}};
   image.onerror=()=>finish(job,new Error('素材加载失败，请重试'));image.src=job.url;
  }
 }
 return {
  load(entries,{required=false,onProgress=()=>{},signal}={}){
   if(disposed)return Promise.reject(new Error('游戏已关闭'));
   if(signal?.aborted)return Promise.reject(new Error('本次地点载入已取消'));
   if(!required&&!allowed())return Promise.resolve();
   const wanted=new Set(entries.map(e=>e.key));reconciling=true;
   for(const job of [...jobs.values()])if(!job.required&&!wanted.has(job.key))finish(job,new Error('已选择其他地点'));
   let completed=0;const pinned=[];const promises=entries.map(entry=>{
    if(textures.exists(entry.key)){completed++;return Promise.resolve();}
    let job=jobs.get(entry.key);
    if(!job){
     job={...entry,required,pins:0,started:false,done:false};job.promise=new Promise((resolve,reject)=>{job.resolve=resolve;job.reject=reject;});
     jobs.set(job.key,job);queue.push(job);
    }else if(required&&!job.required){job.required=true;if(job.started)timeout(job);}
    if(required){job.pins++;pinned.push(job);}
    return job.promise.then(()=>{completed++;onProgress(completed,entries.length);});
   });
   let aborted;
   const cancelled=signal&&new Promise((_,reject)=>{aborted=()=>reject(new Error('本次地点载入已取消'));signal.addEventListener('abort',aborted,{once:true});});
   const release=failed=>{
    if(aborted)signal.removeEventListener('abort',aborted);
    reconciling=true;
    for(const job of pinned){job.pins--;if(!job.pins){job.required=false;if(failed&&!job.done)finish(job,new Error('本次地点载入已取消'));}}
    reconciling=false;drain();
   };
   reconciling=false;onProgress(completed,entries.length);drain();
   const loaded=Promise.all(promises);
   return (cancelled?Promise.race([loaded,cancelled]):loaded).then(()=>release(false),error=>{release(true);throw error;});
  },
  dispose(){disposed=true;for(const job of [...jobs.values()])finish(job,new Error('游戏已关闭'));queue.length=0;}
 };
}
