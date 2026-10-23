import sharp from 'sharp';import {mkdir} from 'node:fs/promises';
const sources={yousheng:'exec-0dbe2d14-bc25-485e-9cd9-ff23d23d2e0c.png',google:'exec-f88c8554-71f8-4f0e-b29b-868b0bb7d820.png',meeting:'exec-58021ac7-f5f4-4684-8eee-fd4d740c7013.png',street:'exec-5bc3dffa-7a58-4b49-9fe7-3f56a194f63a.png',campus:'exec-3d8fda52-d5c8-4af5-b7c8-59cea2574fd6.png'};
const root=process.argv[2];if(!root)throw Error('Pass generated image directory');
await mkdir('assets/maps/places',{recursive:true});
for(const [key,file]of Object.entries(sources))await sharp(root+'/'+file).resize(640,360,{fit:'fill',kernel:'nearest'}).png().toFile('assets/maps/places/'+key+'.png');
await mkdir('assets/props',{recursive:true});
await sharp(root+'/exec-a69143a7-0322-4c01-a866-7b4bd745f10b.png').trim().resize(100,70,{fit:'inside',kernel:'nearest'}).png().toFile('assets/props/pink-scooter.png');
await sharp(root+'/exec-eddef2f0-f376-40f4-a1e9-3db9291ebfe9.png').trim().resize(144,48,{fit:'inside',kernel:'nearest'}).png().toFile('assets/props/skateboard.png');
