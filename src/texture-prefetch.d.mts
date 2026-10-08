export interface TextureEntry{key:string;url:string}
export interface TexturePrefetcher{load(entries:TextureEntry[],options?:{required?:boolean;onProgress?:(completed:number,total:number)=>void;signal?:AbortSignal}):Promise<void>;dispose():void}
export function createTexturePrefetcher(options:{textures:{exists(key:string):boolean;addImage(key:string,source:HTMLImageElement):unknown};makeImage?:()=>HTMLImageElement;connection?:()=>{saveData?:boolean;effectiveType?:string}|undefined;defer?:()=>Promise<unknown>;setTimer?:typeof setTimeout;clearTimer?:typeof clearTimeout}):TexturePrefetcher;
