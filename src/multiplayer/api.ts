import { apiUrl } from '../base';
import type { User, World, Message } from './types';
type Reply={user?:User|null;self?:User;roster?:World['roster'];messages?:Message[]};

/** Bound requests so a stalled checkpoint cannot block later gameplay actions. */
export async function api<T=Reply>(path:string,input?:unknown):Promise<T>{
  let res:Response;
  try{
    res=await fetch(apiUrl(path),{
      method:input===undefined?'GET':'POST',
      headers:input===undefined?{}:{'Content-Type':'application/json'},
      body:input===undefined?undefined:JSON.stringify(input),
      signal:AbortSignal.timeout(path==='presence'?8000:15000),
    });
  }catch{
    window.dispatchEvent(new Event('hutong:connection-lost'));
    throw new Error('连接中，请稍后重试');
  }
  let data:any;
  try{data=await res.json();}catch{
    window.dispatchEvent(new Event('hutong:connection-lost'));
    throw Object.assign(new Error(res.ok?'联机服务响应异常':'请求失败'),{status:res.status});
  }
  if(!res.ok)throw Object.assign(new Error(data?.error||'请求失败'),{status:res.status});
  return data;
}
