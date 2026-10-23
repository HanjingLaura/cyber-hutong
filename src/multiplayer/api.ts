import { apiUrl } from '../base';
import type { User, World, Message } from './types';
import {traceInteraction} from '../interaction-diagnostics';
type Reply={user?:User|null;self?:User;roster?:World['roster'];messages?:Message[]};

/** Bound requests so a stalled checkpoint cannot block later gameplay actions. */
export async function api<T=Reply>(path:string,input?:unknown):Promise<T>{
  const metadata=input&&typeof input==='object'?input as Record<string,unknown>:{};
  const tracked=['object','npc','lease','ride','reward','transition'].includes(path)||path==='presence'&&metadata.checkpoint===true,started=Date.now();
  if(tracked)traceInteraction('request',{path,action:metadata.action,object:metadata.object,device:metadata.device,requestId:metadata.requestId});
  let res:Response;
  try{
    res=await fetch(apiUrl(path),{
      method:input===undefined?'GET':'POST',
      headers:input===undefined?{}:{'Content-Type':'application/json'},
      body:input===undefined?undefined:JSON.stringify(input),
      signal:AbortSignal.timeout(path==='presence'?8000:15000),
    });
  }catch{
    if(tracked)traceInteraction('response',{path,status:0,durationMs:Date.now()-started,reason:'network_or_timeout'});
    window.dispatchEvent(new Event('hutong:connection-lost'));
    throw new Error('连接中，请稍后重试');
  }
  let data:any;
  try{data=await res.json();}catch{
    if(tracked)traceInteraction('response',{path,status:res.status,durationMs:Date.now()-started,reason:'invalid_or_incomplete_body'});
    window.dispatchEvent(new Event('hutong:connection-lost'));
    throw Object.assign(new Error(res.ok?'联机服务响应异常':res.status>=500?'服务器暂时不可用，请稍后重试':'请求失败'),{status:res.status});
  }
  if(tracked)traceInteraction('response',{path,status:res.status,durationMs:Date.now()-started});
  if(!res.ok)throw Object.assign(new Error(data?.error||'请求失败'),{status:res.status});
  return data;
}
