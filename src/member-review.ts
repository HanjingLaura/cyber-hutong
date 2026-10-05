import { BASE } from './base';
import Phaser from 'phaser';
import './member-review.css';
import {TeamAvatar} from './multiplayer/avatar';
import {roles,type Player} from './multiplayer/types';
import {registerRegions} from './frames';
import {characterRegistry,characterSource,type AvatarRole} from './character-assets';

const reviewRoles:AvatarRole[]=[...roles,'celine'];

const actions=['站立','走路','持物站立','持物走路','坐下','坐着持物','弹琴','哑铃','跳舞','跑步','工位打字'];
document.querySelector('#member-review')!.classList.add('hto-page');
document.querySelector('#member-review')!.innerHTML=`<nav class="hto-nav"><a class="hto-link" href="${BASE}">← 返回赛博胡同</a><a class="hto-link" href="${BASE}moles.html">胡同地鼠</a></nav><header class="member-hero"><div><p class="hto-kicker">MEMBER REVIEW</p><h1 class="hto-brand">九人动作检查</h1></div><p class="hto-muted">这里直接使用游戏的人物渲染。Suki：长发、无眼镜、白色露肩上衣。Laura：短发、眼镜、白帽衫；黑衣原版保留作对照。</p></header><div class="controls"><label>动作 <select id="team-action">${actions.map((a,i)=>`<option value="${i}">${a}</option>`).join('')}</select></label><label>方向 <select id="team-direction"><option value="0">正面</option><option value="2">背面</option><option value="1">右侧</option><option value="3">左侧</option></select></label><label>持物 <select id="team-item"><option value="咖啡">咖啡</option><option value="水">水瓶</option></select></label><label>Laura <select id="team-laura"><option value="white">白帽衫</option><option value="black">黑衣原版对照</option></select></label><button id="team-pause">暂停</button><label>帧 <input id="team-frame" type="range" min="0" max="7" value="0"/></label></div><div id="team-stage"></div><p class="note">同一套脚点、座面、桌面遮挡与持物挂点。九人的侧面走路、跑步均为八帧周期，统一头部尺寸与定位。走路使用确认姿势，跑步按同一手腿遮挡完整重绘；帧 0–7 可暂停检查。左右方向使用镜像。八人的侧面持物走路使用八帧重绘，Celine 保留原素材。Laura 跳舞恢复短发、眼镜及白帽衫。</p><details><summary>人物动作图集</summary><div class="atlas">${reviewRoles.map(role=>`<figure><figcaption>${role}</figcaption>${[...(role==='celine'?['celine-v1','celine-motion-v4']:[role,role+'-carry',...(role==='laura'?Object.keys(characterRegistry.sources).filter(id=>id.startsWith('laura-')&&(id.endsWith('-v5')||id.endsWith('-v6')||id.endsWith('-v7'))):[]),...(characterRegistry.sources[role+'-motion-v4']?[role+'-motion-v4']:[])]),role+'-walk-a-v8',role+'-walk-b-v8',role+'-run-v10',...(role==='celine'?[]:[role+'-carry-walk-v12']),...(role==='laura'?['laura-dance-v12']:[])].map(id=>`<a href="${characterSource(id)}" target="_blank"><img src="${characterSource(id)}" alt="${id}" loading="lazy"/></a>`).join('')}</figure>`).join('')}</div></details>`;
const action=document.querySelector<HTMLSelectElement>('#team-action')!,direction=document.querySelector<HTMLSelectElement>('#team-direction')!,item=document.querySelector<HTMLSelectElement>('#team-item')!,slider=document.querySelector<HTMLInputElement>('#team-frame')!,laura=document.querySelector<HTMLSelectElement>('#team-laura')!;
const initialParams=new URLSearchParams(location.search);
for(const [key,control]of [['action',action],['direction',direction]] as const){const value=initialParams.get(key);if(value!==null&&Array.from(control.options).some(option=>option.value===value))control.value=value;}
let paused=false,phase=0;
document.querySelector('#team-pause')!.addEventListener('click',()=>{paused=!paused;document.querySelector('#team-pause')!.textContent=paused?'播放':'暂停';});
slider.addEventListener('input',()=>{paused=true;document.querySelector('#team-pause')!.textContent='播放';});
class Review extends Phaser.Scene{
 views:TeamAvatar[]=[];furniture:Phaser.GameObjects.Image[][]=[];
 preload(){this.load.image('furniture',new URL('../assets/drafts/hutong-furniture-kit-v5.png',import.meta.url).href);this.load.image('rest-kit',new URL('../assets/drafts/rest-interaction-kit-v2.png',import.meta.url).href);this.load.image('held-water',new URL('../assets/props/water-bottle-v1.png',import.meta.url).href);}
 create(){
  const furniture=registerRegions(this,'furniture',[{name:'desk-front',x0:0,y0:0,x1:1,y1:.38},{name:'desk-back',x0:0,y0:.38,x1:1,y1:.65},...[0,.23,.40,.54,.68,.83].map((x0,i,a)=>({name:'prop-'+i,x0,y0:.65,x1:a[i+1]??1,y1:1}))]);
  registerRegions(this,'rest-kit',[{name:'coffee-cup',x0:.76,y0:0,x1:.99,y1:1}]);this.textures.get('held-water').add('bottle',0,6,2,6,11);
  const desk=furniture[1];this.textures.get('furniture').add('review-desk',0,desk.x,desk.y,Math.round(desk.width/4),desk.height);this.textures.get('furniture').add('review-panel',0,desk.x,desk.y+Math.round(desk.height*.58),Math.round(desk.width/4),Math.round(desk.height*.42));
  reviewRoles.forEach((role,i)=>{const x=80+(i%4)*160,y=110+Math.floor(i/4)*160;this.add.text(x,12+Math.floor(i/4)*160,role,{fontFamily:'Consolas',fontSize:'11px',color:'#eee8dc'}).setOrigin(.5,0);this.views.push(new TeamAvatar(this,role));this.furniture.push([this.add.image(x,y,'furniture',furniture[3].name).setOrigin(.5,1).setDisplaySize(48,52.8),this.add.image(x,y+44.88,'furniture','review-desk').setOrigin(.5,1).setDisplaySize(96,67.2),this.add.image(x,y+44.88,'furniture','review-panel').setOrigin(.5,1).setDisplaySize(96,67.2*.42),this.add.image(x,y-6.52,'furniture',furniture[5].name).setOrigin(.5,1).setDisplaySize(23,15.3)]);});
  laura.addEventListener('change',()=>{this.views[3].destroy();this.views[3]=new TeamAvatar(this,'laura',laura.value==='black');});
  window.__memberPreview={getState:()=>({ready:this.views.every(v=>v.ready),members:reviewRoles,action:Number(action.value),direction:Number(direction.value),phase,paused,renderer:'TeamAvatar',laura:laura.value,worldHeight:characterRegistry.worldHeight,frames:this.views.map(v=>({id:v.role,pose:v.pose,ready:v.ready}))})};
 }
 update(time:number,delta:number){phase=paused?Number(slider.value):Math.floor(time/(Number(action.value)===9?75:100))%8;if(!paused)slider.value=String(phase);const a=Number(action.value),d=Number(direction.value),seated=[4,5,6,10].includes(a),office=a===10;
  this.views.forEach((view,i)=>{const x=80+i%4*160,y=110+Math.floor(i/4)*160,back=d===2,depth=i*10+1;const objects=this.furniture[i];objects.forEach((o,j)=>o.setVisible(seated&&(j===0||office)).setDepth(depth+[-1,2,5,6][j]));if(back){objects[0].setDepth(depth+2);objects[1].setDepth(depth-2);objects[2].setVisible(false);objects[3].setDepth(depth-1).setY(y-65.48);objects[1].setY(y-14.08);}else{objects[1].setY(y+44.88);objects[3].setY(y-6.52);}
   const player:Omit<Player,'role'>&{role:AvatarRole}={role:view.role,name:view.role,scene:'review',x,y,facing:d,moving:a===1||a===3||a===9,seat:seated?'review-seat':null,hand:[2,3,5].includes(a)?item.value:null,revision:0};
   view.draw(player,x,y,d,delta,office,61.44,depth,false,a===6?'piano':a===7?'curl':a===8?'dance':a===9?'run':'',seated?y-(back?27:17):undefined,phase);
  });
 }
}
new Phaser.Game({type:Phaser.AUTO,width:640,height:480,parent:'team-stage',backgroundColor:'#343b3c',pixelArt:true,antialias:false,roundPixels:true,scene:Review,audio:{noAudio:true},scale:{mode:Phaser.Scale.NONE}});
declare global{interface Window{__memberPreview?:{getState:()=>unknown}}}

