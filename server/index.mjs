import { createMvpServer } from './app.mjs';
import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(!process.env.HUTONG_INVITE){const invite=randomBytes(9).toString('base64url');writeFileSync('.env.local',`HUTONG_INVITE=${invite}\n`,{flag:'a'});process.env.HUTONG_INVITE=invite;console.log('内测邀请码已保存到 .env.local');}
if(!process.env.PARTY_AUTH_SECRET){const secret=randomBytes(24).toString('base64url');writeFileSync('.env.local',`PARTY_AUTH_SECRET=${secret}\n`,{flag:'a'});process.env.PARTY_AUTH_SECRET=secret;console.log('PARTY_AUTH_SECRET 已保存到 .env.local');}
writeFileSync('.dev.vars',`PARTY_AUTH_SECRET=${process.env.PARTY_AUTH_SECRET}\n`);
const app=createMvpServer({dbPath:process.env.HUTONG_DB||'data/mvp.sqlite'});
const port=Number(process.env.PORT||8788);app.server.listen(port,'0.0.0.0',()=>console.log(`hutong multiplayer http://127.0.0.1:${port}`));
process.on('SIGINT',()=>{app.close();process.exit(0);});process.on('SIGTERM',()=>{app.close();process.exit(0);});
