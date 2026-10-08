/** Original looping phrase with a quiet reed-like Web Audio timbre. */
export class Saxophone {
 private context?:AudioContext;
 private timer?:ReturnType<typeof setInterval>;
 private voices=new Set<{oscillator:OscillatorNode;vibrato:OscillatorNode;gain:GainNode;filter:BiquadFilterNode;depth:GainNode}>();
 private revision=0;private step=0;
 playing=false;notesPlayed=0;
 async start(){
  if(this.playing)return;
  this.playing=true;const revision=++this.revision;this.step=0;
  try{
   this.context??=new AudioContext();await this.context.resume();
   if(!this.playing||revision!==this.revision)return;
   this.note();this.timer=setInterval(()=>this.note(),320);
  }catch{if(revision===this.revision)this.stop();}
 }
 private note(){
  const phrase=[60,63,65,67,70,67,65,null,63,60,null,null];
  const midi=phrase[this.step++%phrase.length],context=this.context;
  if(midi===null||!context||!this.playing)return;
  const now=context.currentTime,frequency=440*2**((midi-69)/12);
  const oscillator=context.createOscillator(),vibrato=context.createOscillator(),depth=context.createGain(),gain=context.createGain(),filter=context.createBiquadFilter();
  oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array(7),new Float32Array([0,1,.55,.28,.18,.08,.04])));
  oscillator.frequency.value=frequency;vibrato.frequency.value=5.2;depth.gain.value=frequency*.004;
  vibrato.connect(depth).connect(oscillator.frequency);
  filter.type='lowpass';filter.frequency.value=1800;filter.Q.value=.7;
  oscillator.connect(filter).connect(gain).connect(context.destination);
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.06,now+.035);gain.gain.setValueAtTime(.045,now+.20);gain.gain.linearRampToValueAtTime(0,now+.29);
  const voice={oscillator,vibrato,gain,filter,depth};this.voices.add(voice);
  oscillator.onended=()=>{oscillator.disconnect();vibrato.disconnect();depth.disconnect();filter.disconnect();gain.disconnect();this.voices.delete(voice);};
  oscillator.start(now);vibrato.start(now);oscillator.stop(now+.30);vibrato.stop(now+.30);this.notesPlayed++;
 }
 stop(){
  this.playing=false;this.revision++;
  if(this.timer!==undefined){clearInterval(this.timer);this.timer=undefined;}
  for(const voice of this.voices){
   const now=this.context!.currentTime;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(0,now);
   try{voice.oscillator.stop(now);voice.vibrato.stop(now);}catch{}
  }
 }
 dispose(){this.stop();void this.context?.close();}
}
