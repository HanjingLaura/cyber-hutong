// Stop across the accounting-day boundary instead of silently resetting a
// per-database daily allowance partway through the aggregate acceptance suite.
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url.includes('/chat/completions')&&process.env.HUTONG_LIVE_BUDGET_DAY){
  const day=new Date(Date.now()+28800000).toISOString().slice(0,10);
  if(day!==process.env.HUTONG_LIVE_BUDGET_DAY)throw Error('Live preflight accounting day changed; stop without retry');
 }
 return fetchOriginal(input,init);
};
