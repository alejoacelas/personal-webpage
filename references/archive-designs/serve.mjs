import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(dir,'../..');
const port=Number(process.env.PORT||49341);
const cache=process.env.REVIEW_DIR||path.join(os.homedir(),'.cache/alejo-archive-designs');
await mkdir(cache,{recursive:true,mode:0o700});
const destination=path.join(cache,'review.json');
let state;
try{state=JSON.parse(await readFile(destination,'utf8'))}catch(err){if(err.code!=='ENOENT')throw err;state={favorite:'',notes:{}}}
const ids=['atlas','edition','stream','cabinet','room'];
const routes=new Map([['/','explore.html'],['/explore','explore.html'],['/studies','index.html'],...['explore.css','landing.mjs','trail-links.json','explore.mjs','spatial.mjs','atlas-taxonomy.json','atlas-extra.json','atlas-sources.json'].map(name=>['/'+name,name]),['/archive.mjs','archive.mjs'],
 ...ids.flatMap(id=>[['/'+id+'.html','prototype.html'],['/'+id+'.mjs',id+'.mjs']]),
 ['/historical-documents.json','historical-documents.json'],['/historical-posts.json','historical-posts.json'],
 ['/documents.json',path.join(repo,'content/documents.json')],['/feed.json',path.join(repo,'public/feed.json')]
]);
const types={'.css':'text/css','.html':'text/html','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.woff2':'font/woff2'};
let queue=Promise.resolve();
http.createServer(async(req,res)=>{
 const finish=(code,body='',type='text/plain')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)};
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/review'){
   if(req.method==='POST'){
    if(req.headers.origin!=='http://'+req.headers.host||!req.headers['content-type']?.startsWith('application/json'))return finish(403);
    let body='';for await(const chunk of req){body+=chunk;if(body.length>20000)return finish(413)}
    const data=JSON.parse(body);
    if(!([...ids,''].includes(data.favorite)||(ids.includes(data.id)&&typeof data.note==='string')))return finish(400);
    const update=queue.then(async()=>{
     const next=structuredClone(state);
     if(Object.hasOwn(data,'favorite'))next.favorite=data.favorite;else next.notes[data.id]=data.note;
     await writeFile(destination+'.tmp',JSON.stringify(next,null,2),{mode:0o600});await rename(destination+'.tmp',destination);state=next;
    });
    queue=update.catch(()=>{});await update;
   }else if(req.method!=='GET')return finish(405);
   return finish(200,JSON.stringify(state),'application/json');
  }
  if(req.method!=='GET')return finish(405);
  const asset=(url.pathname==='/'&&url.searchParams.has('design')?'index.html':routes.get(url.pathname))||(/^\/[a-z0-9-]+\.(?:webp|woff2)$/.test(url.pathname)&&url.pathname.slice(1));
  if(!asset)return finish(404);
  const file=path.resolve(dir,asset);return finish(200,await readFile(file),types[path.extname(file)]);
 }catch(error){finish(error.code==='ENOENT'?404:500)}
}).listen(port,'127.0.0.1',()=>console.log('http://localhost:'+port));
