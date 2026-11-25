import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
};
const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const prettyDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline listed';
const normalizedWords = value => String(value || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter(word => word.length > 2);
const matchScore = (mine, theirs) => { const a = new Set(normalizedWords(mine)); const b = new Set(normalizedWords(theirs)); if (!a.size || !b.size) return 0; let common = 0; for (const word of a) if (b.has(word)) common++; return Math.min(100, Math.round(common / Math.max(1, Math.min(a.size, b.size)) * 100)); };


function AppleLaunch({ onNavigate, user }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      const next = Math.max(0, Math.min(1, -rect.top / travel));
      progressRef.current = next;
      setProgress(previous => Math.abs(previous - next) < 0.001 ? previous : next);
      raf = 0;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (raf) cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    let width = 0, height = 0, dpr = 1, frame = 0, alive = true;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    // Deterministic point field: one signal -> orbit -> branching network -> ecosystem.
    let seed = 9137;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const count = 520;
    const points = Array.from({ length: count }, (_, i) => {
      const u = (i + .5) / count;
      const theta = i * 2.3999632297;
      const y = 1 - 2 * u;
      const radius = Math.sqrt(1 - y * y);
      return {
        u, theta, seed: random(), size: .65 + random() * 1.45,
        sphere: [Math.cos(theta) * radius, y, Math.sin(theta) * radius]
      };
    });
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const smooth = (a, b, v) => { const x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const project = (point, rotation, scale, cx, cy) => {
      const ca = Math.cos(rotation), sa = Math.sin(rotation);
      const x = point[0] * ca - point[2] * sa;
      const z = point[0] * sa + point[2] * ca;
      const tilt = -.27;
      const y = point[1] * Math.cos(tilt) - z * Math.sin(tilt);
      const depth = point[1] * Math.sin(tilt) + z * Math.cos(tilt);
      const perspective = 3.8 / (3.8 + depth * .72);
      return { x: cx + x * scale * perspective, y: cy + y * scale * perspective, z: depth, perspective };
    };
    const shapes = point => {
      const [x, y, z] = point.sphere, a = point.theta;
      const orbit = [Math.cos(a) * .94, Math.sin(a * 2.3) * .14, Math.sin(a) * .5];
      const branch = Math.floor(point.u * 8), branchAngle = branch / 8 * Math.PI * 2;
      const along = (point.u * 8) % 1, radius = .12 + along * 1.02;
      const graph = [Math.cos(branchAngle) * radius, (along - .5) * .62, Math.sin(branchAngle) * radius];
      const ecosystem = [Math.cos(a) * (.34 + .82 * point.seed), Math.sin(a * 3) * (.22 + .5 * point.u), Math.sin(a) * (.34 + .82 * (1 - point.seed))];
      return { sphere: [x * .78, y * .78, z * .78], orbit, graph, ecosystem };
    };
    const draw = now => {
      if (!alive) return;
      const p = reduceMotion ? .76 : progressRef.current;
      const cx = width * .52, cy = height * .49;
      const scale = Math.min(width, height) * (width < 650 ? .36 : .34);
      const rotation = (reduceMotion ? 0 : now * .00012) + p * 1.8;
      const stage = p < .34 ? 0 : p < .68 ? 1 : 2;
      const projected = points.map(point => {
        const forms = shapes(point);
        let position;
        if (p < .34) position = mix(forms.sphere, forms.orbit, smooth(0, .34, p));
        else if (p < .68) position = mix(forms.orbit, forms.graph, smooth(.34, .68, p));
        else position = mix(forms.graph, forms.ecosystem, smooth(.68, 1, p));
        if (!reduceMotion) position[1] += .018 * Math.sin(now * .001 + point.theta * 2);
        return { ...project(position, rotation, scale, cx, cy), id: point.u, size: point.size };
      }).sort((a, b) => a.z - b.z);

      ctx.clearRect(0, 0, width, height);
      // Soft orbital guide lines fade as the network expands.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-.3 + p * .18);
      ctx.strokeStyle = `rgba(105,119,91,${.10 * (1 - smooth(.38, .8, p))})`;
      ctx.lineWidth = 1;
      for (const radius of [.48, .72, 1]) {
        ctx.beginPath(); ctx.ellipse(0, 0, scale * radius, scale * radius * .55, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();

      const threshold = scale * (.17 + p * .13);
      for (let i = 0; i < projected.length; i += 2) {
        const a = projected[i];
        let links = 0;
        for (let j = i + 3; j < projected.length && links < (stage === 0 ? 1 : 3); j += 3) {
          const b = projected[j], distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < threshold) {
            const alpha = (1 - distance / threshold) * (.12 + p * .20);
            ctx.strokeStyle = `rgba(117,139,83,${alpha})`;
            ctx.lineWidth = stage === 2 ? .8 : .6;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            links++;
          }
        }
      }
      projected.forEach(point => {
        const depth = .42 + (point.z + 1) * .25;
        const alpha = clamp(depth + point.size * .025, .18, .92);
        const radius = Math.max(.75, point.size * point.perspective * (p > .68 ? 1.12 : 1));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = point.id % 5 === 0 ? '#91b9d8' : point.id % 3 === 0 ? '#b5a6e8' : '#879b68';
        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // A central signal remains visible as the surrounding system grows.
      const core = project([0, 0, 0], rotation, scale, cx, cy);
      const glow = ctx.createRadialGradient(core.x, core.y, 1, core.x, core.y, scale * .22);
      glow.addColorStop(0, 'rgba(224,232,205,.75)');
      glow.addColorStop(1, 'rgba(224,232,205,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(core.x, core.y, scale * .22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f9fbf1'; ctx.beginPath(); ctx.arc(core.x, core.y, 3.2, 0, Math.PI * 2); ctx.fill();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);

  const chapters = [
    { at: 0, label: 'INTRODUCING ORBITLE', title: 'Good things happen\ntogether.', body: 'A place for ambitious people to find each other — and make something real.' },
    { at: .24, label: 'A BETTER WAY TO MEET', title: 'Start with a\nconnection.', body: 'Find people through shared interests, skills and the things you want to create.' },
    { at: .49, label: 'FROM POSSIBILITY TO PROGRESS', title: 'Ideas need\neach other.', body: 'Bring the right people into a project, a community or a new possibility.' },
    { at: .74, label: 'MADE TO MOVE YOU FORWARD', title: 'Make your next\nmove matter.', body: 'Discover your people. Build in public. Find the opportunity that changes what comes next.' }
  ];
  const chapter = [...chapters].reverse().find(item => progress >= item.at) || chapters[0];
  return <section className="apple-journey" ref={sectionRef} aria-label="Discover ORBITLE">
    <div className="apple-journey-sticky">
      <div className="apple-journey-top"><a href="#top" onClick={event => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>ORBITLE<span>®</span></a><span>PEOPLE · IDEAS · POSSIBILITY</span><button onClick={() => onNavigate('Network')}>Explore the network <b>↗</b></button></div>
      <div className="apple-journey-copy" key={chapter.label}>
        <div className="apple-eyebrow"><i/> {chapter.label}</div>
        <h2>{chapter.title.split('\n').map((line, index) => <React.Fragment key={line}>{index > 0 && <br/>}{line}</React.Fragment>)}</h2>
        <p>{chapter.body}</p>
        {progress < .08 && <div className="apple-hero-actions"><button onClick={() => onNavigate(user ? 'Network' : 'Projects')}>Discover ORBITLE <span>↗</span></button><span>Scroll to explore</span></div>}
      </div>
      <div className="apple-object-stage" aria-hidden="true">
        <canvas ref={canvasRef} className="orbitle-network-canvas" />
        <div className="apple-object-caption">A NETWORK, IN MOTION</div>
      </div>
      <div className="apple-journey-bottom"><span>SCROLL TO DISCOVER</span><div><i style={{ transform: `scaleX(${progress})` }}/></div><span>{Math.round(progress * 100).toString().padStart(2, '0')}%</span></div>
    </div>
  </section>;
}

function CinematicUniverse({ orbits, projects, opportunities, people, onNavigate, onJoin, onConnect, onMessage, user }) {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const reducedMotion = useRef(false);

  const nodes = useMemo(() => [
    ...orbits.slice(0, 8).map((o, i) => ({ id:`orbit-${o.id}`, type:'Communities', title:o.name, detail:o.description || 'A community on ORBITLE', route:'My Orbits', record:o, angle:i*2.399, tint:[0.52,0.53,0.49] })),
    ...projects.slice(0, 6).map((p, i) => ({ id:`project-${p.id}`, type:'Projects', title:p.title, detail:p.summary || 'A project taking shape', route:'Projects', record:p, angle:i*2.399+0.7, tint:[0.35,0.36,0.33] })),
    ...opportunities.slice(0, 6).map((o, i) => ({ id:`opportunity-${o.id}`, type:'Opportunities', title:o.title, detail:o.organization || o.category || 'Opportunity', route:'Opportunities', record:o, angle:i*2.399+1.4, tint:[0.62,0.62,0.57] })),
    ...(user ? people.slice(0, 8).map((person, i) => ({ id:`person-${person.id}`, type:'People', title:person.name, detail:person.bio || (person.interests || []).slice(0, 3).join(' · ') || 'ORBITLE member', route:'Network', record:person, angle:i*2.399+2.1, tint:[0.45,0.46,0.42] })) : [])
  ], [orbits, projects, opportunities, people, user]);

  const visibleNodes = nodes.filter(n => (filter === 'All' || n.type === filter) && `${n.title} ${n.detail} ${n.type}`.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      // The timeline is mapped directly to document scroll: no time-based tween,
      // no wheel hijacking, and no accumulated animation drift. Reverse scroll
      // therefore retraces the exact same camera path.
      const next = reducedMotion.current ? 0.78 : Math.max(0, Math.min(1, -rect.top / travel));
      if (canvasRef.current) canvasRef.current.dataset.progress = String(next);
      setProgress(old => Math.abs(old - next) < 0.001 ? old : next);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
    update();
    window.addEventListener('scroll', schedule, { passive:true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias:true, alpha:false, powerPreference:'high-performance' });
    if (!gl) { canvas.dataset.fallback = 'true'; setWebglFailed(true); return; }
    const vertexSource = `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      attribute float aSize;
      uniform mat4 uMvp;
      uniform float uPointScale;
      varying vec3 vColor;
      varying float vDepth;
      varying vec3 vLocal;
      void main(){
        vec4 pos = uMvp * vec4(aPosition,1.0);
        gl_Position = pos;
        gl_PointSize = max(1.0, aSize * uPointScale / max(0.35, pos.w));
        vColor = aColor;
        vDepth = pos.w;
        vLocal = aPosition;
      }`;
    const fragmentSource = `
      precision mediump float;
      varying vec3 vColor;
      varying float vDepth;
      varying vec3 vLocal;
      uniform float uKind;
      uniform float uTime;
      void main(){
        if(uKind > 1.5){
          vec2 q = gl_PointCoord - vec2(0.5);
          float r = length(q);
          if(r > 0.5) discard;
          float glow = 1.0 - smoothstep(0.03,0.5,r);
          gl_FragColor = vec4(vColor, glow);
        } else if(uKind > 0.5) {
          gl_FragColor = vec4(vColor, 0.65);
        } else {
          vec3 n = normalize(vLocal);
          float light = max(0.0, dot(n, normalize(vec3(-0.55,0.35,0.9))));
          float bands = sin((vLocal.x*11.0 + vLocal.y*6.0) * 3.14159) * 0.035;
          float shade = 0.16 + light*0.9 + bands;
          float rim = pow(1.0 - max(0.0,n.z), 2.5);
          gl_FragColor = vec4(vColor*shade + vec3(0.20,0.20,0.18)*rim, 1.0);
        }
      }`;
    const compile = (type, source) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, vertexSource), fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) { canvas.dataset.fallback = 'true'; setWebglFailed(true); return; }
    const program = gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) { canvas.dataset.fallback = 'true'; setWebglFailed(true); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); return; }
    setWebglFailed(false);
    gl.useProgram(program);
    const loc = { position:gl.getAttribLocation(program,'aPosition'), color:gl.getAttribLocation(program,'aColor'), size:gl.getAttribLocation(program,'aSize'), mvp:gl.getUniformLocation(program,'uMvp'), scale:gl.getUniformLocation(program,'uPointScale'), kind:gl.getUniformLocation(program,'uKind'), time:gl.getUniformLocation(program,'uTime') };
    const sphere = [];
    const latN=42, lonN=64;
    for(let y=0;y<latN;y++) for(let x=0;x<lonN;x++){
      const point=(yy,xx)=>{const v=yy/latN*Math.PI-Math.PI/2,u=xx/lonN*Math.PI*2;return [Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)]};
      const a=point(y,x), b=point(y+1,x), c=point(y,x+1), d=point(y+1,x+1);
      sphere.push(...a,...b,...c,...c,...b,...d);
    }
    const sphereData = new Float32Array(sphere);
    const stars = [];
    let seed=73; const rand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
    for(let i=0;i<1050;i++){const z=rand()*2-1,a=rand()*Math.PI*2,r=8+rand()*22,rr=Math.sqrt(1-z*z);stars.push(Math.cos(a)*rr*r,z*r,Math.sin(a)*rr*r,0.58+rand()*0.35,0.58+rand()*0.35,0.55+rand()*0.35,1+rand()*1.3);}
    const starData = new Float32Array(stars);
    const ringBuffers = [];
    for(let ring=0;ring<3;ring++){const arr=[];for(let i=0;i<=180;i++){const a=i/180*Math.PI*2;arr.push(Math.cos(a)*(1.65+ring*.52), Math.sin(a)*(.48+ring*.22), Math.sin(a)*(1.65+ring*.52));} ringBuffers.push(new Float32Array(arr));}
    const makeBuffer = data => { const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW); return b; };
    const sphereBuffer=makeBuffer(sphereData), starBuffer=makeBuffer(starData), ringBufferList=ringBuffers.map(makeBuffer), lineDynamicBuffer=gl.createBuffer(), nodeDynamicBuffer=gl.createBuffer();
    const m4mul=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;};
    const perspective=(f,aspect,n,far)=>{const t=1/Math.tan(f/2);return new Float32Array([t/aspect,0,0,0,0,t,0,0,0,0,(far+n)/(n-far),-1,0,0,(2*far*n)/(n-far),0]);};
    const lookAt=(eye,center)=>{const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)}, sub=(a,b)=>a.map((x,i)=>x-b[i]), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const z=norm(sub(eye,center)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);};
    const draw=(dataBuffer,count,mode,mvp,kind,hasColor=true,stride=7,offset=0,pointScale=520)=>{
      gl.bindBuffer(gl.ARRAY_BUFFER,dataBuffer);
      gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,stride*4,0);
      if(hasColor){gl.enableVertexAttribArray(loc.color);gl.vertexAttribPointer(loc.color,3,gl.FLOAT,false,stride*4,12);gl.enableVertexAttribArray(loc.size);gl.vertexAttribPointer(loc.size,1,gl.FLOAT,false,stride*4,24);}
      else {gl.disableVertexAttribArray(loc.color);gl.vertexAttrib3f(loc.color,0.68,0.68,0.64);gl.disableVertexAttribArray(loc.size);gl.vertexAttrib1f(loc.size,1);}
      gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniform1f(loc.kind,kind);gl.uniform1f(loc.scale,pointScale);
      gl.drawArrays(mode,offset,count);
    };
    let frame=0, running=true, start=performance.now(), lastProgress=-1;
    const resize=()=>{const dpr=Math.min(window.devicePixelRatio||1,1.6),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);gl.viewport(0,0,canvas.width,canvas.height);};
    resize();window.addEventListener('resize',resize);
    const onPointerMove=e=>{if(reducedMotion.current || window.matchMedia('(pointer: coarse)').matches)return;const r=canvas.getBoundingClientRect();canvas.dataset.pointerX=String(((e.clientX-r.left)/Math.max(1,r.width)-.5)*2);canvas.dataset.pointerY=String(((e.clientY-r.top)/Math.max(1,r.height)-.5)*2);};
    const onPointerLeave=()=>{canvas.dataset.pointerX='0';canvas.dataset.pointerY='0';};
    const onContextLost=e=>{e.preventDefault();running=false;canvas.dataset.fallback='true';setWebglFailed(true);};
    canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerleave',onPointerLeave);canvas.addEventListener('webglcontextlost',onContextLost,false);
    const render=()=>{
      if(!running)return;
      const p=Number(canvas.dataset.progress||0), t=reducedMotion.current ? 0 : (performance.now()-start)*0.00015;
      gl.clearColor(0.965,0.965,0.945,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);
      const aspect=canvas.width/canvas.height, proj=perspective(0.78,aspect,0.1,100);
      const zoom=p<.2?9-p*12:p<.48?6.6-(p-.2)*10:3.8+(p-.48)*8;
      const pointerX=Number(canvas.dataset.pointerX||0), pointerY=Number(canvas.dataset.pointerY||0);
      const cameraX = p < .35 ? -1.15 * (p/.35) : p < .72 ? -1.15 + ((p-.35)/.37)*2.3 : 1.15 - ((p-.72)/.28)*1.15;
      const cameraY = p < .2 ? .42*(p/.2) : p < .55 ? .42 - ((p-.2)/.35)*.84 : -.42 + ((p-.55)/.45)*.42;
      const cam=[cameraX+Math.sin(p*5.3)*0.12+pointerX*0.08,cameraY+Math.sin(p*3.4)*0.08-pointerY*0.06,zoom];
      const mvp=m4mul(proj,lookAt(cam,[0,0,0]));
      gl.depthMask(true);
      draw(starBuffer,1050,gl.POINTS,mvp,2,true,7,0,16);
      const planetScale=p<.1?Math.max(.015,(p-.015)*8):p<.47?0.68+Math.sin(Math.min(1,(p-.1)/.37)*Math.PI)*0.2:p<.68?0.88*(1-(p-.47)/.21):0.02;
      if(planetScale>.025){
        const planetMvp=m4mul(mvp,new Float32Array([planetScale,0,0,0,0,planetScale,0,0,0,0,planetScale,0,0,0,0,1]));
        const rot=performance.now()*0.00012;
        const model=new Float32Array([Math.cos(rot)*planetScale,0,Math.sin(rot)*planetScale,0,0,planetScale,0,0,-Math.sin(rot)*planetScale,0,Math.cos(rot)*planetScale,0,0,0,0,1]);
        const pmvp=m4mul(mvp,model);
        gl.disable(gl.BLEND);draw(sphereBuffer,sphereData.length/3,gl.TRIANGLES,pmvp,0,false,3,0,520);gl.enable(gl.BLEND);
      }
      const ringFade=Math.max(0,Math.min(1,(p-.18)/.18))*(1-Math.max(0,Math.min(1,(p-.56)/.19)));
      if(ringFade>0){
        gl.lineWidth(1);
        ringBufferList.forEach((b,i)=>{const angle=t*(i===1?-0.9:0.55)+i*0.48,cs=Math.cos(angle),sn=Math.sin(angle);const ringMvp=m4mul(mvp,new Float32Array([cs,0,-sn,0,0,1,0,0,sn,0,cs,0,0,0,0,1]));gl.uniformMatrix4fv(loc.mvp,false,ringMvp);gl.uniform1f(loc.kind,1);gl.uniform1f(loc.scale,1);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,12,0);gl.disableVertexAttribArray(loc.color);gl.vertexAttrib3f(loc.color,0.34+ringFade*.12,0.35+ringFade*.12,0.32+ringFade*.12);gl.disableVertexAttribArray(loc.size);gl.vertexAttrib1f(loc.size,1);gl.drawArrays(gl.LINE_STRIP,0,181);});
        const orbitDots=[];for(let i=0;i<18;i++){const a=i/18*Math.PI*2+t*(i%2?1.1:-0.72),r=1.65+(i%3)*.48;orbitDots.push(Math.cos(a)*r,Math.sin(a)*(.5+(i%3)*.16),Math.sin(a)*r*.88,.65,.75,.94,2.4);}
        const orbitData=new Float32Array(orbitDots);gl.bindBuffer(gl.ARRAY_BUFFER,nodeDynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,orbitData,gl.DYNAMIC_DRAW);draw(nodeDynamicBuffer,orbitData.length/7,gl.POINTS,mvp,2,true,7,0,26);
      }
      const networkFade=Math.max(0,Math.min(1,(p-.48)/.22));
      if(networkFade>0){
        const positions=[];
        const count=Math.max(18,nodes.length);
        const nodePos=[];
        for(let i=0;i<count;i++){
          const a=i*2.399, r=1.25+(i%4)*.36, z=Math.sin(i*1.73)*.85;
          const orbit=[Math.cos(a)*r,Math.sin(a*.7)*.45,z+Math.sin(a)*r*.3];
          const spread=[Math.cos(a)*r*1.9,Math.sin(a)*r*1.25,z*1.8];
          nodePos.push(orbit.map((v,j)=>v*(1-networkFade)+spread[j]*networkFade));
        }
        for(let i=0;i<nodePos.length;i++)for(let j=i+1;j<nodePos.length;j++)if((j-i===1)||(j-i===4)){positions.push(...nodePos[i],...nodePos[j]);}
        const lineData=new Float32Array(positions);gl.bindBuffer(gl.ARRAY_BUFFER,lineDynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,lineData,gl.DYNAMIC_DRAW);gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniform1f(loc.kind,1);gl.uniform1f(loc.scale,1);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,12,0);gl.disableVertexAttribArray(loc.color);gl.vertexAttrib3f(loc.color,.38,.39,.35);gl.disableVertexAttribArray(loc.size);gl.vertexAttrib1f(loc.size,1);gl.drawArrays(gl.LINES,0,positions.length/3);
        const nd=[];for(let i=0;i<nodePos.length;i++){const tint=nodes[i%nodes.length]?.tint||[.7,.8,.95];nd.push(...nodePos[i],...tint,6+networkFade*4);}
        const nodeData=new Float32Array(nd);gl.bindBuffer(gl.ARRAY_BUFFER,nodeDynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,nodeData,gl.DYNAMIC_DRAW);draw(nodeDynamicBuffer,nodeData.length/7,gl.POINTS,mvp,2,true,7,0,30);
      }
      canvas.dataset.phase=p<.15?'void':p<.34?'birth':p<.5?'orbit':p<.72?'network':'explore';
      frame=requestAnimationFrame(render);
    };
    let observer=null;
    if ('IntersectionObserver' in window && sectionRef.current) {
      observer = new IntersectionObserver(entries => {
        running = Boolean(entries[0]?.isIntersecting);
        if (running && !frame) frame = requestAnimationFrame(render);
        if (!running && frame) { cancelAnimationFrame(frame); frame = 0; }
      }, { threshold: 0 });
      observer.observe(sectionRef.current);
    }
    frame=requestAnimationFrame(render);
    return ()=>{running=false;cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',resize);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerleave',onPointerLeave);canvas.removeEventListener('webglcontextlost',onContextLost,false);[sphereBuffer,starBuffer,...ringBufferList,lineDynamicBuffer,nodeDynamicBuffer].forEach(b=>{if(b)gl.deleteBuffer(b)});gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  }, [nodes]);

  useEffect(() => { if(canvasRef.current) canvasRef.current.dataset.progress = String(progress); }, [progress]);

  const phase = progress < .15 ? '01 / THE VOID' : progress < .35 ? '02 / THE AWAKENING' : progress < .56 ? '03 / THE ORBIT' : progress < .8 ? '04 / THE CONNECTION' : '05 / THE UNIVERSE';
  const sceneTitle = progress < .17 ? 'Begin in the unknown.' : progress < .35 ? 'A world takes shape.' : progress < .56 ? 'Find your orbit.' : progress < .8 ? 'Everything is connected.' : 'Explore what comes next.';
  const selectedNode = visibleNodes.find(n=>n.id===selected);
  return <section className="cinematic-universe" ref={sectionRef} aria-label="ORBITLE cinematic universe" style={{'--scene-progress':progress}}>
    <div className="cinematic-sticky">
      <canvas className="universe-webgl" ref={canvasRef} aria-label="Interactive 3D planet and orbital network visualization" />
      <div className="universe-vignette" />
      <header className="universe-nav"><a className="universe-wordmark" href="#top" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:reducedMotion.current?'auto':'smooth'});}}>ORBITLE<span>®</span></a><span className="universe-nav-center">A WORLD OF CONNECTIONS</span><button onClick={()=>onNavigate('Network')}>Enter network ↗</button></header>
      <div className={`universe-copy ${progress>.77?'universe-copy-compact':''}`} aria-live="polite">
        <div className="universe-kicker"><span className="universe-pulse"/> {phase}</div>
        <h2>{sceneTitle}</h2>
        <p>{progress<.17?'One point of light. An entire universe still to come.':progress<.34?'A world emerges from darkness. Keep moving to discover what lives within it.':progress<.5?'The camera moves around the world as its paths and satellites come into view.':progress<.73?'The world opens into a constellation of people, communities, projects, and opportunities.':'Explore real communities, projects, and opportunities from the ORBITLE workspace.'}</p>
        {progress<.34 && <div className="universe-actions"><button onClick={()=>onNavigate('My Orbits')}>Explore the universe <span>↗</span></button><button className="universe-secondary" onClick={()=>onNavigate('Projects')}>Start building</button></div>}
      </div>
      <div className="universe-scroll-cue" style={{opacity:Math.max(0,1-progress*3)}}><span className="scroll-line"/><span>SCROLL TO TRAVEL</span><span className="scroll-percent">{Math.round(progress*100).toString().padStart(2,'0')}%</span></div>
      {progress>.52 && <div className="universe-explorer">
        <div className="explorer-top"><span>LIVE CONSTELLATIONS</span><span>{visibleNodes.length} nodes</span></div>
        <div className="explorer-tools"><input aria-label="Search universe" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the universe…"/><select aria-label="Filter universe category" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>People</option><option>Communities</option><option>Projects</option><option>Opportunities</option></select></div>
        <div className="explorer-node-list">{visibleNodes.slice(0,5).map(n=><button key={n.id} className={`explorer-node ${selected===n.id?'active':''}`} onClick={()=>setSelected(n.id)}><i style={{'--node-tint':`rgb(${n.tint.map(v=>Math.round(v*255)).join(',')})`}}/><span><b>{n.title}</b><small>{n.type}</small></span><span>↗</span></button>)}</div>
        {selectedNode && <div className="explorer-detail"><span>{selectedNode.type.toUpperCase()}</span><b>{selectedNode.title}</b><p>{selectedNode.detail}</p>{selectedNode.type==='People' && selectedNode.record ? (selectedNode.record.connectionStatus==='connected' ? <button onClick={()=>onMessage(selectedNode.record)}>Message ↗</button> : selectedNode.record.connectionStatus==='outgoing_pending' ? <button onClick={()=>onNavigate('Network')}>Request pending · View network ↗</button> : selectedNode.record.connectionStatus==='incoming_pending' ? <button onClick={()=>onNavigate('Network')}>Review connection ↗</button> : <button onClick={()=>onConnect(selectedNode.record)}>Connect ↗</button>) : <button onClick={()=>{if(selectedNode.type==='Communities'&&selectedNode.record)onJoin(selectedNode.record);else if(selectedNode.type==='Projects'&&selectedNode.record)onNavigate('Projects');else if(selectedNode.type==='Opportunities'&&selectedNode.record)onNavigate('Opportunities');else onNavigate(selectedNode.route);}}>{selectedNode.type==='Communities'?(selectedNode.record?.joined?'Leave community':'Join community'):`Open ${selectedNode.type.toLowerCase()}`} ↗</button>}</div>}
        {!visibleNodes.length && <p className="explorer-empty">No matching nodes. Try another search.</p>}
      </div>}
      <div className="universe-progress-track"><span style={{transform:`scaleX(${progress})`}}/></div>
      <div className="universe-scene-index"><span>00</span><i/><span>{progress<.34?'ORIGIN':progress<.52?'ORBIT':'CONNECTIONS'}</span></div>
      {webglFailed && <div className="universe-fallback" role="status">Your browser cannot initialize WebGL. ORBITLE navigation and discovery remain available below.</div>}
    </div>
  </section>;
}


