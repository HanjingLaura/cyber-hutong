import fs from 'node:fs';
const registry=JSON.parse(fs.readFileSync('assets/metadata/team-v1.json','utf8'));
const bounds=JSON.parse(fs.readFileSync('assets/metadata/q-v2-bounds.json','utf8'));
bounds.typing=JSON.parse(fs.readFileSync('assets/metadata/q-v2-typing-bounds.json','utf8'));
const order=['suki','sid','jilly','laura','kay','franco','cora','amber'];
for(const [role,m]of Object.entries(registry.members)){
 const b=bounds[role];if(b.base.frames.length!==64||b.carry.frames.length!==24)throw Error('Missing poses '+role);
 function update(frames,rects){return frames.map((f,i)=>{const rect=rects[i],[,,w,h]=rect;return {...f,rect,floor:[w/2,h],foot:[w/2,h],seat:[w/2,h*.8],grip:f.grip?[f.grip[0]/f.rect[2]*w,f.grip[1]/f.rect[3]*h]:null};});}
 m.frames=update(m.frames,b.base.frames);m.referenceHeight=m.frames[0].rect[3];m.sourceSize=b.base.size;
 m.carryFrames=update(m.carryFrames,b.carry.frames);m.carryReferenceHeight=m.carryFrames[0].rect[3];m.carrySourceSize=b.carry.size;
 m.officeFrames=bounds.typing.frames.slice(order.indexOf(role)*4,order.indexOf(role)*4+4).map((rect,i)=>({name:['type-front-left','type-front-right','type-back-left','type-back-right'][i],rect,foot:[rect[2]/2,rect[3]],seat:[rect[2]/2,rect[3]*.8],grip:null,gripSide:0}));
 m.officeReferenceHeight=m.officeFrames[0].rect[3]/.92;
}
registry.version=2;registry.style='Q pixel art, 2.5D; identities referenced from cyber-hutong';
fs.writeFileSync('assets/metadata/team-v2.json',JSON.stringify(registry,null,2)+'\n');
