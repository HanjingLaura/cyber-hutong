import type {KtvSong} from '../shared/ktv.mjs';

const videos:Record<string,string>={
 power:new URL('../assets/video/ktv-power.mp4',import.meta.url).href,
 'beauty-and-a-beat':new URL('../assets/video/ktv-beauty-and-a-beat.mp4',import.meta.url).href,
 'lover-boy-88':new URL('../assets/video/ktv-lover-boy-88.mp4',import.meta.url).href,
 'eyes-nose-lips':new URL('../assets/video/ktv-eyes-nose-lips.mp4',import.meta.url).href,
};

/** Local MV playback follows the same clock as the queue and beat game. */
export class KtvAudio{
 private video:HTMLVideoElement;private enabled=false;private song='';private pending=false;private wanted=false;private blocked=false;private lastSync=0;private elapsed=0;private playEpoch=0;
 constructor(private host:HTMLElement,private status:(message:string)=>void){
  this.video=document.createElement('video');this.video.playsInline=true;this.video.preload='none';
  this.video.setAttribute('aria-label','KTV 歌曲 MV');this.video.tabIndex=0;
  this.video.addEventListener('loadedmetadata',()=>{if(this.enabled)this.video.currentTime=this.elapsed/1000;});
  this.video.addEventListener('error',()=>{this.blocked=true;this.status('MV 加载失败，请关闭后重试；仍可跟拍唱歌');});
  const retry=()=>{this.blocked=false;this.play();document.querySelector<HTMLElement>('.world')?.focus();};
  this.video.addEventListener('click',retry);
  this.video.addEventListener('keydown',event=>{if(event.code==='Enter'){event.preventDefault();retry();}});
  host.append(this.video);
 }
 async enable(){this.enabled=true;this.blocked=false;this.host.hidden=false;}
 stop(){this.playEpoch++;this.pending=false;this.enabled=false;this.wanted=false;this.video.pause();this.host.hidden=true;}
 dispose(){this.stop();this.video.removeAttribute('src');this.video.load();this.host.replaceChildren();}
 private play(){
  if(this.pending||this.blocked||!this.enabled||!this.wanted)return;this.pending=true;const request=++this.playEpoch;
  void this.video.play().catch((error:DOMException)=>{if(request===this.playEpoch&&this.enabled&&this.wanted&&error.name!=='AbortError'){this.blocked=true;this.status('点击 MV 画面播放，或关闭后重新开启 MV');}}).finally(()=>{if(request!==this.playEpoch)return;this.pending=false;if(!this.enabled||!this.wanted)this.video.pause();});
 }
 update(song:KtvSong|null,elapsed:number,playing=true){
  if(!this.enabled)return;this.elapsed=elapsed;const wanted=!!song&&playing;if(this.wanted&&!wanted){this.playEpoch++;this.pending=false;}this.wanted=wanted;
  if(!song){this.video.pause();return;}
  if(this.song!==song.id){this.playEpoch++;this.pending=false;this.song=song.id;this.video.src=videos[song.id];this.video.load();this.blocked=false;this.lastSync=0;}
  const now=performance.now();
  if(this.video.readyState>=1&&now-this.lastSync>500){this.lastSync=now;if(Math.abs(this.video.currentTime-elapsed/1000)>.5)this.video.currentTime=elapsed/1000;}
  if(playing){if(this.video.paused)this.play();}else this.video.pause();
 }
}
