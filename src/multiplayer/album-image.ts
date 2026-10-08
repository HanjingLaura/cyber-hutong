export type PreparedPhoto={name:string;image:string;preview:string;requestId:string};
const LIMIT=768*1024;

/** Normalize orientation, remove camera metadata and bound the upload before sending it. */
export async function preparePhoto(file:File):Promise<PreparedPhoto>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 照片');
  if(file.size>25*1024*1024)throw new Error('原照片超过 25 MB，请换一张较小的照片');
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('这张照片无法读取，请重新选择');});
  try{
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器无法处理图片，请换一个浏览器重试');
    let longest=1600;
    for(let pass=0;pass<4;pass++,longest=Math.round(longest*.75)){
      const scale=Math.min(1,longest/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      for(const quality of [.86,.72,.56]){
        const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',quality));
        if(!blob||blob.size>LIMIT)continue;
        const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('照片处理失败，请重试'));reader.readAsDataURL(blob);});
        return {name:file.name,image,preview:URL.createObjectURL(blob),requestId:crypto.randomUUID()};
      }
    }
    throw new Error('照片仍然太大，请选择较小的版本');
  }finally{bitmap.close();}
}
