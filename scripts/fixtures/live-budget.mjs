// The suite passes the remaining aggregate allowance to each isolated database.
// A failed run stops the suite; there are no automatic real-provider retries.
export function liveBudget(defaultCalls,env=process.env) {
 const calls=Number(env.HUTONG_LIVE_CALL_LIMIT??defaultCalls);
 const tokens=Number(env.HUTONG_LIVE_TOKEN_LIMIT??20000);
 if(!Number.isSafeInteger(calls)||calls<0||calls>24||!Number.isSafeInteger(tokens)||tokens<0||tokens>20000)throw Error('Live preflight budget must stay within 24 calls / 20000 tokens');
 return {dailyLimit:Math.min(defaultCalls,calls),dailyTokenLimit:tokens};
}
