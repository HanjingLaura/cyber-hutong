import test from 'node:test';
import assert from 'node:assert/strict';
import {liveBudget} from './fixtures/live-budget.mjs';

test('real-provider preflight uses the remaining aggregate allowance without raising it',()=>{
 assert.deepEqual(liveBudget(15,{}),{dailyLimit:15,dailyTokenLimit:20000});
 assert.deepEqual(liveBudget(8,{HUTONG_LIVE_CALL_LIMIT:'2',HUTONG_LIVE_TOKEN_LIMIT:'4000'}),{dailyLimit:2,dailyTokenLimit:4000});
 assert.deepEqual(liveBudget(8,{HUTONG_LIVE_CALL_LIMIT:'0',HUTONG_LIVE_TOKEN_LIMIT:'0'}),{dailyLimit:0,dailyTokenLimit:0});
});
test('invalid and larger preflight budgets are rejected',()=>{
 for(const value of ['25','-1','NaN','1.5'])assert.throws(()=>liveBudget(8,{HUTONG_LIVE_CALL_LIMIT:value}));
 for(const value of ['20001','-1','NaN','1.5'])assert.throws(()=>liveBudget(8,{HUTONG_LIVE_TOKEN_LIMIT:value}));
});
