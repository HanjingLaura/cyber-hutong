const keys=['KeyZ','KeyS','KeyX','KeyD','KeyC','KeyV','KeyG','KeyB','KeyH','KeyN','KeyJ','KeyM','KeyQ','Digit2','KeyW','Digit3','KeyE','KeyR','Digit5','KeyT','Digit6','KeyY','Digit7','KeyU','KeyI'];
const labels=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const keyLabel=(code:string)=>code.replace(/^(Key|Digit)/,'');
type Voice={oscillators:OscillatorNode[];gain:GainNode;note:number};
/** Local piano-like synthesis, with independent voices for chords. */
export class Piano {
  private context?:AudioContext;private voices=new Map<string,Voice>();private revision=0;private keyboardOffset=12;
  notesPlayed=0;
  constructor(private change:()=>void){
    const keyboard=document.querySelector('#rehearsal-keyboard')!;
    keyboard.replaceChildren();let whites=0;
    for(let note=0;note<=36;note++){const black=[1,3,6,8,10].includes(note%12),button=document.createElement('button');button.type='button';button.dataset.note=String(note);button.className=black?'piano-black':'piano-white';button.setAttribute('aria-label',`${labels[note%12]}${3+Math.floor(note/12)}`);button.innerHTML=`<span>${labels[note%12]}${3+Math.floor(note/12)}</span><small></small>`;
      if(black)button.style.left=`${(whites-.32)/22*100}%`;else whites++;
      button.addEventListener('pointerdown',e=>{if(e.button!==0||(document.querySelector('#rehearsal-piano') as HTMLElement).hidden)return;e.preventDefault();button.setPointerCapture(e.pointerId);void this.play(note,`pointer-${e.pointerId}`);});
      const release=(e:PointerEvent)=>this.release(`pointer-${e.pointerId}`);
      button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);keyboard.append(button);
    }
    this.paint();
  }
  get active(){return [...this.voices.values()].map(v=>v.note);}
  keyDown(code:string){if(code==='ArrowUp'||code==='ArrowDown'){this.stop();this.keyboardOffset=code==='ArrowUp'?12:0;this.paint();return true;}const note=keys.indexOf(code);if(note<0)return false;void this.play(note+this.keyboardOffset,code);return true;}
  keyUp(code:string){this.release(code);}
  async play(note:number,id:string){
    if(this.voices.has(id)||!Number.isInteger(note)||note<0||note>36)return;
    this.context??=new AudioContext();const revision=this.revision;
    // Insert the voice before awaiting audio permission so key-up always cancels it.
    const context=this.context,gain=context.createGain(),frequency=130.812783*2**(note/12);
    const oscillators=[1,2,3].map((harmonic,i)=>{const oscillator=context.createOscillator(),level=context.createGain();oscillator.type='sine';oscillator.frequency.value=frequency*harmonic;level.gain.value=[1,.32,.12][i];oscillator.connect(level).connect(gain);oscillator.onended=()=>{oscillator.disconnect();level.disconnect();};return oscillator;});
    const voice={oscillators,gain,note};this.voices.set(id,voice);
    gain.connect(context.destination);gain.gain.value=0;
    try{await context.resume();}catch{this.release(id);return;}
    if(revision!==this.revision||this.voices.get(id)!==voice){oscillators.forEach(o=>o.disconnect());gain.disconnect();return;}
    const now=context.currentTime;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.12,now+.006);gain.gain.exponentialRampToValueAtTime(.025,now+1.4);
    oscillators.forEach(o=>o.start(now));this.notesPlayed++;this.paint();this.change();
  }
  release(id:string){
    const voice=this.voices.get(id);if(!voice)return;this.voices.delete(id);
    if(this.context){const now=this.context.currentTime;voice.gain.gain.cancelAndHoldAtTime(now);voice.gain.gain.exponentialRampToValueAtTime(.0001,now+.2);voice.oscillators.forEach(o=>{try{o.stop(now+.21);}catch{o.disconnect();}});setTimeout(()=>voice.gain.disconnect(),260);}
    this.paint();this.change();
  }
  stop(){this.revision++;for(const id of [...this.voices.keys()])this.release(id);}
  dispose(){this.stop();void this.context?.close();}
  private paint(){for(const b of document.querySelectorAll<HTMLElement>('#rehearsal-keyboard button')){const note=Number(b.dataset.note);b.classList.toggle('pressed',this.active.includes(note));b.querySelector('small')!.textContent=keys[note-this.keyboardOffset]?keyLabel(keys[note-this.keyboardOffset]):'';}const range=document.querySelector('#piano-range');if(range)range.textContent=this.keyboardOffset?'键盘 C4–C6':'键盘 C3–C5';}
}
