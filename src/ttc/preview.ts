import {TTCGame} from './game';
const game=new TTCGame();
void game.open();
game.dialog.addEventListener('close',()=>{document.body.innerHTML='<button type="button" style="margin:24px;padding:12px 20px;font-size:16px">打开击倒TTC</button>';document.querySelector('button')!.onclick=()=>void game.open();document.body.append(game.dialog);});
