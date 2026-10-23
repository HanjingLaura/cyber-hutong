import bookstall from '../../assets/ttc/bookstall.png';
import market from '../../assets/ttc/market.png';
import greenhouse from '../../assets/ttc/greenhouse.png';
import {TARGETS,type Target} from './rules.mjs';

export const members=['cora','amber','suki','sid','jilly','laura','kay','franco'] as const;
export type Member=typeof members[number];
export const memberName=(id:Member)=>id[0].toUpperCase()+id.slice(1);
const spots=(positions:number[][],hint:string):Readonly<Target>[]=>positions.map(([x,y],i)=>({...TARGETS[i],x,y,hint}));
export const scenes=[
 {id:'bookstall',name:'胡同旧书摊',url:bookstall,width:1280,targets:TARGETS},
 {id:'market',name:'旧物集市',url:market,width:2160,targets:spots([[204,341],[595,419],[980,365],[1477,435],[1904,475]],'左右拖动，留意货架与箱子之间')},
 {id:'greenhouse',name:'温室花房',url:greenhouse,width:2160,targets:spots([[194,390],[626,465],[1088,376],[1555,465],[1965,390]],'左右拖动，留意盆栽与木架之间')},
] as const;
