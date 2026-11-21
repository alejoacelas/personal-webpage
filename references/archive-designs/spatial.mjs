const svgNS = 'http://www.w3.org/2000/svg';
const renders = new WeakMap();
const safeColor = value => CSS.supports('color', value) ? value : '#d5bc88';

function element(tag, attributes = {}, text = '') {
  const el = document.createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  if (text) el.textContent = text;
  return el;
}

function positions(nodes, width) {
  const narrow = width < 570;
  const columns = Math.min(nodes.length, narrow ? 2 : width < 850 ? 3 : 4) || 1;
  const rows = Math.ceil(nodes.length / columns);
  const rowHeight = narrow ? 130 : 140;
  const height = Math.max(narrow ? 260 : Math.min(410,width*.45), rows * rowHeight + 25);
  // Alternating folds give the labels breathing room without imposing a visible grid.
  const stagger = [0, -.10, .09, -.04];
  let centers = nodes.map((_, i) => {
    const row = Math.floor(i / columns);
    const n = Math.min(columns, nodes.length - row * columns);
    const col = i % columns;
    return [(col + .5) / n, (row + .5 + stagger[col]) / rows];
  });
  if (!narrow && nodes.length === 5) {
    centers = [[.16,.34],[.48,.23],[.83,.30],[.31,.75],[.70,.72]];
  }
  const cellWidth = width / (nodes.length === 5 && !narrow ? 3 : columns);
  return {height, nodes:nodes.map((item,i) => ({
    item, x:Math.round(centers[i][0]*width), y:Math.round(centers[i][1]*height),
    labelWidth:Math.min(cellWidth - (narrow ? 16 : 20), 236)
  }))};
}

// Clip each hit region at the perpendicular bisector to its neighbour.
function territory(node, all, width, height) {
  let polygon = [[0,0],[width,0],[width,height],[0,height]];
  for (const other of all) {
    if (other === node) continue;
    const dx = other.x - node.x, dy = other.y - node.y;
    const midpoint = (other.x**2 + other.y**2 - node.x**2 - node.y**2)/2;
    const distance = ([x,y]) => dx*x + dy*y - midpoint;
    const clipped = [];
    for (let i=0; i<polygon.length; i++) {
      const a=polygon[i], b=polygon[(i+1)%polygon.length];
      const da=distance(a), db=distance(b);
      if (da<=0) clipped.push(a);
      if ((da<=0)!==(db<=0)) {
        const t=da/(da-db);
        clipped.push([a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])]);
      }
    }
    polygon=clipped;
  }
  return polygon.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
}

function terrain(background, all, w, h) {
  const cell=7, cols=Math.ceil(w/cell), rows=Math.ceil(h/cell);
  const stepX=w/cols, stepY=h/rows;
  const rx=Math.max(72,Math.min(w*.23,w/Math.sqrt(all.length||1)*.39));
  const ry=Math.min(h*.30,rx*.8);
  const field=[];
  for(let j=0;j<=rows;j++){
    const line=[];
    for(let i=0;i<=cols;i++){
      const x=i*stepX, y=j*stepY;
      const warpX=10*Math.sin(y*.027)+5*Math.sin((x+y)*.043);
      const warpY=13*Math.cos(x*.023)+5*Math.sin((x-y)*.031);
      let hill=0;
      for(const n of all){
        const dx=(x-n.x+warpX)/rx, dy=(y-n.y+warpY)/ry;
        hill+=Math.exp(-(dx*dx+dy*dy)*1.5);
      }
      const edge=Math.min(1,x/(w*.055),y/(h*.13),(w-x)/(w*.055),(h-y)/(h*.13));
      line.push(Math.max(0,(hill+.045*Math.sin(x*.043+y*.032))*edge));
    }
    field.push(line);
  }
  // Join isoline segments into rings so contours across adjacent summits merge.
  const levels=[.045,.09,.14,.23,.32,.41,.50,.59,.68,.77,.86,.95,1.04,1.13];
  const colors=['#a3c4c1','#a9c9c5','#b3cfc5','#c4d6bc','#d3dec1','#dce3be','#e5e4ba','#e9dfb0',
    '#eee1b8','#e8d5a7','#e2c99d','#dcbd91','#d9b78d','#d7b38b'];
  levels.forEach((level,k)=>{
    const paths=new Map(), points=new Map();
    function connect(a,b) {
      if(!paths.has(a)) paths.set(a,[]);
      if(!paths.has(b)) paths.set(b,[]);
      paths.get(a).push(b); paths.get(b).push(a);
    }
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
      const hits=[];
      corners.forEach(([a,b],index)=>{
        const [c,d]=corners[(index+1)%4];
        const from=field[b][a], to=field[d][c];
        if ((from<level)===(to<level)) return;
        const key=(b===d?'h':'v')+Math.min(a,c)+':'+Math.min(b,d);
        if(!points.has(key)){
          const t=(level-from)/(to-from);
          points.set(key,[(a+(c-a)*t)*stepX,(b+(d-b)*t)*stepY].map(v=>v.toFixed(1)).join(','));
        }
        hits.push(key);
      });
      if(hits.length>=2)connect(hits[0],hits[1]);
      if(hits.length===4)connect(hits[2],hits[3]);
    }
    const seen=new Set(), pieces=[];
    for(const start of paths.keys()){
      if(seen.has(start))continue;
      let current=start, previous;
      const loop=[];
      while(current && !seen.has(current)){
        seen.add(current);loop.push(points.get(current));
        const next=paths.get(current).find(v=>v!==previous);
        previous=current;current=next;
      }
      if(loop.length>2)pieces.push('M'+loop.join('L')+'Z');
    }
    background.append(element('path',{d:pieces.join(''),fill:colors[k],'fill-rule':'evenodd',
      stroke:k%3===0?'#7c927a':'#9aa084','stroke-width':k%3===0?.9:.55}));
  });
}