function WaterRippleLayer() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    let width = 0, height = 0, dpr = 1, raf = 0, alive = true;
    let pointer = { x: -1000, y: -1000, active: false, lastMove: 0 };
    let lastRipple = 0;
    const ripples = [];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestDraw();
    };
    const addRipple = (x, y, strength = 1) => {
      ripples.push({ x, y, born: performance.now(), strength, seed: Math.random() * Math.PI * 2 });
      if (ripples.length > 14) ripples.shift();
      requestDraw();
    };
    const move = event => {
      const x = event.clientX, y = event.clientY;
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      const now = performance.now();
      pointer = { x, y, active: true, lastMove: now };
      if (!reduceMotion && distance > 22 && now - lastRipple > 105) {
        addRipple(x, y, Math.min(1.15, .55 + distance / 180));
        lastRipple = now;
      }
      requestDraw();
    };
    const down = event => {
      pointer = { x: event.clientX, y: event.clientY, active: true, lastMove: performance.now() };
      addRipple(event.clientX, event.clientY, 1.65);
    };
    const leave = () => { pointer.active = false; requestDraw(); };
    function requestDraw() {
      if (!raf && alive) raf = requestAnimationFrame(draw);
    }
    function draw(now) {
      raf = 0;
      if (!alive) return;
      ctx.clearRect(0, 0, width, height);
      const active = [];
      ripples.forEach(ripple => {
        const age = (now - ripple.born) / 1450;
        if (age >= 1) return;
        active.push(ripple);
        const progress = age;
        const radius = 12 + progress * (95 + ripple.strength * 34);
        const fade = Math.pow(1 - progress, 1.55) * ripple.strength;
        for (let ring = 0; ring < 3; ring++) {
          const r = radius * (1 - ring * .19);
          const alpha = fade * (ring === 0 ? .22 : ring === 1 ? .13 : .075);
          ctx.beginPath();
          for (let i = 0; i <= 100; i++) {
            const a = i / 100 * Math.PI * 2;
            const wave = Math.sin(a * 5 + ripple.seed + progress * 9) * 2.8
              + Math.sin(a * 9 - ripple.seed * .7 + progress * 13) * 1.25;
            const wobble = r + wave * (1 - progress * .4);
            const x = ripple.x + Math.cos(a) * wobble;
            const y = ripple.y + Math.sin(a) * wobble * .72;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.lineWidth = ring === 0 ? 1.25 : .8;
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(ripple.x - r * .13, ripple.y - r * .12, r * .82, r * .57, -.18, Math.PI * 1.04, Math.PI * 1.82);
          ctx.strokeStyle = `rgba(120,190,224,${alpha * .8})`;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
        const glint = ctx.createRadialGradient(ripple.x - radius * .25, ripple.y - radius * .18, 0, ripple.x, ripple.y, radius * 1.1);
        glint.addColorStop(0, `rgba(211,239,255,${fade * .09})`);
        glint.addColorStop(1, 'rgba(211,239,255,0)');
        ctx.fillStyle = glint;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius * 1.1, 0, Math.PI * 2);
        ctx.fill();
      });
      ripples.splice(0, ripples.length, ...active);
      const pointerFade = pointer.active ? Math.max(0, 1 - (now - pointer.lastMove) / 1700) : 0;
      if (pointerFade > 0) {
        const lens = ctx.createRadialGradient(pointer.x, pointer.y, 2, pointer.x, pointer.y, 118);
        lens.addColorStop(0, `rgba(225,246,255,${.105 * pointerFade})`);
        lens.addColorStop(.34, `rgba(178,222,245,${.055 * pointerFade})`);
        lens.addColorStop(1, 'rgba(178,222,245,0)');
        ctx.fillStyle = lens;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, 118, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pointer.x, pointer.y, 34, 24, -.22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${.12 * pointerFade})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (active.length || pointerFade > 0) requestDraw();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(document.documentElement);
    resize();
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('blur', leave);
    document.addEventListener('pointerleave', leave);
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('blur', leave);
      document.removeEventListener('pointerleave', leave);
    };
  }, []);
  return <canvas ref={canvasRef} className="orbitle-water-ripple-layer" aria-hidden="true" />;
}

