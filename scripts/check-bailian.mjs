import {existsSync} from 'node:fs';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const key=process.env.DASHSCOPE_API_KEY,base=process.env.LLM_BASE_URL||'https://dashscope.aliyuncs.com/compatible-mode/v1',model=process.env.LLM_MODEL||'qwen-plus';
if(!key){console.error('百炼密钥尚未配置');process.exit(1);}
try{
 const r=await fetch(base.replace(/\/$/,'')+'/chat/completions',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,enable_thinking:false,max_tokens:30,response_format:{type:'json_object'},messages:[{role:'user',content:'请只返回 JSON 对象 {"ok":true}。'}]})});
 if(!r.ok){console.error('百炼验证失败，HTTP '+r.status+'。请检查密钥地域、模型权限或余额。');process.exit(1);}
 const result=await r.json();if(JSON.parse(result.choices?.[0]?.message?.content??'{}').ok!==true)throw Error();console.log('百炼接口验证成功：'+model);
}catch{console.error('百炼验证未通过：连接超时或返回格式异常。');process.exit(1);}
