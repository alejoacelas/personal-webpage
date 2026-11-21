const NS = 'http://www.w3.org/2000/svg';
const ink = '#23342c';
const paper = '#faf9f2';
const accent = '#9f4429';
const kindColors = {Template:'#35664c',Draft:'#9f4429',Repository:'#366682',Slack:'#7c5873','Call excerpt':'#887035','Call note':'#887035'};
const font = '500 14px system-ui, sans-serif';
const svgElement = (tag,attrs={}) => {
  const node=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);
  return node;
};

function graphData(items,connections) {
  const nodes=items.map((item,index)=>({item,index,neighbors:new Set()}));
  const byId=new Map(nodes.map(n=>[n.item.id,n]));
  const pairs=new Map();
  for(const a of nodes){
    for(const {to} of connections[a.item.id]||[]){
      const b=byId.get(to);
      if(!b || a===b)continue;
      a.neighbors.add(b); b.neighbors.add(a);
      const id=[Math.min(a.index,b.index),Math.max(a.index,b.index)].join(':');
      if(!pairs.has(id))pairs.set(id,{a,b});
    }
  }
  return {nodes,byId,edges:[...pairs.values()]};
}

function measureLabels(nodes){
  const ctx=document.createElement('canvas').getContext('2d');
  ctx.font=font;
  for(const n of nodes){
    const words=n.item.title.split(/\s+/), lines=[];
    let line='';
    for(const word of words){
      if(line && ctx.measureText(line+' '+word).width>137){lines.push(line);line='';}
      line=line?line+' '+word:word;
    }
    if(line)lines.push(line);
    n.lines=lines;
    n.w=Math.max(22,...lines.map(l=>ctx.measureText(l).width))+14;
    n.h=lines.length*16+6;
  }
}

// Graph-distance stress keeps linked entries near one another. The rectangle
// constraints reserve space for every visible title, including long titles.
function position(nodes){
  const N=nodes.length;
  if(!N)return {x:0,y:0,w:1,h:1};
  const dist=nodes.map(s=>{
    const d=Array(N).fill(Infinity);d[s.index]=0;
    const queue=[s];
    for(let j=0;j<queue.length;j++){
      const a=queue[j];
      for(const b of a.neighbors)if(!Number.isFinite(d[b.index])){
        d[b.index]=d[a.index]+1;queue.push(b);
      }
    }
    return d;
  });
  const maxD=Math.max(2,...dist.flat().filter(Number.isFinite));
  nodes.forEach((n,i)=>{
    // A deterministic low-discrepancy seed breaks symmetry. Only real graph
    // connections and title dimensions subsequently affect the layout.
    const angle=i*2.399963, radius=28*Math.sqrt(i+.5);
    n.x=Math.cos(angle)*radius*1.5;n.y=Math.sin(angle)*radius;
  });
  for(let iteration=0;iteration<260;iteration++){
    const sums=nodes.map(()=>({x:0,y:0,w:0}));
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){
      const a=nodes[i],b=nodes[j];
      const d=Number.isFinite(dist[i][j])?dist[i][j]:maxD+2;
      const dx=a.x-b.x,dy=(a.y-b.y)*1.60;
      const len=Math.hypot(dx,dy)||1;
      const target=136*Math.pow(d,.86);
      const weight=1/(d*d);
      const correction=(target-len)/len*weight;
      sums[i].x+=dx*correction;sums[i].y+=dy/1.60*correction;sums[i].w+=weight;
      sums[j].x-=dx*correction;sums[j].y-=dy/1.60*correction;sums[j].w+=weight;
    }
    for(let i=0;i<N;i++){
      const sum=sums[i];if(!sum.w)continue;
      nodes[i].x+=sum.x/sum.w*.48;nodes[i].y+=sum.y/sum.w*.48;
    }
  }
  // Orient the longest axis horizontally without changing neighbourhoods.
  const avg=(field)=>nodes.reduce((s,n)=>s+n[field],0)/N;
  const cx=avg('x'),cy=avg('y');
  let xx=0,yy=0,xy=0;
  for(const n of nodes){const x=n.x-cx,y=n.y-cy;xx+=x*x;yy+=y*y;xy+=x*y;}
  const angle=.5*Math.atan2(2*xy,xx-yy),c=Math.cos(angle),s=Math.sin(angle);
  for(const n of nodes){const x=n.x-cx,y=n.y-cy;n.x=x*c+y*s;n.y=-x*s+y*c;}
  for(let k=0;k<650;k++){
    let maxOverlap=0;
    for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){
      const a=nodes[i],b=nodes[j],dx=a.x-b.x,dy=a.y-b.y;
      const ox=(a.w+b.w)/2+13-Math.abs(dx),oy=(a.h+b.h)/2+11-Math.abs(dy);
      if(ox<=0 || oy<=0)continue;
      const overlap=Math.min(ox,oy)+.02;
      maxOverlap=Math.max(maxOverlap,overlap);
      if(ox<oy){const delta=(dx<0?-1:1)*overlap/2;a.x+=delta;b.x-=delta;}
      else {const delta=(dy<0?-1:1)*overlap/2;a.y+=delta;b.y-=delta;}
    }
    if(maxOverlap<.08)break;
  }
  const left=Math.min(...nodes.map(n=>n.x-n.w/2)), right=Math.max(...nodes.map(n=>n.x+n.w/2));
  const top=Math.min(...nodes.map(n=>n.y-n.h/2)), bottom=Math.max(...nodes.map(n=>n.y+n.h/2));
  return {x:left,y:top,w:right-left,h:bottom-top};
}

