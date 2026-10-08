import geometry from './interactions.json' with {type:'json'};
import {ktvWalkable} from './ktv.mjs';
const popFloor=[200,150,237.5,150,237.5,287.5,405,287.5,405,150,460,150,550,305,415,310,415,345,225,345,225,310,85,305];
function inPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-2;i<points.length;j=i,i+=2){const xi=points[i],yi=points[i+1],xj=points[j],yj=points[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
// Static furniture geometry shared by human movement, API validation and NPC routing.
// Moving doors and guests remain additional constraints in their scene controllers.
export function sceneWalkable(scene,x,y,{doors=[]}={}){
 if(typeof scene!=='string'||!Object.hasOwn(geometry,scene)||!Number.isFinite(x)||!Number.isFinite(y))return false;
 const seats=Object.values(geometry[scene].seats);
 if(scene==='ktv')return ktvWalkable(x,y);
 if(scene==='hutong'||scene==='hawaii')return (x>=69&&x<=603&&y>=166&&y<=221)||(x>=586&&x<=608&&y>=130&&y<=260);
 if(scene==='rest')return x>=52&&x<=590&&y>=140&&y<=278&&![200,360,520].some(cx=>((x-cx)/43.6)**2+((y-267)/24.2)**2<1)&&!seats.some(s=>Math.abs(x-s.at[0])<19&&y>s.at[1]-14&&y<s.at[1]+3);
 if(scene==='noodle')return x>=38&&x<=602&&y>=174&&y<=346&&![213,439].some(cx=>Math.abs(x-cx)<74&&y>257&&y<292)&&!seats.some(s=>Math.abs(x-s.at[0])<14&&Math.abs(y-s.at[1])<10);
 if(scene==='pop')return inPolygon(x,y,popFloor)&&!(x>240&&x<400&&y>171&&y<283)&&!(x>416&&x<459&&y<150);
 if(scene==='concert')return x>=55&&x<=585&&y>=159&&y<=349&&!seats.some(s=>Math.abs(x-s.at[0])<18&&y>s.at[1]-14&&y<s.at[1]+13);
 if(scene==='gym'){const inset=32+(350-y)*.09;return x>=inset&&x<=640-inset&&y>=90&&y<=338&&![225,320,415].some(cx=>Math.abs(x-cx)<31&&y<143)&&!(x<90&&y<178)&&!(x>490&&y<185)&&!(x>74&&x<143&&y>140&&y<211)&&!(x<90&&y>218&&y<305)&&!(x>565&&y>210&&y<266);}
 if(scene==='arcade')return x>=55&&x<=595&&y>=192&&y<=343&&!(x>72&&x<178&&y>220&&y<335)&&!(x>356&&x<512&&y>247&&y<311)&&!(x>479&&x<591&&y>332);
 if(scene==='dance')return x>=30+(340-y)*.1&&x<=610-(340-y)*.1&&y>=177&&y<=338&&!(x<160&&y>239&&y<290);
 if(scene==='elevator')return x>=43&&x<=597&&y>=242&&y<=340&&!(x>328&&x<390&&y<257)&&!(x<107&&y<264);
 if(scene==='subway')return x>=40&&x<=600&&y>=226&&y<=343;
 if(scene==='rehearsal')return x>=45&&x<=600&&y>=179&&y<=347&&!(x>472&&x<600&&y<232)&&!(x>278&&x<362&&y<198)&&!seats.some(s=>Math.abs(x-s.at[0])<20&&((y>s.at[1]-14&&y<s.at[1]+14)||(y>s.at[1]-45&&y<s.at[1]-31)));
 if(scene==='perler')return x>=35+(350-y)*.025&&x<=605-(350-y)*.025&&y>=124&&y<=341&&!(x>126&&x<514&&[144,250].some(top=>y>top-8&&y<top+68))&&!seats.some(s=>Math.abs(x-s.at[0])<22&&Math.abs(y-s.at[1])<6)&&!(x>527&&y<168)&&!(x<81&&y>230&&y<317)&&!(x>565&&y>246&&y<327)&&!(x<70&&y<131);
 if(scene==='bathroom'){const centers=Object.values(geometry.bathroom.seats).map(s=>s.at[0]);if(x<48||x>Math.min(608,526+(y-175)*1.35)||y<174||y>316||y<218&&x>406)return false;if(y<218){const i=centers.findIndex(cx=>Math.abs(x-cx)<26);return i>=0&&doors[i]&&!(Math.abs(x-centers[i])<22&&y<205);}return true;}
 return false;
}
