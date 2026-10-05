import { spawn } from 'node:child_process';
const backend=spawn(process.execPath,['server/index.mjs'],{stdio:'inherit'});
const frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','0.0.0.0'],{stdio:'inherit'});
const stop=()=>{backend.kill();frontend.kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);backend.on('exit',()=>frontend.kill());frontend.on('exit',()=>backend.kill());
