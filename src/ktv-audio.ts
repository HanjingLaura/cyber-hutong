import type {KtvSong} from '../shared/ktv.mjs';

/** Locally enabled synthesized accompaniment, aligned to the shared song clock. */
export class KtvAudio{
 private context?:AudioContext;
 private voices=new Set<OscillatorNode>();
 private lastBeat=-1;
 private song='';
 async enable(){this.context??=new AudioContext();await this.context.resume();}
 stop(){for(const voice of this.voices){try{voice.stop();}catch{/* finished */}voice.disconnect();}this.voices.clear();this.lastBeat=-1;this.song='';void this.context?.suspend();}
 dispose(){this.stop();void this.context?.close();}
 update(song:KtvSong,elapsed:number){
  const context=this.context;if(!context||context.state!=='running')return;
  const beat=Math.floor(elapsed/(60000/song.bpm));if(this.song===song.id&&beat===this.lastBeat)return;
  this.song=song.id;this.lastBeat=beat;
  const phase=(elapsed%(60000/song.bpm))/1000,time=context.currentTime+.015,period=60/song.bpm;
  // Skip late frames instead of stacking delayed notes after a background-tab pause.
  if(phase>period*.5)return;
  this.tone(time,beat%4===0?90:150,.1,.06,'sine');
  const midi=song.notes[beat%song.notes.length];
  this.tone(time,440*2**((midi-69)/12),period*.65,.045,'triangle');
  if(beat%2===0)this.tone(time,440*2**((midi-24-69)/12),period*.8,.035,'sine');
 }
 private tone(time:number,frequency:number,duration:number,volume:number,type:OscillatorType){
  const c=this.context!,voice=c.createOscillator(),gain=c.createGain();voice.type=type;voice.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  voice.connect(gain).connect(c.destination);this.voices.add(voice);voice.start(time);voice.stop(time+duration);
  voice.onended=()=>{this.voices.delete(voice);voice.disconnect();gain.disconnect();};
 }
}
