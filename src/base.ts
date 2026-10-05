// Vite base URL ("/cyber-hutong/" in production builds, "/" in dev). Always ends with "/".
export const BASE:string=((import.meta as any).env?.BASE_URL as string|undefined)||'/';
// API paths get a trailing slash because the portfolio proxy (hanjing-laura.vercel.app) 308-redirects slashless URLs.
export const apiUrl=(path:string)=>{const clean=path.replace(/^\/+/,''),i=clean.indexOf('?'),name=(i===-1?clean:clean.slice(0,i)).replace(/\/+$/,''),query=i===-1?'':clean.slice(i);return BASE+'api/'+name+'/'+query;};