function orbitalPaths(background, all, w, h) {
  const cx=w*.49, cy=h*.46;
  const stars=element('g',{fill:'#d7e0ef'});
  for(let i=1;i<Math.round(w*h/1450);i++){
    const x=((i*509)%997)/997*w, y=((i*i*29+i*17)%991)/991*h;
    stars.append(element('circle',{cx:x,cy:y,r:i%9===0?1:.55,opacity:.25+(i%5)*.11}));
  }
  background.append(stars);
  const rings=new Map();
  all.forEach((n,i)=>{
    const angle=(-31+(i%5)*11)*Math.PI/180;
    const dx=n.x-cx, dy=(n.y-17)-cy;
    const tx=dx*Math.cos(angle)+dy*Math.sin(angle), ty=-dx*Math.sin(angle)+dy*Math.cos(angle);
    const ratio=.39+(i%4)*.10;
    const rx=Math.max(12,Math.hypot(tx,ty/ratio));
    const ring=element('ellipse',{cx,cy,rx,ry:rx*ratio,transform:`rotate(${angle*180/Math.PI} ${cx} ${cy})`,
      fill:'none',stroke:safeColor(n.item.color),'stroke-width':1,opacity:.38});
    background.append(ring);rings.set(n,ring);
  });
  // Companion points mark the far arc of each orbit at its true inclination.
  all.forEach((n,i)=>{
    const angle=(-31+(i%5)*11)*Math.PI/180;
    const dx=n.x-cx,dy=n.y-17-cy;
    const rx=dx*Math.cos(angle)+dy*Math.sin(angle),ry=-dx*Math.sin(angle)+dy*Math.cos(angle);
    const ratio=.39+(i%4)*.10, t=1.05+i*.32;
    const x=rx*Math.cos(t)-ry/ratio*Math.sin(t), y=rx*ratio*Math.sin(t)+ry*Math.cos(t);
    background.append(element('circle',{cx:cx+x*Math.cos(angle)-y*Math.sin(angle),cy:cy+x*Math.sin(angle)+y*Math.cos(angle),
      r:2.4,fill:safeColor(n.item.color),opacity:.8}));
  });
  const hub=element('g',{transform:`translate(${cx} ${cy})`,fill:'none',stroke:'#e9d4a2'});
  [5,11,24,40].forEach((r,i)=>hub.append(element('circle',{r,opacity:[.94,.48,.17,.09][i],'stroke-width':i===1?2:1})));
  hub.append(element('circle',{r:3,fill:'#fff0cf',stroke:'none'}));
  background.append(hub);
  return rings;
}

function wrap(text, width, size, family) {
  const ctx=document.createElement('canvas').getContext('2d');
  ctx.font=`600 ${size}px ${family}`;
  // Long unbroken tokens may occur in tool names.
  const words=String(text).split(/\s+/).flatMap(word=>{
    const parts=[];let part='';
    for(const c of word){if(part&&ctx.measureText(part+c).width>width){parts.push(part);part='';}part+=c;}
    if(part)parts.push(part);return parts;
  });
  const lines=[];let line='';
  for(const word of words){
    const test=line?line+' '+word:word;
    if(line&&ctx.measureText(test).width>width){lines.push(line);line=word;}else line=test;
  }
  if(line)lines.push(line);
  if(lines.length>3){
    lines.length=3; let tail=lines[2];
    while(tail.length && ctx.measureText(tail+'…').width>width)tail=tail.slice(0,-1);
    lines[2]=tail.trimEnd()+'…';
  }
  return lines;
}

function depth(value) {
  if(typeof value==='number')return value;
  return ({root:0,region:1,topic:2,item:3})[value] ?? 0;
}