function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState('Overview');
  const [orbits, setOrbits] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [postBody, setPostBody] = useState('');
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: '', summary: '', skills: 'Research, Web development', lookingFor: 'A curious teammate' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', bio: '', interests: '', goals: '', lookingFor: '' });
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('orbitle-theme') || 'light'; } catch { return 'light'; } });
  const [people, setPeople] = useState([]);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [networkSearch, setNetworkSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelMessages, setChannelMessages] = useState([]);
  const [channelDraft, setChannelDraft] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [verificationForm, setVerificationForm] = useState({ method: 'portfolio', evidenceUrl: '', note: '' });
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [feedFilter, setFeedFilter] = useState('For You');
  const [commentTarget, setCommentTarget] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [eventList, setEventList] = useState([]);
  const [trackedApps, setTrackedApps] = useState([]);
  const [inboxPeople, setInboxPeople] = useState([]);
  const [selectedDM, setSelectedDM] = useState(null);
  const [directMessages, setDirectMessages] = useState([]);
  const [directDraft, setDirectDraft] = useState('');
  const [directBusy, setDirectBusy] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectWorkspace, setProjectWorkspace] = useState(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '' });
  const [contributionForm, setContributionForm] = useState({ title: '', description: '', evidenceUrl: '' });
  const [portfolio, setPortfolio] = useState({ projects: [], contributions: [], confirmedCount: 0 });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [moderationQueue, setModerationQueue] = useState({ reports: [], verifications: [] });

  const flash = message => { setNotice(message); window.clearTimeout(flash.timer); flash.timer = window.setTimeout(() => setNotice(''), 3200); };
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('orbitle-theme', theme); } catch {} }, [theme]);
  const loadAll = useCallback(async () => {
    const [o, p, pr, po, ev] = await Promise.all([
      api('/orbits'), api('/opportunities'), api('/projects'), api('/posts'), api('/events')
    ]);
    setOrbits(o.orbits); setOpportunities(p.opportunities); setProjects(pr.projects); setPosts(po.posts); setEventList(ev.events || []);
  }, []);
  useEffect(() => {
    Promise.all([api('/auth/me').catch(() => ({ user: null })), loadAll()])
      .then(([me]) => { setUser(me.user); if (me.user) { setProfileForm({ name: me.user.name, bio: me.user.bio || '', interests: (me.user.interests || []).join(', '), goals: (me.user.goals || []).join(', '), lookingFor: me.user.lookingFor || '' }); if (!me.user.onboardingComplete) setOnboardingOpen(true); } })
      .catch(err => flash(err.message))
      .finally(() => setBooting(false));
  }, [loadAll]);

  const refreshOpportunities = useCallback(async () => {
    try {
      const result = savedOnly && user ? await api('/saved-opportunities') : await api(`/opportunities?q=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`);
      setOpportunities(result.opportunities);
    } catch (err) { flash(err.message); }
  }, [search, category, savedOnly, user]);
  useEffect(() => { refreshOpportunities(); }, [refreshOpportunities]);

  const openAuth = mode => { setAuthMode(mode); setAuthOpen(true); };
  const doLogout = async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); flash('Signed out.'); setPage('Overview'); await loadAll(); };
  const onAuth = async event => {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const result = await api(`/auth/${authMode === 'signup' ? 'register' : 'login'}`, { method: 'POST', body: payload });
      setUser(result.user); setProfileForm({ name: result.user.name, bio: result.user.bio || '', interests: (result.user.interests || []).join(', '), goals: (result.user.goals || []).join(', '), lookingFor: result.user.lookingFor || '' });
      setAuthOpen(false); if (authMode === 'signup') setOnboardingOpen(true); flash(authMode === 'signup' ? 'Account created. Let’s personalize your orbit.' : 'Welcome back.'); await loadAll();
    } catch (err) { flash(err.message); } finally { setBusy(false); }
  };
  const toggleJoin = async orbit => {
    if (!user) return openAuth('login');
    try { await api(`/orbits/${orbit.id}/join`, { method: 'POST', body: {} }); await loadAll(); flash(orbit.joined ? `Left ${orbit.name}.` : `Joined ${orbit.name}.`); }
    catch (err) { flash(err.message); }
  };
  const toggleSave = async opportunity => {
    if (!user) return openAuth('login');
    try { await api(`/opportunities/${opportunity.id}/save`, { method: 'POST', body: {} }); await refreshOpportunities(); flash(opportunity.saved ? 'Removed from saved opportunities.' : 'Opportunity saved.'); }
    catch (err) { flash(err.message); }
  };
  const openProjectWorkspace = async project => {
    if (!user) return openAuth('login');
    setSelectedProjectId(Number(project.id)); setProjectWorkspace(null); setPage('Project Studio');
    try { setWorkspaceBusy(true); const result = await api(`/projects/${project.id}/workspace`); setProjectWorkspace(result); }
    catch (err) { flash(err.message); setPage('Projects'); }
    finally { setWorkspaceBusy(false); }
  };
  const applyProject = async project => {
    if (!user) return openAuth('login');
    try { const r = await api(`/projects/${project.id}/apply`, { method: 'POST', body: { message: 'I would like to learn more and contribute to this project.' } }); flash(r.message); await loadAll(); await openProjectWorkspace(project); }
    catch (err) { flash(err.message); }
  };
  const refreshProjectWorkspace = async () => {
    if (!selectedProjectId) return;
    try { const result = await api(`/projects/${selectedProjectId}/workspace`); setProjectWorkspace(result); }
    catch (err) { flash(err.message); }
  };
  const submitWorkspaceTask = async event => {
    event.preventDefault(); if (!selectedProjectId || !taskForm.title.trim()) return;
    try { await api(`/projects/${selectedProjectId}/tasks`, { method: 'POST', body: taskForm }); setTaskForm({ title: '', description: '' }); await refreshProjectWorkspace(); flash('Task added to the project board.'); }
    catch (err) { flash(err.message); }
  };
  const changeTaskStatus = async (task, status) => {
    try { await api(`/projects/${selectedProjectId}/tasks/${task.id}`, { method: 'PATCH', body: { status } }); await refreshProjectWorkspace(); }
    catch (err) { flash(err.message); }
  };
  const submitContribution = async event => {
    event.preventDefault(); if (!selectedProjectId) return;
    try { const result = await api(`/projects/${selectedProjectId}/contributions`, { method: 'POST', body: contributionForm }); setContributionForm({ title: '', description: '', evidenceUrl: '' }); await refreshProjectWorkspace(); flash(result.message); }
    catch (err) { flash(err.message); }
  };
  const reviewContribution = async (contribution, action) => {
    try { await api(`/projects/${selectedProjectId}/contributions/${contribution.id}`, { method: 'PATCH', body: { action } }); await refreshProjectWorkspace(); flash(action === 'confirm' ? 'Contribution confirmed and added to the contributor’s public record.' : 'Contribution declined.'); }
    catch (err) { flash(err.message); }
  };
  const submitPost = async event => {
    event.preventDefault(); if (!user) return openAuth('login');
    try { await api('/posts', { method: 'POST', body: { body: postBody } }); setPostBody(''); const r = await api('/posts'); setPosts(r.posts); flash('Update published.'); }
    catch (err) { flash(err.message); }
  };
  const refreshPosts = async () => { const r = await api('/posts'); setPosts(r.posts); };
  const likePost = async post => {
    if (!user) return openAuth('login');
    try { await api(`/posts/${post.id}/like`, { method: 'POST', body: {} }); await refreshPosts(); }
    catch (err) { flash(err.message); }
  };
  const bookmarkPost = async post => {
    if (!user) return openAuth('login');
    try { await api(`/posts/${post.id}/bookmark`, { method: 'POST', body: {} }); await refreshPosts(); flash(post.bookmarked ? 'Removed from saved posts.' : 'Post saved.'); }
    catch (err) { flash(err.message); }
  };
  const repostPost = async post => {
    if (!user) return openAuth('login');
    try { await api(`/posts/${post.id}/repost`, { method: 'POST', body: {} }); await refreshPosts(); flash(post.reposted ? 'Repost removed.' : 'Reposted to your network.'); }
    catch (err) { flash(err.message); }
  };
  const openComments = async post => {
    if (commentTarget === post.id) { setCommentTarget(null); setPostComments([]); return; }
    try { const r = await api(`/posts/${post.id}/comments`); setPostComments(r.comments); setCommentTarget(post.id); }
    catch (err) { flash(err.message); }
  };
  const submitComment = async event => {
    event.preventDefault(); if (!user) return openAuth('login');
    if (!commentTarget || !commentDraft.trim()) return;
    try { await api(`/posts/${commentTarget}/comments`, { method: 'POST', body: { body: commentDraft.trim() } }); setCommentDraft(''); const r = await api(`/posts/${commentTarget}/comments`); setPostComments(r.comments); await refreshPosts(); }
    catch (err) { flash(err.message); }
  };
  const rsvpEvent = async eventItem => {
    if (!user) return openAuth('login');
    try { await api(`/events/${eventItem.id}/rsvp`, { method: 'POST', body: {} }); const r = await api('/events'); setEventList(r.events); flash(eventItem.attending ? 'RSVP cancelled.' : 'You are on the attendee list.'); }
    catch (err) { flash(err.message); }
  };
  const trackOpportunity = async (opportunity, status = 'interested') => {
    if (!user) return openAuth('login');
    try { await api(`/opportunities/${opportunity.id}/track`, { method: 'POST', body: { status, notes: '' } }); const r = await api('/opportunity-tracker'); setTrackedApps(r.applications); flash('Application tracker updated.'); }
    catch (err) { flash(err.message); }
  };
  const updateTrackedStatus = async (application, status) => {
    try { await api(`/opportunities/${application.opportunityId}/track`, { method: 'POST', body: { status, notes: application.notes || '' } }); const r = await api('/opportunity-tracker'); setTrackedApps(r.applications); }
    catch (err) { flash(err.message); }
  };
  const createProject = async event => {
    event.preventDefault();
    try {
      await api('/projects', { method: 'POST', body: { ...projectForm, skills: projectForm.skills.split(',').map(x => x.trim()).filter(Boolean) } });
      setProjectOpen(false); setProjectForm({ title: '', summary: '', skills: 'Research, Web development', lookingFor: 'A curious teammate' });
      const r = await api('/projects'); setProjects(r.projects); flash('Project created.');
    } catch (err) { flash(err.message); }
  };
  const profilePayload = (onboardingComplete = undefined) => ({
    name: profileForm.name, bio: profileForm.bio,
    interests: profileForm.interests.split(',').map(x => x.trim()).filter(Boolean).slice(0,12),
    goals: profileForm.goals.split(',').map(x => x.trim()).filter(Boolean).slice(0,8),
    lookingFor: profileForm.lookingFor.trim().slice(0,160),
    ...(onboardingComplete === undefined ? {} : { onboardingComplete })
  });
  const saveProfile = async event => {
    event.preventDefault();
    try {
      const result = await api('/profile', { method: 'PATCH', body: profilePayload() });
      setUser(result.user); setProfileOpen(false); flash('Profile updated.');
    } catch (err) { flash(err.message); }
  };
  const finishOnboarding = async event => {
    event.preventDefault();
    try {
      const result = await api('/profile', { method: 'PATCH', body: profilePayload(true) });
      setUser(result.user); setOnboardingOpen(false); flash('Your ORBITLE profile is ready. Recommendations will improve as you explore.');
    } catch (err) { flash(err.message); }
  };
  const selectPage = name => {
    if ((name === 'Saved Posts' || name === 'Inbox' || name === 'Application Tracker' || name === 'Project Studio') && !user) { openAuth('login'); return; }
    setPage(name); setSearch('');
    if (name === 'Messages') setSelectedChannel(orbits.find(o => o.joined)?.id || null);
    if (name === 'Inbox') setSelectedDM(null);
  };
  const refreshNetwork = useCallback(async () => {
    if (!user) return;
    try {
      const [p, r, b] = await Promise.all([
        api(`/network/people?q=${encodeURIComponent(networkSearch)}`),
        api('/network/requests'), api('/safety/blocks')
      ]);
      setPeople(p.people); setConnectionRequests(r.requests); setBlockedUsers(b.blocks || []);
    } catch (err) { flash(err.message); }
  }, [user, networkSearch]);
  useEffect(() => { if (page === 'Network' && user) refreshNetwork(); }, [page, user, refreshNetwork]);
  const sendConnection = async person => {
    if (!user) return openAuth('login');
    try { await api('/network/requests', { method: 'POST', body: { userId: Number(person.id) } }); await refreshNetwork(); flash(`Connection request sent to ${person.name}.`); }
    catch (err) { flash(err.message); }
  };
  const respondConnection = async (request, action) => {
    try { await api(`/network/requests/${request.id}`, { method: 'PATCH', body: { action } }); await refreshNetwork(); flash(action === 'accept' ? `You are now connected with ${request.name}.` : 'Request declined.'); }
    catch (err) { flash(err.message); }
  };
  const blockPerson = async person => {
    if (!user) return openAuth('login');
    if (!window.confirm(`Block ${person.name}? Their profile and posts will be hidden from your workspace, and direct messages will be disabled.`)) return;
    try { await api('/safety/blocks', { method:'POST', body:{ userId:Number(person.id || person.userId) } }); await Promise.all([refreshNetwork(),refreshPosts(),refreshInbox()]); flash(`${person.name} has been blocked.`); }
    catch (err) { flash(err.message); }
  };
  const unblockPerson = async person => {
    try { await api(`/safety/blocks/${person.userId}`, { method:'DELETE' }); await refreshNetwork(); flash(`${person.name} has been unblocked.`); }
    catch (err) { flash(err.message); }
  };
  const reportContent = async (targetType, targetId, label) => {
    if (!user) return openAuth('login');
    const reason = window.prompt(`Why are you reporting this ${label}? Enter a short reason (e.g. harassment, spam, impersonation).`);
    if (!reason || reason.trim().length < 3) return;
    const details = window.prompt('Optional context for the moderator (do not include private information).') || '';
    try { const result = await api('/safety/reports', { method:'POST', body:{ targetType, targetId:Number(targetId), reason:reason.trim().slice(0,80), details:details.trim().slice(0,500) } }); flash(result.message); }
    catch (err) { flash(err.message); }
  };
  const refreshChannelMessages = useCallback(async () => {
    if (!user || !selectedChannel) { setChannelMessages([]); return; }
    try { const result = await api(`/orbits/${selectedChannel}/messages`); setChannelMessages(result.messages); }
    catch (err) { setChannelMessages([]); if (page === 'Messages') flash(err.message); }
  }, [user, selectedChannel, page]);
  useEffect(() => { if (page === 'Messages') { refreshChannelMessages(); const poll = window.setInterval(refreshChannelMessages, 5000); return () => window.clearInterval(poll); } }, [page, selectedChannel, refreshChannelMessages]);
  const submitChannelMessage = async event => {
    event.preventDefault(); if (!channelDraft.trim() || !selectedChannel || messageBusy) return;
    setMessageBusy(true);
    try { await api(`/orbits/${selectedChannel}/messages`, { method: 'POST', body: { body: channelDraft.trim() } }); setChannelDraft(''); await refreshChannelMessages(); }
    catch (err) { flash(err.message); } finally { setMessageBusy(false); }
  };
  const refreshInbox = useCallback(async () => {
    if (!user) { setInboxPeople([]); return; }
    try { const result = await api('/inbox'); setInboxPeople(result.conversations); }
    catch (err) { if (page === 'Inbox') flash(err.message); }
  }, [user, page]);
  useEffect(() => { if ((page === 'Inbox' || page === 'Community') && user) refreshInbox(); }, [page, user, refreshInbox]);
  const refreshDirectMessages = useCallback(async () => {
    if (!user || !selectedDM) { setDirectMessages([]); return; }
    try { const result = await api(`/inbox/${selectedDM}`); setDirectMessages(result.messages); }
    catch (err) { setDirectMessages([]); if (page === 'Inbox') flash(err.message); }
  }, [user, selectedDM, page]);
  useEffect(() => { if (page === 'Inbox' && selectedDM) { refreshDirectMessages(); const poll = window.setInterval(refreshDirectMessages, 5000); return () => window.clearInterval(poll); } }, [page, selectedDM, refreshDirectMessages]);
  useEffect(() => {
    const handleKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); setCommandQuery(''); setCommandIndex(0); }
      if (event.key === 'Escape') { setCommandOpen(false); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const submitDirectMessage = async event => {
    event.preventDefault(); if (!selectedDM || !directDraft.trim() || directBusy) return;
    setDirectBusy(true);
    try { await api(`/inbox/${selectedDM}`, { method: 'POST', body: { body: directDraft.trim() } }); setDirectDraft(''); await refreshDirectMessages(); await refreshInbox(); }
    catch (err) { flash(err.message); } finally { setDirectBusy(false); }
  };
  const startDirectMessage = person => { setSelectedDM(person.userId || person.id); setPage('Inbox'); setDirectDraft(''); };

  const refreshVerification = useCallback(async () => {
    if (!user) return;
    try { const result = await api('/verification/me'); setVerificationRequests(result.requests); }
    catch (err) { flash(err.message); }
  }, [user]);
  useEffect(() => { if (page === 'Verification' && user) refreshVerification(); }, [page, user, refreshVerification]);
  useEffect(() => { if (page === 'Application Tracker' && user) api('/opportunity-tracker').then(r=>setTrackedApps(r.applications)).catch(err=>flash(err.message)); }, [page, user]);
  useEffect(() => { if (page === 'My Profile' && user) api('/portfolio/me').then(setPortfolio).catch(err=>flash(err.message)); }, [page, user]);
  useEffect(() => { if (page === 'Moderation' && user?.isAdmin) api('/moderation/queue').then(setModerationQueue).catch(err=>flash(err.message)); }, [page, user]);
  const reviewReport = async (report,status) => { try { await api(`/moderation/reports/${report.id}`,{method:'PATCH',body:{status}}); const result=await api('/moderation/queue');setModerationQueue(result);flash('Report status updated.'); } catch(err){flash(err.message);} };
  const reviewVerification = async (item,action) => { try { await api(`/moderation/verifications/${item.id}`,{method:'PATCH',body:{action}}); const result=await api('/moderation/queue');setModerationQueue(result);flash(action==='approve'?'Evidence review approved.':'Evidence review declined.'); } catch(err){flash(err.message);} };
  useEffect(() => { if (page === 'Project Studio' && selectedProjectId && user && !projectWorkspace) { setWorkspaceBusy(true); api(`/projects/${selectedProjectId}/workspace`).then(setProjectWorkspace).catch(err=>{flash(err.message);setPage('Projects');}).finally(()=>setWorkspaceBusy(false)); } }, [page, selectedProjectId, user, projectWorkspace]);
  const submitVerification = async event => {
    event.preventDefault();
    try {
      const result = await api('/verification/requests', { method: 'POST', body: verificationForm });
      setVerificationRequests(current => [result.request, ...current]);
      setVerificationForm({ method: 'portfolio', evidenceUrl: '', note: '' });
      flash(result.message);
    } catch (err) { flash(err.message); }
  };

  const joinedCount = orbits.filter(o => o.joined).length;
  const demoCount = opportunities.filter(o => o.isDemo).length;
  const nav = [ ['Overview','⌂'], ['Network','↗'], ['Inbox','✉'], ['Messages','◌'], ['My Orbits','◎'], ['Opportunities','↗'], ['Application Tracker','☷'], ['Projects','⌘'], ['Project Studio','▦'], ['Events','◷'], ['Community','≋'], ['Saved Posts','☆'], ['Verification','✓'], ...(user?.isAdmin ? [['Moderation','⚑']] : []), ['My Profile','○'] ];
  const visibleProjects = useMemo(() => projects.filter(p => !search || `${p.title} ${p.summary} ${p.skills.join(' ')}`.toLowerCase().includes(search.toLowerCase())), [projects, search]);
  const matchedProjects = useMemo(() => [...projects].map(project => ({ ...project, match: matchScore([...(user?.interests || []), ...(user?.goals || []), user?.lookingFor].join(' '), [project.title, project.summary, ...(project.skills || []), project.looking_for].join(' ')) })).filter(project => !user || project.match > 0).sort((a,b) => b.match-a.match).slice(0,3), [projects, user]);
  const matchedOrbits = useMemo(() => [...orbits].map(orbit => ({ ...orbit, match: matchScore([...(user?.interests || []), ...(user?.goals || []), user?.lookingFor].join(' '), [orbit.name, orbit.category, orbit.description].join(' ')) })).filter(orbit => !user || orbit.match > 0).sort((a,b) => b.match-a.match).slice(0,3), [orbits, user]);
  const matchedOpportunities = useMemo(() => [...opportunities].map(item => ({ ...item, match: matchScore([...(user?.interests || []), ...(user?.goals || []), user?.lookingFor].join(' '), [item.title, item.category, item.organization, item.description].join(' ')) })).filter(item => !user || item.match > 0).sort((a,b) => b.match-a.match).slice(0,3), [opportunities, user]);
  const visiblePosts = useMemo(() => posts.filter(p => feedFilter === 'Saved' ? p.bookmarked : feedFilter === 'Following' ? (Number(p.userId)===Number(user?.id) || inboxPeople.some(person=>Number(person.userId)===Number(p.userId))) : feedFilter === 'Research' ? /research|paper|data|study|analysis/i.test(p.body) : feedFilter === 'Projects' ? /project|build|launch|prototype|demo/i.test(p.body) : true), [posts, feedFilter, inboxPeople, user]);
  const commandItems = useMemo(() => {
    const pages = nav.map(([name,glyph]) => ({ label: name, detail: 'Open workspace', glyph, run: () => selectPage(name) }));
    const entities = [
      ...orbits.map(o => ({ label: o.name, detail: `${o.category} community`, glyph: '◎', run: () => selectPage('My Orbits') })),
      ...opportunities.map(o => ({ label: o.title, detail: `Opportunity · ${o.category}`, glyph: '↗', run: () => { selectPage('Opportunities'); setCategory('All'); setSearch(o.title); } })),
      ...projects.map(o => ({ label: o.title, detail: 'Project workspace', glyph: '⌘', run: () => { selectPage('Projects'); setSearch(o.title); } }))
    ];
    const all = [...pages, ...entities];
    return all.filter(item => !commandQuery || `${item.label} ${item.detail}`.toLowerCase().includes(commandQuery.toLowerCase())).slice(0, 12);
  }, [nav, orbits, opportunities, projects, commandQuery]);

  if (booting) return <div className="boot"><div className="brandmark"/><span>Preparing your orbit...</span></div>;
  return <div className={`app-shell theme-${theme}`}>
    <WaterRippleLayer />
    <aside className="sidebar">
      <a className="brand" href="#top" onClick={e => { e.preventDefault(); setPage('Overview'); }}><span className="brandmark"/><span>ORBITLE</span></a>
      <div className="side-label">YOUR WORKSPACE</div>
      <nav className="side-nav">{nav.map(([name, glyph]) => <button key={name} className={`nav-item ${page === name ? 'active' : ''}`} onClick={() => selectPage(name)}><span className="nav-glyph">{glyph}</span>{name}{name === 'Network' && connectionRequests.length > 0 && <span className="nav-count">{connectionRequests.length}</span>}{name === 'Inbox' && inboxPeople.length > 0 && <span className="nav-count">{inboxPeople.length}</span>}{name === 'Opportunities' && <span className="nav-count">{opportunities.length}</span>}</button>)}</nav>
      <div className="side-orbits"><div className="side-label">YOUR ORBITS <button onClick={() => setPage('My Orbits')}>＋</button></div>{orbits.filter(o => o.joined).slice(0,4).map(o => <button key={o.id} className="mini-orbit" onClick={() => setPage('My Orbits')}><i style={{background:o.accent}}/>{o.name}</button>)}{!joinedCount && <p className="side-empty">Join an Orbit to build your network.</p>}</div>
      <div className="sidebar-bottom"><div className="status-dot"/> <span>Make something matter.</span><span className="version">BETA</span></div>
    </aside>
    <main className="main-area" id="top">
      <header className="topbar"><div className="mobile-brand"><span className="brandmark"/> ORBITLE</div><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{page}</strong></div><div className="top-actions"><button className="global-search command-trigger" onClick={() => { setCommandOpen(true); setCommandQuery(''); }}><span>⌕</span><span className="search-placeholder">Search people, spaces, work…</span><kbd>Ctrl K</kbd></button><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><span>{theme === 'light' ? '☾' : '☼'}</span><small>{theme === 'light' ? 'Dark' : 'Light'}</small></button>{user ? <button className="user-pill" onClick={() => setProfileOpen(true)}><span className="avatar">{initials(user.name)}</span><span className="user-pill-name">{user.name}</span><span>⌄</span></button> : <button className="button button-dark button-small" onClick={() => openAuth('login')}>Sign in</button>}</div></header>
      <div className="content">
        <div className="page-transition" key={page} data-page={page.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
        {page === 'Overview' && <>
          <AppleLaunch onNavigate={selectPage} user={user} />
          <section className="welcome-row"><div><div className="eyebrow"><span className="pulse"/> THE NETWORK FOR WHAT COMES NEXT</div><h1>{user ? `Make your next move, ${user.name.split(' ')[0]}.` : 'The right people change everything.'}</h1><p className="subheading">A professional network to discover people, build in communities, and turn shared ambition into real work.</p><div className="hero-actions"><button className="button button-dark" onClick={() => selectPage('Network')}>Explore your network <span>↗</span></button><button className="button button-light" onClick={() => selectPage('My Orbits')}>Discover Orbits</button></div></div><div className="date-stamp"><span>YOUR ORBITAL STATUS</span><strong>{user ? 'CONNECTED' : 'EXPLORING'}</strong><small><i/> {user ? 'Profile active' : 'Preview mode'}</small></div></section>
          <section className="metric-grid"><Metric label="ORBIT COMMUNITIES" value={joinedCount.toString().padStart(2,'0')} detail="Communities you joined" icon="◎"/><Metric label="OPPORTUNITIES" value={opportunities.length.toString().padStart(2,'0')} detail="Listings to explore" icon="↗"/><Metric label="OPEN PROJECTS" value={projects.length.toString().padStart(2,'0')} detail="Teams recruiting" icon="⌘"/><Metric label="YOUR STATUS" value={user ? 'LIVE' : 'GUEST'} detail={user ? 'Signed in securely' : 'Sign in to participate'} icon="◌"/></section>
          <section className="quick-feature-grid">
            <button className="quick-feature" onClick={() => selectPage('Network')}><span className="quick-feature-icon">↗</span><span className="quick-feature-copy"><b>Professional network</b><small>Find people by interests, skills, and projects.</small></span><span className="quick-arrow">↗</span></button>
            <button className="quick-feature" onClick={() => selectPage('Messages')}><span className="quick-feature-icon">#</span><span className="quick-feature-copy"><b>Orbit channels</b><small>Chat with people in the communities you join.</small></span><span className="quick-arrow">↗</span></button>
            <button className="quick-feature" onClick={() => selectPage('Verification')}><span className="quick-feature-icon">✓</span><span className="quick-feature-copy"><b>Trust & verification</b><small>Build credibility with reviewable public evidence.</small></span><span className="quick-arrow">↗</span></button>
          </section>
          <section className="feature-banner"><div className="banner-copy"><div className="section-label">THE ORBITLE PRINCIPLE · 01</div><h2>Connections are a beginning.<br/><em>What you build is the point.</em></h2><p>Join a community, find collaborators, and turn an idea into work you can show.</p><button className="button button-lime" onClick={() => setPage('Projects')}>Explore projects <span>↗</span></button></div><div className="banner-orbit"><div className="banner-ring ring-one"/><div className="banner-ring ring-two"/><div className="banner-ring ring-three"/><div className="banner-core">O</div><span className="banner-node node-one">IDEAS</span><span className="banner-node node-two">PEOPLE</span><span className="banner-node node-three">ACTION</span></div></section>
          <div className="section-title-row"><div><div className="section-label">FIND YOUR PEOPLE</div><h2>Orbits worth joining</h2></div><button className="text-link" onClick={() => setPage('My Orbits')}>View all Orbits <span>↗</span></button></div>
          <div className="orbit-grid">{orbits.slice(0,4).map((o,i) => <OrbitCard key={o.id} orbit={o} index={i} onJoin={() => toggleJoin(o)}/>)}</div>
          <div className="section-title-row section-gap"><div><div className="section-label">A PLACE TO START</div><h2>Fresh opportunities</h2></div><button className="text-link" onClick={() => setPage('Opportunities')}>Open radar <span>↗</span></button></div>
          <div className="opportunity-list">{opportunities.slice(0,3).map(o => <OpportunityRow key={o.id} item={o} onSave={() => toggleSave(o)} onTrack={() => trackOpportunity(o)} tracked={trackedApps.some(a=>Number(a.opportunityId)===Number(o.id))}/>)}</div>
          {demoCount > 0 && <p className="demo-note">Some listings are demonstration data, not verified live opportunities. Check the source before applying.</p>}
        </>}
        {page === 'My Orbits' && <><PageHeading kicker="COMMUNITY GRAPH" title="Find your orbit." description="Join focused communities to meet collaborators, learn from peers, and share what you are building."/><div className="filter-row"><span>{orbits.length} communities</span><span>{joinedCount} joined</span></div>{user && matchedOrbits.length>0 && <section className="match-section"><div className="section-label">COMMUNITIES FOR YOUR INTERESTS</div><h2>Start with a relevant orbit</h2><div className="match-strip">{matchedOrbits.map(orbit=><article className="match-card" key={`orbit-match-${orbit.id}`}><div className="match-score">{orbit.match}% <small>overlap</small></div><b>{orbit.name}</b><p>{orbit.description}</p><div className="tag-row"><span className="tag">{orbit.category}</span></div><button className="button button-dark button-small" onClick={()=>toggleJoin(orbit)}>{orbit.joined?'Leave orbit':'Join orbit ↗'}</button></article>)}</div></section>}<div className="orbit-grid">{orbits.map((o,i) => <OrbitCard key={o.id} orbit={o} index={i} onJoin={() => toggleJoin(o)}/>)}</div></>}
        {page === 'Network' && <>
          <PageHeading kicker="PEOPLE, NOT JUST PROFILES" title="Build your network." description="Discover people who are learning, researching, and building in the same direction. Connect when there is a real reason to collaborate." action={<span className="verified-note">✓ Thoughtful connections first</span>}/>
          {!user ? <div className="signed-out-card"><h3>Your network starts with a profile.</h3><p>Sign in to discover members and send connection requests.</p><button className="button button-dark" onClick={() => openAuth('login')}>Sign in to explore ↗</button></div> : <>
            <div className="network-toolbar"><label className="network-search">⌕ <input value={networkSearch} onChange={e => setNetworkSearch(e.target.value)} placeholder="Search by name, bio, or interests"/></label><span>{people.length} member{people.length === 1 ? '' : 's'}</span></div>
            {blockedUsers.length>0&&<section className="blocked-members"><div className="section-label">YOUR PRIVACY CONTROLS · {blockedUsers.length} BLOCKED</div><div className="blocked-member-list">{blockedUsers.map(person=><div key={person.userId}><span>{person.name}</span><button className="button button-light button-small" onClick={()=>unblockPerson(person)}>Unblock</button></div>)}</div></section>}
            {connectionRequests.length > 0 && <section className="requests-section"><div className="section-title-row"><div><div className="section-label">INCOMING</div><h2>Connection requests <span className="count-chip">{connectionRequests.length}</span></h2></div></div><div className="request-grid">{connectionRequests.map(r => <article className="request-card" key={r.id}><span className="avatar avatar-large">{initials(r.name)}</span><div className="request-copy"><b>{r.name}</b><p>{r.bio || 'ORBITLE member'}</p></div><div className="request-actions"><button className="button button-dark button-small" onClick={() => respondConnection(r,'accept')}>Accept</button><button className="button button-light button-small" onClick={() => respondConnection(r,'decline')}>Decline</button></div></article>)}</div></section>}
            {people.length > 0 && <section className="match-section"><div className="section-title-row"><div><div className="section-label">BASED ON YOUR INTERESTS</div><h2>People worth meeting</h2><p className="muted">A transparent match score based on words you and other members chose to share. It is a starting point, not a guarantee.</p></div><button className="button button-light button-small" onClick={()=>selectPage('My Profile')}>Improve my profile ↗</button></div><div className="match-strip">{[...people].map(person=>({...person, match:matchScore([...(user?.interests||[]),...(user?.goals||[]),user?.lookingFor].join(' '),[...(person.interests||[]),person.bio].join(' '))})).filter(person=>person.match>0).sort((a,b)=>b.match-a.match).slice(0,3).map(person=><article className="match-card" key={`match-${person.id}`}><div className="match-score">{person.match}% <small>overlap</small></div><b>{person.name}</b><p>{person.bio || 'ORBITLE member building a profile.'}</p><div className="tag-row">{(person.interests||[]).slice(0,3).map(tag=><span className="tag" key={tag}>{tag}</span>)}</div><button className="button button-dark button-small" onClick={()=>person.connectionStatus==='connected'?startDirectMessage(person):sendConnection(person)}>{person.connectionStatus==='connected'?'Message ↗':'Connect +'}</button></article>)}</div>{!people.some(person=>matchScore([...(user?.interests||[]),...(user?.goals||[]),user?.lookingFor].join(' '),[...(person.interests||[]),person.bio].join(' '))>0)&&<p className="muted">No strong overlap yet. Add a few skills and goals to your profile, or browse all members below.</p>}</section>}
            <div className="people-grid">{people.map(person => <article className="person-card" key={person.id}><div className="person-card-top"><span className="avatar avatar-large">{initials(person.name)}</span><span className="person-presence">MEMBER</span></div><h3>{person.name}</h3><p>{person.bio || 'Building a profile around interests, skills, and projects.'}</p><div className="tag-row">{person.interests.slice(0,3).map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><div className="person-card-bottom">{person.connectionStatus === 'connected' ? <><span className="connection-state">✓ Connected</span><button className="button button-light button-small" onClick={() => startDirectMessage(person)}>Message ↗</button></> : person.connectionStatus === 'outgoing_pending' ? <span className="connection-state">Request pending</span> : person.connectionStatus === 'incoming_pending' ? <span className="connection-state">They requested to connect</span> : <button className="button button-dark button-small" onClick={() => sendConnection(person)}>Connect +</button>}<div className="person-safety-actions"><button onClick={()=>reportContent('user',person.id,'member')}>Report</button><button onClick={()=>blockPerson(person)}>Block</button></div></div></article>)}</div>
            {!people.length && <EmptyState title="No members found" text="Try a broader search. New members will appear here when they create accounts."/>}
          </>}
        </>}
        {page === 'Messages' && <>
          <PageHeading kicker="ORBIT CHANNELS" title="The conversation is the work." description="A Discord-inspired space for each Orbit. Join a community first, then use its channel to ask questions, share progress, and coordinate projects."/>
          {!user ? <div className="signed-out-card"><h3>Conversations happen inside communities.</h3><p>Sign in and join an Orbit to access its channel.</p><button className="button button-dark" onClick={() => openAuth('login')}>Sign in ↗</button></div> : <div className="channel-layout">
            <aside className="channel-rail"><div className="channel-rail-heading"><span>YOUR ORBITS</span><button onClick={() => selectPage('My Orbits')} aria-label="Explore Orbits">＋</button></div>{orbits.filter(o => o.joined).map(o => <button key={o.id} className={`channel-option ${Number(selectedChannel) === Number(o.id) ? 'selected' : ''}`} onClick={() => setSelectedChannel(o.id)}><span className="channel-hash">#</span><span>{o.name}</span><small>{o.member_count}</small></button>)}{!joinedCount && <p className="channel-empty">No channels yet. Join an Orbit to open its conversation.</p>}<button className="channel-discover" onClick={() => selectPage('My Orbits')}>Explore communities ↗</button></aside>
            <section className="chat-panel">{orbits.some(o => o.joined && Number(o.id) === Number(selectedChannel)) ? <><header className="chat-header"><div><div className="section-label">COMMUNITY CHANNEL</div><h2># {orbits.find(o => Number(o.id) === Number(selectedChannel))?.name}</h2></div><span className="live-label"><i/> MEMBERS ONLY</span></header><div className="chat-intro"><b>Welcome to the channel.</b><p>Keep it constructive. Share context, ask clear questions, and respect other members.</p></div><div className="chat-messages">{channelMessages.map(m => <article className="chat-message" key={m.id}><span className="avatar">{initials(m.author)}</span><div><div className="chat-message-meta"><b>{m.author}</b><time>{new Date(m.createdAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p></div></article>)}{!channelMessages.length && <div className="chat-empty"><span>#</span><b>Start the conversation</b><p>Share a useful question, idea, or project update.</p></div>}</div><form className="chat-composer" onSubmit={submitChannelMessage}><input value={channelDraft} onChange={e => setChannelDraft(e.target.value)} maxLength="1500" placeholder={`Message #${orbits.find(o => Number(o.id) === Number(selectedChannel))?.name || 'channel'}`} aria-label="Channel message"/><button className="button button-dark button-small" disabled={!channelDraft.trim() || messageBusy}>{messageBusy ? 'Sending…' : 'Send ↗'}</button></form><p className="chat-hint">Messages are saved to this local ORBITLE database. Messages refresh automatically every five seconds while this channel is open.</p></> : <div className="chat-empty chat-empty-large"><span>#</span><b>{joinedCount ? 'Choose an Orbit channel' : 'No Orbit channels yet'}</b><p>{joinedCount ? 'Select a community on the left to open its conversation.' : 'Join a community to unlock its private channel.'}</p><button className="button button-dark button-small" onClick={() => selectPage('My Orbits')}>Explore Orbits ↗</button></div>}</section>
          </div>}
        </>}
        {page === 'Moderation' && user?.isAdmin && <>
          <PageHeading kicker="TRUST & SAFETY OPERATIONS" title="Moderation queue." description="Review reports and public-evidence verification requests. Only the configured ORBITLE moderator account can access this workspace." action={<button className="button button-light" onClick={()=>api('/moderation/queue').then(setModerationQueue).catch(err=>flash(err.message))}>Refresh queue ↻</button>}/>
          <div className="moderation-section"><div className="section-label">COMMUNITY REPORTS · {moderationQueue.reports.filter(r=>r.status==='open').length} OPEN</div><div className="moderation-list">{moderationQueue.reports.map(report=><article className="moderation-card" key={report.id}><div className="moderation-card-head"><b>Report #{report.id} · {report.targetType}</b><span className={`status-pill status-${report.status==='open'?'pending':report.status==='resolved'?'confirmed':'declined'}`}>{report.status}</span></div><p><b>Reason:</b> {report.reason}</p><p><b>Reported by:</b> {report.reporterName}</p><p><b>Target:</b> {report.targetPreview || 'Target no longer available'}</p>{report.details&&<p><b>Context:</b> {report.details}</p>}<div className="moderation-actions"><button className="button button-light button-small" onClick={()=>reviewReport(report,'reviewing')}>Mark reviewing</button><button className="button button-dark button-small" onClick={()=>reviewReport(report,'resolved')}>Resolve</button><button className="button button-light button-small" onClick={()=>reviewReport(report,'dismissed')}>Dismiss</button></div></article>)}{!moderationQueue.reports.length&&<EmptyState title="No reports" text="New user reports will appear here."/>}</div></div>
          <div className="moderation-section"><div className="section-label">EVIDENCE REVIEW · {moderationQueue.verifications.filter(v=>v.status==='pending').length} PENDING</div><div className="moderation-list">{moderationQueue.verifications.map(item=><article className="moderation-card" key={item.id}><div className="moderation-card-head"><b>{item.memberName} · {item.method}</b><span className={`status-pill status-${item.status}`}>{item.status}</span></div><p>{item.note || 'No context supplied.'}</p><p className="muted">Account: {item.memberEmail}</p>{item.evidenceUrl&&<a href={item.evidenceUrl} target="_blank" rel="noreferrer">Open public evidence ↗</a>}{item.status==='pending'&&<div className="moderation-actions"><button className="button button-dark button-small" onClick={()=>reviewVerification(item,'approve')}>Approve evidence</button><button className="button button-light button-small" onClick={()=>reviewVerification(item,'decline')}>Decline</button></div>}</article>)}{!moderationQueue.verifications.length&&<EmptyState title="No review requests" text="Public-evidence verification requests will appear here."/>}</div></div>
        </>}
        {page === 'Verification' && <>
          <PageHeading kicker="TRUST, WITH EVIDENCE" title="Make credibility visible." description="ORBITLE should reward real work, not follower counts. Request a review using public evidence that other members can independently check."/>
          <section className="verification-principles"><article><span>01</span><b>Evidence over popularity</b><p>Review a portfolio, public project, or affiliation instead of counting likes.</p></article><article><span>02</span><b>Clear badge meanings</b><p>A badge should explain what was checked—not imply that every claim is true.</p></article><article><span>03</span><b>Privacy by default</b><p>No government ID uploads, passwords, verification codes, or private documents.</p></article></section>
          {!user ? <div className="signed-out-card"><h3>Verification starts with an account.</h3><p>Sign in to request a review of public work or an affiliation.</p><button className="button button-dark" onClick={() => openAuth('login')}>Sign in ↗</button></div> : <div className="verification-layout"><section className="verification-form-card"><div className="section-label">REQUEST A REVIEW</div><h2>What can you demonstrate?</h2><p>Choose one evidence type. A pending request is not a verified badge.</p><form className="modal-form inline-form" onSubmit={submitVerification}><label>Review type<select value={verificationForm.method} onChange={e => setVerificationForm({...verificationForm,method:e.target.value})}><option value="portfolio">Portfolio / public work</option><option value="project">Project ownership or contribution</option><option value="affiliation">School or community affiliation</option></select></label><label>Public HTTPS link<input type="url" value={verificationForm.evidenceUrl} onChange={e => setVerificationForm({...verificationForm,evidenceUrl:e.target.value})} placeholder="https://…"/></label><label>Context<textarea value={verificationForm.note} onChange={e => setVerificationForm({...verificationForm,note:e.target.value})} maxLength="500" placeholder="Explain what the link demonstrates. Do not include private information."/></label><button className="button button-dark button-full" disabled={verificationRequests.some(r => r.status === 'pending')}>Submit for review ↗</button><small className="form-hint">Use public links only. Requests are stored as pending in this beta; a moderator review workflow must be set up before any badge can be approved.</small></form></section><section className="verification-history"><div className="section-label">YOUR REVIEW HISTORY</div><h2>Verification status</h2>{verificationRequests.map(r => <article className="verification-request" key={r.id}><div className="verification-request-top"><b>{r.method === 'portfolio' ? 'Portfolio / public work' : r.method === 'project' ? 'Project contribution' : 'School / community affiliation'}</b><span className={`status-pill status-${r.status}`}>{r.status}</span></div><p>{r.note || r.evidenceUrl || 'No additional context provided.'}</p>{r.evidenceUrl && <a href={r.evidenceUrl} target="_blank" rel="noreferrer">Review evidence ↗</a>}<small>Submitted {new Date(r.createdAt).toLocaleDateString()}</small></article>)}{!verificationRequests.length && <EmptyState title="No requests yet" text="Submit a public link to start a review request."/>}</section></div>}
        </>}
        {page === 'Opportunities' && <><PageHeading kicker="OPPORTUNITY RADAR" title="Find your next move." description="Explore research, competitions, mentorship, and other ways to build experience."/>{user && matchedOpportunities.length>0 && <section className="match-section"><div className="section-label">MATCHED TO YOUR DIRECTION</div><h2>Opportunities to look at first</h2><div className="match-strip">{matchedOpportunities.map(item=><article className="match-card" key={`opportunity-match-${item.id}`}><div className="match-score">{item.match}% <small>overlap</small></div><b>{item.title}</b><p>{item.organization} · {item.category}</p><button className="button button-dark button-small" onClick={()=>{setSearch(item.title);setCategory('All');document.querySelector('.workspace-content')?.scrollTo?.({top:0,behavior:'smooth'});}}>Find listing ↗</button></article>)}</div></section>}<div className="filter-row"><div className="category-tabs">{['All','Research','Competition','Hackathon','Mentorship'].map(c => <button key={c} className={category===c?'selected':''} onClick={() => setCategory(c)}>{c}</button>)}</div><button className={`button ${savedOnly?'button-dark':'button-light'} button-small`} onClick={() => { if (!user) return openAuth('login'); setSavedOnly(!savedOnly); }}>{savedOnly?'★ Saved only':'☆ Saved listings'}</button></div><div className="opportunity-list">{opportunities.map(o => <OpportunityRow key={o.id} item={o} onSave={() => toggleSave(o)} onTrack={() => trackOpportunity(o)} tracked={trackedApps.some(a=>Number(a.opportunityId)===Number(o.id))}/>)}</div>{!opportunities.length && <EmptyState title="No matches yet" text="Try a different search or category."/>}<p className="demo-note">Listings marked DEMO are illustrative examples. ORBITLE does not verify their availability or deadlines yet.</p></>}
        {page === 'Projects' && <><PageHeading kicker="PROJECT MATCHMAKING" title="Build something real." description="Find a team, contribute your skills, and create work you can show in a portfolio." action={<button className="button button-dark" onClick={() => user ? setProjectOpen(true) : openAuth('login')}>＋ Post a project</button>}/><div className="filter-row"><span>{visibleProjects.length} projects looking for collaborators</span><span>Project workspaces include tasks and evidence-backed contributions</span></div>{user && !search && matchedProjects.length > 0 && <section className="match-section"><div className="section-label">BUILD-WITH-ME MATCHING</div><h2>Projects aligned with your direction</h2><p className="muted">Ranked by shared words in your interests, goals, and each project's skills and brief. Review the project details before applying.</p><div className="match-strip">{matchedProjects.map(project=><article className="match-card" key={`project-match-${project.id}`}><div className="match-score">{project.match}% <small>overlap</small></div><b>{project.title}</b><p>{project.summary}</p><div className="tag-row">{(project.skills||[]).slice(0,3).map(skill=><span className="tag" key={skill}>{skill}</span>)}</div><button className="button button-dark button-small" onClick={()=>project.isOwner||project.hasApplied?openProjectWorkspace(project):applyProject(project)}>{project.isOwner||project.hasApplied?'Open workspace ↗':'Request to join ↗'}</button></article>)}</div></section>}<div className="project-grid">{visibleProjects.map(p => <ProjectCard key={p.id} project={p} onApply={() => applyProject(p)} onWorkspace={() => openProjectWorkspace(p)}/>)}</div>{!visibleProjects.length && <EmptyState title="No projects found" text="Try another search, or start a new project."/>}</>}
        {page === 'Project Studio' && <>
          <PageHeading kicker="COLLABORATION WORKSPACE" title={projectWorkspace?.project?.title || 'Project Studio'} description="Turn a project into visible, verifiable work. Tasks organize execution; contribution records become public only after the project owner confirms them." action={<button className="button button-light" onClick={() => selectPage('Projects')}>← All projects</button>}/>
          {workspaceBusy && <div className="signed-out-card"><h3>Opening workspace…</h3><p>Loading project tasks and contribution records.</p></div>}
          {!workspaceBusy && !projectWorkspace && <div className="signed-out-card"><h3>Choose a project workspace.</h3><p>Open a project you own or have applied to from the Projects page.</p><button className="button button-dark" onClick={() => selectPage('Projects')}>Browse projects ↗</button></div>}
          {projectWorkspace && <>
            <section className="workspace-overview"><div><div className="section-label">PROJECT BRIEF</div><h2>{projectWorkspace.project.title}</h2><p>{projects.find(p=>Number(p.id)===Number(selectedProjectId))?.summary || 'Collaborative project workspace.'}</p></div><div className="workspace-stats"><div><strong>{projectWorkspace.tasks.filter(t=>t.status==='done').length}/{projectWorkspace.tasks.length}</strong><span>Tasks complete</span></div><div><strong>{projectWorkspace.contributions.filter(c=>c.status==='confirmed').length}</strong><span>Confirmed contributions</span></div></div></section>
            <div className="workspace-grid"><section className="workspace-panel"><div className="section-label">TASK BOARD</div><h2>Move the work forward</h2><form className="workspace-form" onSubmit={submitWorkspaceTask}><input required minLength="3" maxLength="120" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="Task title"/><input maxLength="500" value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})} placeholder="Optional task details"/><button className="button button-dark button-small">＋ Add task</button></form><div className="workspace-task-list">{projectWorkspace.tasks.map(task=><article className="workspace-task" key={task.id}><div><b>{task.title}</b><p>{task.description || `Added by ${task.creatorName}`}</p><small>Created by {task.creatorName}</small></div><select aria-label={`Status for ${task.title}`} value={task.status} onChange={e=>changeTaskStatus(task,e.target.value)}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></article>)}{!projectWorkspace.tasks.length&&<p className="muted">No tasks yet. Add the first concrete next step.</p>}</div></section>
            <section className="workspace-panel"><div className="section-label">CONTRIBUTION GRAPH</div><h2>Record real work</h2><p className="muted">Describe what you contributed. The project owner reviews it before it appears as confirmed work on your profile.</p><form className="workspace-form" onSubmit={submitContribution}><input required minLength="3" maxLength="120" value={contributionForm.title} onChange={e=>setContributionForm({...contributionForm,title:e.target.value})} placeholder="Contribution title"/><textarea required minLength="10" maxLength="700" value={contributionForm.description} onChange={e=>setContributionForm({...contributionForm,description:e.target.value})} placeholder="What did you do, and what changed because of it?"/><input type="url" value={contributionForm.evidenceUrl} onChange={e=>setContributionForm({...contributionForm,evidenceUrl:e.target.value})} placeholder="Optional public HTTPS evidence link"/><button className="button button-dark button-small">Submit contribution for review</button></form><div className="contribution-list">{projectWorkspace.contributions.map(c=><article className="contribution-card" key={c.id}><div className="contribution-head"><b>{c.title}</b><span className={`status-pill status-${c.status}`}>{c.status}</span></div><small>{c.contributorName} · {new Date(c.createdAt).toLocaleDateString()}</small><p>{c.description}</p>{c.evidenceUrl&&<a href={c.evidenceUrl} target="_blank" rel="noreferrer">View evidence ↗</a>}{projectWorkspace.isOwner&&c.status==='pending'&&Number(c.userId)!==Number(user?.id)&&<div className="contribution-review"><button className="button button-dark button-small" onClick={()=>reviewContribution(c,'confirm')}>Confirm contribution</button><button className="button button-light button-small" onClick={()=>reviewContribution(c,'decline')}>Decline</button></div>}</article>)}{!projectWorkspace.contributions.length&&<p className="muted">Confirmed contributions build an evidence-backed project history.</p>}</div></section></div>
          </>}
        </>}
        {page === 'Community' && <><PageHeading kicker="PROFESSIONAL FEED" title="Ideas move when shared." description="Share what you are learning, show work in progress, and find useful conversations across your network."/><form className="composer" onSubmit={submitPost}><div className="composer-top"><span className="avatar">{user ? initials(user.name) : '?'}</span><textarea value={postBody} onChange={e => setPostBody(e.target.value)} maxLength="1000" placeholder={user ? 'What are you learning or building?' : 'Sign in to share an update.'} disabled={!user}/></div><div className="composer-bottom"><span>{postBody.length}/1000</span><button className="button button-dark button-small" disabled={!user || postBody.trim().length < 2}>Publish update ↗</button></div></form><div className="feed-filter-tabs">{['For You','Following','Research','Projects','Saved'].map(f => <button key={f} className={feedFilter===f?'selected':''} onClick={() => { if(f==='Saved'&&!user)return openAuth('login'); setFeedFilter(f); }}>{f}</button>)}</div><div className="feed-list">{visiblePosts.map(p => <article className="feed-post" key={p.id}><div className="post-header"><span className="avatar">{initials(p.author)}</span><div><strong>{p.author}</strong><small>{new Date(p.createdAt).toLocaleString()}</small></div><span className="post-tag">{p.reposted ? 'REPOSTED' : 'COMMUNITY'}</span></div><p>{p.body}</p><div className="post-action-row"><button className={`post-action ${p.liked?'is-active':''}`} onClick={() => likePost(p)}>{p.liked?'♥':'♡'} <span>{p.likes || 0} useful</span></button><button className="post-action" onClick={() => openComments(p)}>▤ <span>{p.commentCount || 0} comments</span></button><button className={`post-action ${p.reposted?'is-active':''}`} onClick={() => repostPost(p)}>↻ <span>{p.repostCount || 0} reposts</span></button><button className={`post-action ${p.bookmarked?'is-active':''}`} onClick={() => bookmarkPost(p)}>{p.bookmarked?'★':'☆'} <span>{p.bookmarked?'Saved':'Save'}</span></button><button className="post-action safety-report-action" onClick={()=>reportContent('post',p.id,'post')}>⚑ <span>Report</span></button></div>{commentTarget===p.id && <div className="comment-panel">{postComments.map(c=><div className="comment-row" key={c.id}><span className="avatar avatar-small">{initials(c.author)}</span><div><b>{c.author}</b><p>{c.body}</p><small>{new Date(c.createdAt).toLocaleString()}</small></div></div>)}{!postComments.length && <p className="muted">No comments yet. Start a constructive discussion.</p>}<form className="comment-form" onSubmit={submitComment}><input value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} maxLength="600" placeholder="Add a useful comment…" disabled={!user}/><button className="button button-dark button-small" disabled={!user||!commentDraft.trim()}>Comment</button></form></div>}</article>)}</div>{!visiblePosts.length && <EmptyState title="Nothing in this view yet" text="Publish an update or choose another feed filter."/>}</>}
        {page === 'Saved Posts' && <><PageHeading kicker="YOUR READING LIST" title="Keep the useful things." description="Posts you bookmark stay here so you can return to them when you need them."/><div className="feed-list">{posts.filter(p=>p.bookmarked).map(p=><article className="feed-post" key={p.id}><div className="post-header"><span className="avatar">{initials(p.author)}</span><div><strong>{p.author}</strong><small>{new Date(p.createdAt).toLocaleString()}</small></div><span className="post-tag">SAVED</span></div><p>{p.body}</p><div className="post-action-row"><button className="post-action is-active" onClick={() => bookmarkPost(p)}>★ <span>Remove saved post</span></button><button className="post-action" onClick={() => {setPage('Community');setCommentTarget(p.id);api(`/posts/${p.id}/comments`).then(r=>setPostComments(r.comments)).catch(err=>flash(err.message));}}>▤ <span>Open discussion</span></button></div></article>)}</div>{!posts.some(p=>p.bookmarked) && <EmptyState title="Your reading list is empty" text="Bookmark posts from the Community feed to collect useful ideas here."/>}</>}
        {page === 'Inbox' && <><PageHeading kicker="PRIVATE CONVERSATIONS" title="Your network, one-to-one." description="Direct messages are available to connected members only. Keep conversations relevant, respectful, and useful."/>{!user ? <div className="signed-out-card"><h3>Sign in to open your inbox.</h3><button className="button button-dark" onClick={() => openAuth('login')}>Sign in ↗</button></div> : <div className="inbox-layout"><aside className="inbox-rail"><div className="section-label">CONNECTED MEMBERS</div>{inboxPeople.map(person=><button className={`inbox-person ${Number(selectedDM)===Number(person.userId)?'selected':''}`} key={person.userId} onClick={() => setSelectedDM(person.userId)}><span className="avatar">{initials(person.name)}</span><span><b>{person.name}</b><small>{person.lastMessage || 'Start a conversation'}</small></span></button>)}{!inboxPeople.length && <p className="muted">Connect with a member first. Your accepted connections appear here.</p>}</aside><section className="inbox-chat">{selectedDM ? <><header className="chat-header"><div><div className="section-label">DIRECT MESSAGE</div><h2>{inboxPeople.find(p=>Number(p.userId)===Number(selectedDM))?.name || 'Conversation'}</h2></div><span className="live-label">CONNECTED</span></header><div className="chat-messages">{directMessages.map(m=><article className={`chat-message ${Number(m.senderId)===Number(user.id)?'message-own':''}`} key={m.id}><span className="avatar">{initials(m.author)}</span><div><div className="chat-message-meta"><b>{m.author}</b><time>{new Date(m.createdAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p></div></article>)}{!directMessages.length&&<div className="chat-empty"><b>Start the conversation</b><p>Send a thoughtful note about a shared interest or project.</p></div>}</div><form className="chat-composer" onSubmit={submitDirectMessage}><input value={directDraft} onChange={e=>setDirectDraft(e.target.value)} maxLength="1500" placeholder="Write a direct message…"/><button className="button button-dark button-small" disabled={!directDraft.trim()||directBusy}>{directBusy?'Sending…':'Send ↗'}</button></form><p className="chat-hint">Messages are stored in your local ORBITLE database. Messages refresh automatically every five seconds while this conversation is open.</p></> : <div className="chat-empty chat-empty-large"><span>✉</span><b>Choose a conversation</b><p>Select a connected member on the left, or connect with someone from Network.</p><button className="button button-dark button-small" onClick={()=>selectPage('Network')}>Find people ↗</button></div>}</section></div>}</>}
        {page === 'Events' && <><PageHeading kicker="COMMUNITY CALENDAR" title="Meet around an idea." description="Small events make it easier to learn together, find collaborators, and turn online connections into real conversations."/><div className="event-grid">{eventList.map(ev=><article className="event-card" key={ev.id}><div className="event-date"><b>{new Date(ev.starts_at).toLocaleDateString(undefined,{day:'2-digit'})}</b><span>{new Date(ev.starts_at).toLocaleDateString(undefined,{month:'short'})}</span></div><div className="event-body"><div className="section-label">{ev.category} · {ev.location}</div><h3>{ev.title}</h3><p>{ev.description}</p><small>Hosted by {ev.host} · {ev.attendeeCount} attending</small><div className="event-actions"><button className={`button ${ev.attending?'button-light':'button-dark'} button-small`} onClick={()=>rsvpEvent(ev)}>{ev.attending?'✓ Going':'RSVP ↗'}</button></div></div></article>)}</div>{!eventList.length&&<EmptyState title="No events scheduled" text="Community events will appear here."/>}</>}
        {page === 'Application Tracker' && <><PageHeading kicker="OPPORTUNITY WORKFLOW" title="Keep every next step moving." description="Track opportunities from first interest to outcome. These statuses are private to your account and don't imply an official application was submitted."/>{!user ? <div className="signed-out-card"><h3>Sign in to manage your tracker.</h3><button className="button button-dark" onClick={()=>openAuth('login')}>Sign in ↗</button></div> : <div className="tracker-list">{trackedApps.map(app=><article className="tracker-row" key={app.id}><div className="tracker-mark">↗</div><div className="tracker-info"><div className="section-label">{app.category} · {app.organization}</div><h3>{app.title}</h3><p>Deadline: {prettyDate(app.deadline)}</p>{app.url&&<a href={app.url} target="_blank" rel="noreferrer">Open source listing ↗</a>}</div><label className="tracker-status">My status<select value={app.status} onChange={e=>updateTrackedStatus(app,e.target.value)}>{[['interested','Interested'],['preparing','Preparing'],['applied','Applied'],['interview','Interview'],['accepted','Accepted'],['rejected','Not selected']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></article>)}{!trackedApps.length&&<div className="signed-out-card"><h3>No tracked opportunities yet.</h3><p>Open Opportunities and choose “Track” on a listing to begin.</p><button className="button button-dark" onClick={()=>selectPage('Opportunities')}>Explore opportunities ↗</button></div>}</div>}</>}

        {page === 'My Profile' && <><PageHeading kicker="YOUR PROFILE" title="Make your work visible." description="A good profile makes it easier for collaborators to understand what you care about and what you can contribute." action={<button className="button button-dark" onClick={() => { if (!user) return openAuth('login'); setProfileOpen(true); }}>Edit profile</button>}/>{user ? <div className="profile-panel"><div className="profile-cover"><div className="profile-orbit-art"><i/><i/><i/><b>{initials(user.name)}</b></div></div><div className="profile-details"><div className="profile-title"><span className="avatar avatar-large">{initials(user.name)}</span><div><h2>{user.name}</h2><p>{user.email}</p></div></div><p className="profile-bio">{user.bio || 'Add a short bio to introduce yourself and the work you want to do.'}</p><div className="section-label">INTERESTS & SKILLS</div><div className="tag-row">{(user.interests || []).length ? user.interests.map(x=><span className="tag" key={x}>{x}</span>) : <span className="muted">No interests added yet.</span>}</div><div className="profile-stats"><div><strong>{joinedCount}</strong><span>Orbits joined</span></div><div><strong>{projects.filter(p => Number(p.owner_id) === Number(user.id)).length}</strong><span>Projects created</span></div><div><strong>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined,{month:'short',year:'numeric'}) : '—'}</strong><span>Member since</span></div></div><section className="profile-work"><div className="section-label">PROOF OF WORK</div><h3>Projects in your orbit</h3>{projects.filter(p=>Number(p.owner_id)===Number(user.id)).map(p=><article key={p.id} className="profile-work-row"><span className="profile-work-mark">⌘</span><div><b>{p.title}</b><p>{p.summary}</p><div className="tag-row">{(p.skills||[]).map(skill=><span className="tag" key={skill}>{skill}</span>)}</div></div></article>)}{!projects.some(p=>Number(p.owner_id)===Number(user.id))&&<p className="muted">Create a project to start building a public record of your work.</p>}<button className="button button-light button-small" onClick={()=>selectPage('Projects')}>Explore project work ↗</button><section className="profile-contributions"><div className="section-label">CONFIRMED CONTRIBUTIONS</div><h3>{portfolio.confirmedCount || 0} verified-by-project-owner contribution{portfolio.confirmedCount===1?'':'s'}</h3>{portfolio.contributions.map(c=><article className="profile-work-row" key={c.id}><span className="profile-work-mark">✓</span><div><b>{c.title}</b><p>{c.projectTitle} · {c.description}</p>{c.evidenceUrl&&<a href={c.evidenceUrl} target="_blank" rel="noreferrer">Public evidence ↗</a>}</div></article>)}{!portfolio.contributions.length&&<p className="muted">When a project owner confirms your contribution, it will appear here. Pending claims are not shown as verified work.</p>}</section></section></div></div> : <div className="signed-out-card"><h3>Your professional story starts with a profile.</h3><p>Create an account to join Orbits, save opportunities, and collaborate on projects.</p><button className="button button-dark" onClick={() => openAuth('signup')}>Create your profile ↗</button></div>}</>}
        <footer className="footer"><span>ORBITLE © 2026</span><span>Expand your orbit. Build with purpose.</span><span><a href="#privacy" onClick={e=>{e.preventDefault();flash('Privacy policy page still needs to be written before public launch.')}}>Privacy</a> · <a href="#safety" onClick={e=>{e.preventDefault();flash('Safety and community guidelines still need to be published before public launch.')}}>Safety</a></span></footer>
        </div>
      </div>
    </main>
    {commandOpen && <div className="command-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCommandOpen(false);}}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Search ORBITLE"><div className="command-input-row"><span>⌕</span><input autoFocus value={commandQuery} onChange={e=>{setCommandQuery(e.target.value);setCommandIndex(0);}} placeholder="Search pages, communities, projects…" onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setCommandIndex(i=>Math.min(commandItems.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setCommandIndex(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&commandItems[commandIndex]){commandItems[commandIndex].run();setCommandOpen(false);} }}/><kbd>ESC</kbd></div><div className="command-results">{commandItems.map((item,i)=><button key={`${item.label}-${i}`} className={i===commandIndex?'command-selected':''} onMouseEnter={()=>setCommandIndex(i)} onClick={()=>{item.run();setCommandOpen(false);}}><span className="command-result-glyph">{item.glyph}</span><span><b>{item.label}</b><small>{item.detail}</small></span><kbd>↵</kbd></button>)}{!commandItems.length&&<p>No results found. Try another search.</p>}</div><div className="command-footer"><span>ORBITLE COMMAND MENU</span><span>↑ ↓ Navigate · Enter Open · Esc Close</span></div></section></div>}
    {notice && <div className="toast" role="status">{notice}</div>}
    {authOpen && <Modal title={authMode==='signup'?'Create your ORBITLE account':'Welcome back'} subtitle={authMode==='signup'?'Start building your professional community.':'Sign in to continue your work.'} onClose={() => setAuthOpen(false)}><form className="modal-form" onSubmit={onAuth}>{authMode==='signup' && <label>Full name<input name="name" required minLength="2" maxLength="60" placeholder="Your name" autoComplete="name"/></label>}<label>Email address<input name="email" type="email" required maxLength="254" placeholder="you@example.com" autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={authMode==='signup'?10:1} maxLength="72" placeholder={authMode==='signup'?'At least 10 characters':'Your password'} autoComplete={authMode==='signup'?'new-password':'current-password'}/></label>{authMode==='signup' && <p className="form-hint">Use a unique password. Never share your password or verification codes.</p>}<button className="button button-dark button-full" disabled={busy}>{busy?'Please wait…':authMode==='signup'?'Create account':'Sign in'}</button><p className="switch-auth">{authMode==='signup'?'Already have an account?':'New to ORBITLE?'} <button type="button" onClick={() => setAuthMode(authMode==='signup'?'login':'signup')}>{authMode==='signup'?'Sign in':'Create account'}</button></p></form></Modal>}
    {projectOpen && <Modal title="Post a project" subtitle="Be specific about the work and the teammates you need." onClose={() => setProjectOpen(false)}><form className="modal-form" onSubmit={createProject}><label>Project title<input required minLength="4" maxLength="100" value={projectForm.title} onChange={e=>setProjectForm({...projectForm,title:e.target.value})} placeholder="e.g. Student economics dashboard"/></label><label>What are you building?<textarea required minLength="15" maxLength="700" value={projectForm.summary} onChange={e=>setProjectForm({...projectForm,summary:e.target.value})} placeholder="Explain the problem, goal, and current stage."/></label><label>Skills needed (comma-separated)<input required value={projectForm.skills} onChange={e=>setProjectForm({...projectForm,skills:e.target.value})} placeholder="Research, Python, design"/></label><label>Who are you looking for?<input required minLength="3" maxLength="200" value={projectForm.lookingFor} onChange={e=>setProjectForm({...projectForm,lookingFor:e.target.value})} placeholder="A data researcher and designer"/></label><button className="button button-dark button-full">Publish project</button></form></Modal>}
    {onboardingOpen && user && <Modal title="Set your direction" subtitle="A few details help ORBITLE surface more relevant people, communities, projects, and opportunities. You can skip this and edit it later." onClose={() => setOnboardingOpen(false)}><form className="modal-form" onSubmit={finishOnboarding}><label>What are you interested in? (comma-separated)<input value={profileForm.interests} onChange={e=>setProfileForm({...profileForm,interests:e.target.value})} placeholder="Design, economics, Python, research"/></label><label>What would you like to do? (comma-separated)<input value={profileForm.goals} onChange={e=>setProfileForm({...profileForm,goals:e.target.value})} placeholder="Find collaborators, learn, find a mentor"/></label><label>What are you looking for right now?<textarea maxLength="160" value={profileForm.lookingFor} onChange={e=>setProfileForm({...profileForm,lookingFor:e.target.value})} placeholder="I want to meet people to build a project with."/></label><label>Short introduction (optional)<textarea maxLength="280" value={profileForm.bio} onChange={e=>setProfileForm({...profileForm,bio:e.target.value})} placeholder="What are you learning or building?"/></label><button className="button button-dark button-full">Finish setup ↗</button><button type="button" className="button button-light button-full" onClick={async()=>{try{const result=await api('/profile',{method:'PATCH',body:profilePayload(true)});setUser(result.user);setOnboardingOpen(false);flash('You can finish your profile any time.');}catch(err){flash(err.message);}}}>Skip for now</button></form></Modal>}
    {profileOpen && <Modal title="Edit your profile" subtitle="Only share details you are comfortable making visible." onClose={() => setProfileOpen(false)}><form className="modal-form" onSubmit={saveProfile}><label>Display name<input required minLength="2" maxLength="60" value={profileForm.name} onChange={e=>setProfileForm({...profileForm,name:e.target.value})}/></label><label>Short bio<textarea maxLength="280" value={profileForm.bio} onChange={e=>setProfileForm({...profileForm,bio:e.target.value})} placeholder="What are you learning, building, or interested in?"/></label><label>Interests and skills (comma-separated)<input value={profileForm.interests} onChange={e=>setProfileForm({...profileForm,interests:e.target.value})} placeholder="Economics, research, web development"/></label><label>Goals (comma-separated)<input value={profileForm.goals} onChange={e=>setProfileForm({...profileForm,goals:e.target.value})} placeholder="Find a mentor, build a portfolio, join a team"/></label><label>What are you looking for?<input maxLength="160" value={profileForm.lookingFor} onChange={e=>setProfileForm({...profileForm,lookingFor:e.target.value})} placeholder="A designer to collaborate on a student app"/></label><button className="button button-dark button-full">Save profile</button>{user && <button type="button" className="button button-light button-full" onClick={doLogout}>Sign out</button>}</form></Modal>}
  </div>;
}


function OrbitalGlobe({ orbits, onExplore }) {
  const sceneRef = useRef(null);
  const labels = [
    { name: orbits[0]?.name || 'RESEARCH', short: 'R', tone: 'mint', position: 'node-a' },
    { name: orbits[1]?.name || 'BUILDERS', short: 'B', tone: 'violet', position: 'node-b' },
    { name: orbits[2]?.name || 'FINANCE', short: 'F', tone: 'blue', position: 'node-c' },
    { name: orbits[3]?.name || 'DESIGN', short: 'D', tone: 'peach', position: 'node-d' },
    { name: orbits[4]?.name || 'TECH', short: 'T', tone: 'yellow', position: 'node-e' },
    { name: orbits[5]?.name || 'PEOPLE', short: 'P', tone: 'pink', position: 'node-f' }
  ];
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY || 0;
        scene.style.setProperty('--orbit-scroll-a', `${y * 0.12}deg`);
        scene.style.setProperty('--orbit-scroll-b', `${y * -0.17}deg`);
        scene.style.setProperty('--orbit-scroll-c', `${y * 0.075}deg`);
        scene.style.setProperty('--orbit-scroll-x', `${Math.sin(y * 0.0018) * 18}px`);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <section className="orbital-globe-section" ref={sceneRef} aria-label="ORBITLE global community network">
    <div className="orbital-copy">
      <div className="section-label"><span className="globe-live-dot"/> A WORLD OF POSSIBILITIES</div>
      <h2>Different paths.<br/><em>One shared orbit.</em></h2>
      <p>Ideas move further when the right people find each other. Explore communities that connect what you care about with what you can build.</p>
      <button className="button button-dark orbital-cta" onClick={onExplore}>Explore your orbits <span>↗</span></button>
      <div className="orbital-footnote"><span className="orbit-foot-line"/> A connected world starts with one connection.</div>
    </div>
    <div className="orbital-stage" aria-hidden="true">
      <div className="orbit-starfield starfield-one"/><div className="orbit-starfield starfield-two"/>
      <div className="earth-halo"/>
      <div className="earth-sphere">
        <div className="earth-cloud cloud-one"/><div className="earth-cloud cloud-two"/>
        <svg className="earth-map" viewBox="0 0 360 360" role="presentation">
          <defs><clipPath id="orbitle-earth-clip"><circle cx="180" cy="180" r="166"/></clipPath><linearGradient id="orbitle-land" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8dca7"/><stop offset="1" stopColor="#4f9278"/></linearGradient></defs>
          <g clipPath="url(#orbitle-earth-clip)" fill="url(#orbitle-land)" opacity=".95">
            <path d="M42 84l16-19 28-8 18 9 9 19-10 13-21 2-9 15-17-4-8-13-14-2zM91 120l22-7 20 11 11 22-8 19-6 21-13 15-8 29-12 9-8-19-4-24-13-18 4-24-9-13zM146 65l16-17 26-4 18 13 23-2 17 12 27 1 18 19-10 14-25-1-10 14-21-1-11 14-16-3-11 13-13-6-5-19-17-3-6-20-14-9zM187 153l20-9 23 8 17 16 5 22-12 17-12 22-8 29-14 21-11-15-3-24-13-21-3-24-14-19zM254 239l15-12 19 6 9 18-10 18-18-3-14-13zM35 235l11-7 13 6 4 13-14 8-12-6zM300 104l10-7 10 6-2 12-12 3z"/>
          </g>
          <g clipPath="url(#orbitle-earth-clip)" fill="none" stroke="#d2eee0" strokeOpacity=".22" strokeWidth="1"><ellipse cx="180" cy="180" rx="75" ry="166"/><ellipse cx="180" cy="180" rx="132" ry="166"/><ellipse cx="180" cy="180" rx="166" ry="56"/><ellipse cx="180" cy="180" rx="166" ry="112"/><path d="M14 180h332M180 14v332"/></g>
        </svg>
        <div className="earth-shine"/>
      </div>
      <div className="orbit-track orbit-track-a"><span className="orbit-track-node track-node-a"/><span className="orbit-track-node track-node-b"/></div>
      <div className="orbit-track orbit-track-b"><span className="orbit-track-node track-node-c"/><span className="orbit-track-node track-node-d"/></div>
      <div className="orbit-track orbit-track-c"><span className="orbit-track-node track-node-e"/><span className="orbit-track-node track-node-f"/></div>
      {labels.map((item, index) => <div key={`${item.position}-${index}`} className={`orbit-label ${item.position} ${item.tone}`}><span>{item.short}</span><b>{item.name}</b></div>)}
      <div className="orbital-coordinates">37° 33′ N <span>·</span> 126° 58′ E<br/><small>NETWORK / 001</small></div>
      <div className="orbital-index">ORBITAL SYSTEM <b>01—06</b></div>
    </div>
  </section>;
}

function Metric({label,value,detail,icon}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><b>{icon}</b></div><strong>{value}</strong><small>{detail}</small></div>; }
function PageHeading({kicker,title,description,action}) { return <section className="page-heading"><div><div className="section-label">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{action}</section>; }
function OrbitCard({orbit,index,onJoin}) { return <article className="orbit-card"><div className="orbit-card-top"><span className="orbit-index">0{index+1} / ORBIT</span><span className="orbit-symbol" style={{background:orbit.accent}}>◎</span></div><div><span className="category-label">{orbit.category}</span><h3>{orbit.name}</h3><p>{orbit.description}</p></div><div className="orbit-card-bottom"><span>{orbit.member_count} members</span><button className={`join-button ${orbit.joined?'joined':''}`} onClick={onJoin}>{orbit.joined?'Joined ✓':'Join orbit ↗'}</button></div></article>; }
function OpportunityRow({item,onSave,onTrack,tracked=false}) { return <article className="opportunity-row"><div className="opportunity-icon">{item.category==='Research'?'⌁':item.category==='Competition'?'✳':item.category==='Hackathon'?'⌘':'↗'}</div><div className="opportunity-info"><div className="opportunity-tags"><span>{item.category}</span>{item.isDemo && <span className="demo-label">DEMO LISTING</span>}</div><h3>{item.title}</h3><p>{item.organization} <b>·</b> {item.location}</p><small>Deadline: {prettyDate(item.deadline)} · Source: {item.source_name}</small></div><div className="opportunity-actions"><button className={`save-button ${item.saved?'saved':''}`} onClick={onSave} aria-label={item.saved?'Unsave opportunity':'Save opportunity'}>{item.saved?'★':'☆'}</button><button className={`track-button ${tracked?'tracked':''}`} onClick={onTrack}>{tracked?'✓ Tracking':'＋ Track'}</button>{item.url && <a className="open-link" href={item.url} target="_blank" rel="noreferrer">Details ↗</a>}</div></article>; }
function ProjectCard({project,onApply,onWorkspace}) { return <article className="project-card"><div className="project-top"><span className="project-mark">⌘</span><span className="recruiting-pill"><i/> {project.status || 'Recruiting'}</span></div><h3>{project.title}</h3><p>{project.summary}</p><div className="tag-row">{project.skills.map(skill=><span className="tag" key={skill}>{skill}</span>)}</div><div className="project-needs"><span>LOOKING FOR</span><strong>{project.looking_for || 'Collaborators'}</strong></div><div className="project-footer"><span>{project.owner_name ? `Started by ${project.owner_name}` : 'Community project'} · {project.applicant_count || 0} applicants</span>{project.isOwner||project.hasApplied?<button className="button button-dark button-small" onClick={onWorkspace}>Open workspace ↗</button>:<button className="button button-dark button-small" onClick={onApply}>Request to join ↗</button>}</div></article>; }
function EmptyState({title,text}) { return <div className="empty-state"><span>◎</span><h3>{title}</h3><p>{text}</p></div>; }
function Modal({title,subtitle,onClose,children}) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button><div className="section-label">ORBITLE ACCOUNT</div><h2>{title}</h2><p>{subtitle}</p>{children}</section></div>; }

createRoot(document.getElementById('root')).render(<App/>);
