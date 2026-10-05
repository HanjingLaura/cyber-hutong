const url=process.env.HUTONG_HEALTH_URL||`http://127.0.0.1:${process.env.PORT||8788}/api/health`;
try{const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!r.ok||!(await r.json()).ok)throw new Error('服务健康检查失败');}catch(e){console.error(e.message);process.exitCode=1;}