export function renderMap(container,{mode,nodes,level,focus,onSelect,onUp}) {
  const previous=renders.get(container);
  previous?.dispose();
  const state={level,mode};
  renders.set(container,state);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const isTerrain=mode==='terrain';
  const source=nodes.slice(0,12);
  const controller=new AbortController(), eventOptions={signal:controller.signal};
  let width=0, resize, scene, chart, plotted=[], selectionAnimation, running=false;
  let lastFocused, disposed=false;
  const style=document.createElement('style');
  style.textContent=`
    .spatial-map{display:block;width:100%;height:auto;overflow:hidden;touch-action:pan-y;color-scheme:light}
    .spatial-map [role=button]{cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}
    .spatial-map .ground-hit{fill:transparent;stroke:transparent}
    .spatial-map .legend-marker{transition:transform 150ms}
    .spatial-map .territory:is(:hover,:focus-visible) .legend-marker{transform:scale(1.22)}
    .spatial-map .territory:focus-visible .focus-ring{opacity:1}
    .spatial-map .territory:hover .point-label{text-decoration:underline;text-underline-offset:3px}
    @media(prefers-reduced-motion:reduce){.spatial-map *{transition:none!important}}
  `;
  function camera(frames,duration){
    if(reduced.matches || !scene.animate)return;
    selectionAnimation=scene.animate(frames,{duration,easing:'cubic-bezier(.27,.05,.24,1)',fill:'both'});
    return selectionAnimation;
  }
  function activate(n,up=false){
    if(running || disposed || (up && !onUp))return;
    running=true;lastFocused=n?.item.id;
    const scale=up?.57:2.7;
    const h=chart.viewBox.baseVal.height;
    const x=n?.x ?? width/2, y=n?.y ?? h/2;
    const transform=`translate(${width/2-x*scale}px,${h/2-y*scale}px) scale(${scale})`;
    selectionAnimation?.cancel();
    const animation=camera([{transform:'none',opacity:1},{transform,opacity:.12}],up?220:360);
    const done=()=>{
      if(disposed)return;
      running=false;
      try { if(up)onUp();else onSelect(n.item.id); }
      finally { animation?.cancel(); }
    };
    if(animation)animation.onfinish=done;else done();
  }
  function draw(){
    if(disposed || running)return;
    const w=Math.max(100,Math.round(container.getBoundingClientRect().width));
    if(w===width)return;
    const hadFocus=container.contains(document.activeElement);
    width=w;
    const layout=positions(source,w), h=layout.height;plotted=layout.nodes;
    chart=element('svg',{class:'spatial-map',viewBox:`0 0 ${w} ${h}`,role:'group','aria-label':isTerrain?'Terrain map':'Orbital map',
      style:`background:${isTerrain?'#96babb':'#121627'}`});
    scene=element('g'); scene.style.transformOrigin='0 0';
    const bg=element('g',{'aria-hidden':'true'}); scene.append(bg);chart.append(scene);
    let rings;
    if(isTerrain)terrain(bg,plotted,w,h);else rings=orbitalPaths(bg,plotted,w,h);
    const family=isTerrain?'Georgia, serif':'system-ui, sans-serif';
    const size=w<570?15:w<850?16:19;
    const controls=[];
    plotted.forEach((n,i)=>{
      const color=safeColor(n.item.color);
      const group=element('g',{role:'button',tabindex:'0',class:'territory','aria-label':n.item.label+(n.item.kind==='item'?'':', '+n.item.count+' items')});
      group.append(element('title',{},n.item.label));
      group.append(element('polygon',{class:'ground-hit',points:territory(n,plotted,w,h)}));
      const center=element('g',{transform:`translate(${n.x} ${n.y-17})`,'pointer-events':'none'});
      center.append(element('circle',{class:'focus-ring',r:15,fill:'none',stroke:isTerrain?'#183d36':'#fff7d2','stroke-width':2,'stroke-dasharray':'2 2',opacity:0}));
      const marker=element('g',{class:'legend-marker'});
      if(isTerrain){
        marker.append(element('path',{d:'M0,-7 6,0 0,7 -6,0Z',fill:'#213e37',stroke:'#f6ebc8','stroke-width':1.5}));
        marker.append(element('circle',{r:1.6,fill:'#fbf5d8'}));
      }else{
        marker.append(element('circle',{r:12,fill:color,opacity:.13}));
        marker.append(element('circle',{r:6,fill:color,stroke:'#dee9f5','stroke-width':.8}));
        marker.append(element('circle',{cx:-1.7,cy:-1.9,r:2.6,fill:'#fff',opacity:.46}));
      }
      center.append(marker);
      group.append(center);
      const text=element('text',{class:'point-label',x:n.x,y:n.y+7,'pointer-events':'none','text-anchor':'middle',
        fill:isTerrain?'#243c31':'#f6edf0',stroke:isTerrain?'#e8e5bf':'#16182b','stroke-width':isTerrain?3:4,
        'stroke-linejoin':'round','paint-order':'stroke','font-family':family,'font-weight':'600','font-size':size});
      const lines=wrap(n.item.label,n.labelWidth,size,family);
      lines.forEach((line,i)=>text.append(element('tspan',{x:n.x,dy:i===0?0:size*1.1},line)));
      group.append(text);
      if(n.item.kind!=='item'){
        const count=element('text',{x:n.x,y:n.y+23+(lines.length-1)*size*1.1,'text-anchor':'middle',
          'font-family':'ui-monospace, monospace','font-size':10,fill:isTerrain?'#314436':'#c5ccdc',
          stroke:isTerrain?'#e3dfbd':'#181b2c','stroke-width':2.6,'paint-order':'stroke'},String(n.item.count)+' '+(n.item.count===1?'item':'items'));
        group.append(count);
      }
      const ring=rings?.get(n);
      const highlight=on=>{if(ring){ring.setAttribute('opacity',on?'.95':'.38');ring.setAttribute('stroke-width',on?'1.8':'1');}};
      group.addEventListener('pointerenter',()=>highlight(true));
      group.addEventListener('pointerleave',()=>highlight(false));
      group.addEventListener('focus',()=>{lastFocused=n.item.id;highlight(true);});
      group.addEventListener('blur',()=>highlight(false));
      group.addEventListener('click',()=>activate(n));
      group.addEventListener('keydown',event=>{
        if(['Enter',' '].includes(event.key)){event.preventDefault();activate(n);return;}
        const next={ArrowRight:i+1,ArrowDown:i+1,ArrowLeft:i-1,ArrowUp:i-1,Home:0,End:plotted.length-1}[event.key];
        if(next!==undefined){event.preventDefault();controls[(next+plotted.length)%plotted.length].focus();}
      });
      scene.append(group);controls.push(group);
    });
    container.replaceChildren(style,chart);
    if(hadFocus){ const i=plotted.findIndex(n=>n.item.id===lastFocused);controls[Math.max(0,i)]?.focus({preventScroll:true}); }
  }
  draw();
  const oldDepth=depth(previous?.level), newDepth=depth(level);
  if(previous && previous.mode===mode && oldDepth!==newDepth){
    let transform='scale(.74)';
    if(newDepth<oldDepth){
      const node=plotted.find(n=>n.item.id===focus) || plotted.find(n=>n.item.id===previous.parent);
      const h=chart.viewBox.baseVal.height;
      transform=`translate(${width/2-(node?.x??width/2)*1.75}px,${h/2-(node?.y??h/2)*1.75}px) scale(1.75)`;
    } else {
      transform=`translate(${width*.13}px,${chart.viewBox.baseVal.height*.13}px) scale(.74)`;
    }
    const intro=camera([{transform,opacity:.4},{transform:'none',opacity:1}],290);
    if(intro)intro.onfinish=()=>intro.cancel();
  }
  state.parent=focus;
  function nearest(x,y){
    const rect=chart.getBoundingClientRect();
    const px=(x-rect.left)*width/rect.width,py=(y-rect.top)*chart.viewBox.baseVal.height/rect.height;
    return plotted.reduce((best,n)=>!best||Math.hypot(n.x-px,n.y-py)<Math.hypot(best.x-px,best.y-py)?n:best,null);
  }
  container.addEventListener('wheel',event=>{
    if(!event.ctrlKey)return;
    event.preventDefault();
    if(Math.abs(event.deltaY)<2)return;
    const n=nearest(event.clientX,event.clientY);
    if(n)activate(n,event.deltaY>0);
  },{...eventOptions,passive:false});
  let pinch;
  const distance=([a,b])=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  container.addEventListener('touchstart',e=>{
    if(e.touches.length!==2)return;
    const [a,b]=e.touches;e.preventDefault();
    pinch={initial:distance(e.touches),node:nearest((a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2)};
  },{...eventOptions,passive:false});
  container.addEventListener('touchmove',e=>{
    if(!pinch || e.touches.length!==2)return;
    e.preventDefault();
    const scale=distance(e.touches)/pinch.initial;
    if(pinch.node && (scale>1.19 || scale<.84)){const n=pinch.node;pinch=null;activate(n,scale<1);}
  },{...eventOptions,passive:false});
  container.addEventListener('touchend',()=>{pinch=null;},eventOptions);
  resize=new ResizeObserver(draw);resize.observe(container);
  state.dispose=()=>{
    disposed=true;controller.abort();resize.disconnect();selectionAnimation?.cancel();
  };
  return state.dispose;
}
