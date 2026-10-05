export class Mines {
  readonly size=10;
  readonly count=15;
  bombs=new Set<number>();
  open=new Set<number>();
  flags=new Set<number>();
  outcome:'playing'|'won'|'lost'='playing';
  nearby(index:number){
    const x=index%10,y=Math.floor(index/10),result:number[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      if(x+dx>=0&&x+dx<10&&y+dy>=0&&y+dy<10)result.push((y+dy)*10+x+dx);
    }
    return result;
  }
  number(index:number){return this.nearby(index).filter(i=>this.bombs.has(i)).length;}
  flag(index:number){if(this.outcome!=='playing'||this.open.has(index))return;this.flags.has(index)?this.flags.delete(index):this.flags.add(index);}
  reveal(index:number){
    if(index<0||index>=100||this.outcome!=='playing'||this.flags.has(index)||this.open.has(index))return;
    if(!this.bombs.size){
      const safe=new Set([index,...this.nearby(index)]),pool=Array.from({length:100},(_,i)=>i).filter(i=>!safe.has(i));
      while(this.bombs.size<this.count)this.bombs.add(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    }
    if(this.bombs.has(index)){this.open.add(index);this.outcome='lost';return;}
    const queue=[index];
    while(queue.length){const i=queue.pop()!;if(this.open.has(i)||this.flags.has(i)||this.bombs.has(i))continue;this.open.add(i);if(!this.number(i))queue.push(...this.nearby(i));}
    if(this.open.size===100-this.count)this.outcome='won';
  }
}
export type Card={rank:number;up:boolean};
type CardState={columns:Card[][];stock:number[][];completed:number;moves:number};
export class Spider {
  columns:Card[][]=Array.from({length:10},()=>[]);
  stock:number[][]=[];
  completed=0;
  moves=0;
  private history:CardState[]=[];
  constructor(){
    const deck=Array.from({length:104},(_,i)=>i%13+1);
    for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
    this.columns.forEach((column,i)=>{for(let j=0;j<(i<4?6:5);j++)column.push({rank:deck.pop()!,up:j===(i<4?5:4)});});
    while(deck.length)this.stock.push(deck.splice(0,10));
  }
  private remember(){this.history.push(structuredClone({columns:this.columns,stock:this.stock,completed:this.completed,moves:this.moves}));}
  undo(){const state=this.history.pop();if(state)Object.assign(this,state);return !!state;}
  canSelect(column:number,index:number){
    const cards=this.columns[column];
    return index>=0&&index<cards.length&&cards.slice(index).every((card,i,tail)=>card.up&&(!i||tail[i-1].rank===card.rank+1));
  }
  move(from:number,index:number,to:number){
    if(from===to||!this.columns[to]||!this.canSelect(from,index))return false;
    const destination=this.columns[to],card=this.columns[from][index],top=destination.at(-1);
    if(top&&top.rank!==card.rank+1)return false;
    this.remember();destination.push(...this.columns[from].splice(index));this.moves++;this.finish();return true;
  }
  deal(){
    if(!this.stock.length||this.columns.some(column=>!column.length)||this.completed===8)return false;
    this.remember();const row=this.stock.pop()!;this.columns.forEach((column,i)=>column.push({rank:row[i],up:true}));this.moves++;this.finish();return true;
  }
  private finish(){
    this.columns.forEach(column=>{
      if(column.length)column[column.length-1].up=true;
      while(column.length>=13&&column.slice(-13).every((card,i)=>card.up&&card.rank===13-i)){
        column.splice(-13);this.completed++;
        if(column.length)column[column.length-1].up=true;
      }
    });
  }
}
