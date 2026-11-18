const security = {
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'same-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return api(request,env);
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    const path=url.pathname==='/cabinet/'?'/cabinet':url.pathname;
    const asset=path==='/hero.jpg'?['image/jpeg',hero]:Object.hasOwn(staticAssets,path)?staticAssets[path]:null;
    if(!asset)return new Response('Страница не найдена.',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8',...security}});
    const [mime,body]=asset;
    return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':mime,
      'Cache-Control':mime.startsWith('text/html')?'no-cache':'public, max-age=1800',
      ...security}});
  }
};