export function mountGraph(container,{items,connections,onOpen}){
  const data=graphData(items,connections),{nodes,byId,edges}=data;
  measureLabels(nodes);
  const bounds=position(nodes);
  const surface=document.createElement('div');
  surface.className='constellation';
  surface.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;background:'+paper+';touch-action:none;overscroll-behavior:contain;cursor:grab';
  if(container.clientHeight<60)surface.style.height='clamp(380px,72svh,810px)';
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const svg=svgElement('svg',{role:'group','aria-label':'Connections between all '+nodes.length+' entries'});
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;overflow:hidden;user-select:none;touch-action:none';
  const layer=svgElement('g');svg.append(layer);surface.append(canvas,svg);container.replaceChildren(surface);
  const ctx=canvas.getContext('2d');
  let width=0,height=0,zoom=1,tx=0,ty=0,fitScale=1,fitted=true;
  let selected=null,hovered=null,focused=null,matches=null,drag=null,frame=0,disposed=false,suppressClick=false;
  const pointers=new Map();
  const signal=new AbortController(),opt={signal:signal.signal};

  function focusId(){return hovered||focused||selected;}
  function highlight(){
    const id=focusId(),origin=byId.get(id);
    for(const n of nodes){
      const inNeighborhood=!origin || origin===n || origin.neighbors.has(n);
      const inSearch=!matches || matches.has(n.item.id);
      n.el.style.opacity=inSearch && inNeighborhood?'1':'.25';
      n.label.setAttribute('fill',n===origin?accent:ink);
      n.label.setAttribute('font-weight',n===origin?'650':'500');
      n.dot.setAttribute('r',n===origin?4.5:3.1);
      n.ring.setAttribute('opacity',n===origin?'1':'0');
      n.el.setAttribute('aria-pressed',String(n.item.id===selected));
    }
    schedule();
  }

  for(const n of nodes){
    const x=n.x-n.w/2,y=n.y-(n.lines.length-1)*8;
    const el=svgElement('g',{role:'button',tabindex:0,'aria-label':n.item.title,'data-graph-id':n.item.id,class:'constellation-node'});
    el.style.cssText='cursor:pointer;outline:none';
    const fullTitle=svgElement('title');fullTitle.textContent=n.item.title;el.append(fullTitle);
    el.append(svgElement('rect',{x:x-2,y:n.y-n.h/2-2,width:n.w+4,height:n.h+4,fill:'transparent'}));
    const ring=svgElement('circle',{cx:x+3.5,cy:y,r:7.2,fill:'none',stroke:accent,'stroke-width':1.3,opacity:0});
    const dot=svgElement('circle',{cx:x+3.5,cy:y,r:3.1,fill:kindColors[n.item.kind]||'#6e7965',stroke:paper,'stroke-width':.8});
    const label=svgElement('text',{x:x+13,y:y+4.5,'font-family':'system-ui,sans-serif','font-size':14,'font-weight':500,
      fill:ink,stroke:paper,'stroke-width':4.5,'stroke-linejoin':'round','paint-order':'stroke fill','pointer-events':'none'});
    n.lines.forEach((line,i)=>{const span=svgElement('tspan',{x:x+13,dy:i?16:0});span.textContent=line;label.append(span);});
    el.append(ring,dot,label);layer.append(el);Object.assign(n,{el,label,dot,ring,ax:x+3.5,ay:y});
    el.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch' && !drag){hovered=n.item.id;highlight();}},opt);
    el.addEventListener('pointerleave',()=>{if(hovered===n.item.id){hovered=null;highlight();}},opt);
    el.addEventListener('focus',()=>{focused=n.item.id;highlight();},opt);
    el.addEventListener('blur',()=>{if(focused===n.item.id){focused=null;highlight();}},opt);
    el.addEventListener('click',e=>{if(!suppressClick){e.stopPropagation();onOpen(n.item.id);}},opt);
    el.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen(n.item.id);return;}
      if(e.key==='Home'){e.preventDefault();fit();return;}
      if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(1.35,width/2,height/2);return;}
      if(e.key==='-'){e.preventDefault();zoomAt(1/1.35,width/2,height/2);return;}
      const dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!dir)return;
      e.preventDefault();
      const nearby=nodes.filter(m=>m!==n).map(m=>{
        const dx=m.x-n.x,dy=m.y-n.y,forward=dx*dir[0]+dy*dir[1];
        return {m,score:forward>1?(dx*dx+dy*dy)/forward:Infinity};
      }).sort((a,b)=>a.score-b.score)[0];
      if(nearby && Number.isFinite(nearby.score)){nearby.m.el.focus({preventScroll:true});reveal(nearby.m);}
    },opt);
  }

  function schedule(){ if(!frame&&!disposed)frame=requestAnimationFrame(paint); }
  function paint(){
    frame=0;
    const dpr=Math.min(3,window.devicePixelRatio||1);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    ctx.translate(tx,ty);ctx.scale(zoom,zoom);
    // A fine registration grid keeps panning and magnification visually legible.
    ctx.fillStyle='#60775e32';
    const spacing=54;
    for(let x=Math.floor(-tx/zoom/spacing)*spacing;x<(width-tx)/zoom;x+=spacing)
      for(let y=Math.floor(-ty/zoom/spacing)*spacing;y<(height-ty)/zoom;y+=spacing){ctx.beginPath();ctx.arc(x,y,.65/Math.sqrt(zoom),0,Math.PI*2);ctx.fill();}
    const id=focusId();
    function links(active){
      for(const {a,b} of edges){
        const incident=id===a.item.id||id===b.item.id;
        if(incident!==active)continue;
        const faded=(id&&!incident)||(matches&&!matches.has(a.item.id)&&!matches.has(b.item.id));
        ctx.strokeStyle=incident?'#a65436':faded?'#64776822':'#60766565';
        ctx.lineWidth=(incident?1.65:.85)/Math.sqrt(zoom);
        ctx.beginPath();ctx.moveTo(a.ax,a.ay);ctx.lineTo(b.ax,b.ay);ctx.stroke();
      }
    }
    links(false);links(true);
    layer.setAttribute('transform',`translate(${tx} ${ty}) scale(${zoom})`);
  }
  function fit(){
    fitted=true;
    zoom=fitScale;tx=(width-bounds.w*zoom)/2-bounds.x*zoom;ty=(height-bounds.h*zoom)/2-bounds.y*zoom;
    schedule();
  }
  function resize(){
    const newWidth=surface.clientWidth,newHeight=surface.clientHeight;
    if(newWidth<1||newHeight<1)return;
    const oldWidth=width,oldHeight=height;width=newWidth;height=newHeight;
    const padding=Math.min(25,width*.035);
    fitScale=Math.min((width-2*padding)/Math.max(bounds.w,1),(height-2*padding)/Math.max(bounds.h,1),1.65);
    if(fitted || !oldWidth)fit();
    else{tx+=(width-oldWidth)/2;ty+=(height-oldHeight)/2;schedule();}
  }
  function zoomAt(factor,x,y){
    const z=Math.max(fitScale*.7,Math.min(Math.max(4,fitScale*3),zoom*factor));
    tx=x-(x-tx)*z/zoom;ty=y-(y-ty)*z/zoom;zoom=z;fitted=false;schedule();
  }
  function reveal(n){
    if(!n)return;
    const x=tx+n.x*zoom,y=ty+n.y*zoom;
    if(x<22||x>width-22||y<22||y>height-22){tx=width/2-n.x*zoom;ty=height/2-n.y*zoom;fitted=false;schedule();}
  }
  function locate(id){
    const n=byId.get(id);if(!n)return;
    zoom=Math.max(zoom,1.15);tx=width/2-n.x*zoom;ty=height/2-n.y*zoom;fitted=false;schedule();
  }
  function coords(event){const r=surface.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  function gesture(){
    const [a,b]=pointers.values();if(!a)return null;
    return b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(b.x-a.x,b.y-a.y)}:{...a,d:0};
  }
  surface.addEventListener('wheel',e=>{
    e.preventDefault();const {x,y}=coords(e);
    const delta=e.deltaMode===1?e.deltaY*16:e.deltaY;
    zoomAt(Math.exp(-Math.max(-140,Math.min(140,delta))*.004),x,y);
  },{...opt,passive:false});
  surface.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    pointers.set(e.pointerId,coords(e));drag={last:gesture(),origin:coords(e)};
    if(pointers.size===1)suppressClick=false;
    else suppressClick=true;
    // Capture on the pressed target so a real tap still activates its button.
    e.target.setPointerCapture(e.pointerId);
  },opt);
  surface.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!drag)return;
    pointers.set(e.pointerId,coords(e));const now=gesture(),old=drag.last;
    if(!suppressClick && Math.hypot(now.x-drag.origin.x,now.y-drag.origin.y)<4)return;
    suppressClick=true;hovered=null;surface.style.cursor='grabbing';fitted=false;
    if(now.d>0&&old.d>0)zoomAt(now.d/old.d,old.x,old.y);
    tx+=now.x-old.x;ty+=now.y-old.y;drag.last=now;schedule();
  },opt);
  function release(e){
    pointers.delete(e.pointerId);
    if(pointers.size){const pos=gesture();drag={last:pos,origin:pos};return;}
    drag=null;surface.style.cursor='grab';highlight();
  }
  surface.addEventListener('pointerup',release,opt);surface.addEventListener('pointercancel',release,opt);
  const observer=new ResizeObserver(resize);observer.observe(surface);resize();highlight();
  return {
    select(id){selected=byId.has(id)?id:null;hovered=null;focused=null;highlight();},
    find(ids){matches=ids==null?null:new Set(ids);highlight();},
    locate,fit,zoom:factor=>zoomAt(factor,width/2,height/2),
    destroy(){disposed=true;signal.abort();observer.disconnect();cancelAnimationFrame(frame);surface.remove();}
  };
}
