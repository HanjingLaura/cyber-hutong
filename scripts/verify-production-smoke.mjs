// Controlled read-only release check. No account login, messages or model calls.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadPlaywright} from './playwright.mjs';
const directory='output/production-eight-agents-'+Date.now();await mkdir(directory,{recursive:true});
const browser=await loadPlaywright().chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
const report={passed:false,scope:'read-only production browser; no account login / chat writes / model requests',productionUrl:'https://hanjing-laura.vercel.app/cyber-hutong/',errors:[]};page.on('pageerror',error=>report.errors.push(error.message));
try{
 const response=await page.goto('https://cyber-hutong.vercel.app/api/health/',{waitUntil:'domcontentloaded',timeout:45000});assert.equal(response.status(),200);const health=JSON.parse(await page.locator('body').innerText());assert.equal(health.release,'2026-10-21-all-scene-switches');assert.equal(health.llm.configured,true);assert.equal(health.llm.backgroundCalls,false);assert.equal(health.llm.model,'qwen-flash');assert.equal(health.llm.budget.dailyCalls,200);assert.equal(health.llm.budget.dailyTokens,50000);report.release=health.release;report.provider=health.llm;
 await page.goto(report.productionUrl,{waitUntil:'domcontentloaded'});await page.locator('#account-dialog[open]').waitFor({timeout:30000});report.loginPageLoads=true;assert.equal(await page.locator('[data-scene="manner"]').count(),1);report.mannerSceneRegistered=true;assert.equal(await page.locator('#laura-profile-open, #laura-profile, [data-profile]').count(),0);report.noPersonaEditor=true;
 const fileTab=await context.newPage(),privateFile=await fileTab.goto('https://cyber-hutong.vercel.app/server/agent-personas/laura.json',{waitUntil:'domcontentloaded',timeout:45000});assert.equal(privateFile.status(),404);report.personaFileNotPublic=true;await fileTab.close();
 await page.screenshot({path:directory+'/desktop.png'});assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.error=error.message;process.exitCode=1;}
finally{await writeFile(directory+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify({directory,...report}));await browser.close();}
