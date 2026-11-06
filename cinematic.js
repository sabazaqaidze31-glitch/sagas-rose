(() => {
'use strict';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d',{alpha:false});
const status=document.querySelector('#status'),clock=document.querySelector('#clock');
const btn=document.querySelector('#toggle');

const PI = Math.PI;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = x => .5 - .5 * Math.cos(PI * clamp(x));
const mix = (a, b, t) => a + (b - a) * t;
const fract = x => x - Math.floor(x);
const rand = (x, y, k = 0) => fract(Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453);
const codeCanvas = document.createElement('canvas');
const bg = codeCanvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = 30;
const finalStart = 23.64;
const gardenEnd = 24.45;
const bouquetCloseup = { x: .36, y: .455 };
let W = 0, H = 0, DPR = 1, grid = [], gridColumns = [], cellW = 0, cellH = 0, glyphFont = '';
let messageParts = [], artwork = null, loadError = false;
let last = performance.now(), elapsed = reducedMotion ? 1.1 : 0, paused = reducedMotion, lastRender = 0;

const codeLines=[
 'def render(upper, dx, dy):    x = np.array([0.52, 0.48, 0.29], np.float32)     # luminance',
 'for row in range(height):    shade = sample(x, y)    mask = iris > pupil     return glyphs[row]',
 'if 0.10 < glow < 0.72:    color = (amber, ivory, cyan)    canvas.fillText(char, x, y)',
 'texture = np.sin(theta * 31.0 + radius * 0.26)   # contour / shadow / reflect',
 'while frame < duration:    draw_eye(t)    light = smoothstep(.04, .98, intensity)',
 'pixels[y, x] = np.clip(source * exposure + grain, 0, 255)    // vision / memory',
 'const iris = radialGradient(cx, cy, pupil, limbus);  let luminance = dot(rgb, weights);'
];
function buildCodeBackground(){
 codeCanvas.width=Math.round(W*DPR);codeCanvas.height=Math.round(H*DPR);
 bg.setTransform(DPR,0,0,DPR,0,0);
 bg.fillStyle='#030504';bg.fillRect(0,0,W,H);
 const size=clamp(W/95,10,13),lineH=size*1.36;
 bg.font=`500 ${size}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
 bg.textAlign='left';bg.textBaseline='middle';
 const rows=Math.ceil(H/lineH)+1;
 for(let row=0;row<rows;row++){
   const y=row*lineH+3,seed=Math.floor(rand(row,20)*codeLines.length);
   const s=(codeLines[seed]+'   '+codeLines[(seed+3)%codeLines.length]+'   '+codeLines[(seed+5)%codeLines.length]);
   const shift=-rand(row,18)*size*22;
   const zone=Math.abs(y-H*.50)/H;
   bg.globalAlpha=zone<.30?.22:.36;
   bg.fillStyle=row%6===0?'#8da7a2':row%4===0?'#b26a48':'#8a7770';
   bg.fillText(s,shift,y);
   if(row%5===0){
     bg.globalAlpha=.11;bg.fillStyle='#e5ae82';bg.fillText(s,shift+size*.18,y+1);
   }
 }
 bg.globalAlpha=1;
 // A dark eye socket keeps the code visible at the edges but gives the iris depth.
 const socket=bg.createRadialGradient(W*.5,H*.50,Math.min(W,H)*.10,W*.5,H*.50,Math.max(W*.70,H*.55));
 socket.addColorStop(0,'rgba(0,0,0,.38)');socket.addColorStop(.48,'rgba(0,0,0,.15)');socket.addColorStop(1,'rgba(0,0,0,.70)');
 bg.fillStyle=socket;bg.fillRect(0,0,W,H);
}
function gazeAt(t){
 // The eye makes short saccades, then settles with a small living drift.
 const drift=1.3*Math.sin(t*3.2)+.6*Math.sin(t*6.7);
 if(t<1.48)return drift*smooth(.7,1.4,t);
 if(t<1.69)return mix(0,70,ease((t-1.48)/.21))+drift;
 if(t<1.91)return mix(70,62,ease((t-1.69)/.22))+drift;
 if(t<3.03)return 62+drift;
 if(t<3.29)return mix(62,-78,ease((t-3.03)/.26))+drift;
 if(t<3.54)return mix(-78,-68,ease((t-3.29)/.25))+drift;
 if(t<4.76)return -68+drift;
 if(t<5.04)return mix(-68,3,ease((t-4.76)/.28))+drift;
 if(t<5.28)return mix(3,0,ease((t-5.04)/.24))+drift;
 return 0;
}
function gazeYAt(t){return gazeAt(t)*.07+1.4*Math.sin(t*2.1)*smooth(.7,1.4,t)*(1-smooth(5.0,5.4,t))}
function opennessAt(t){
 const opening=mix(.12,1,smooth(.02,1.10,t));
 const closing=smooth(5.39,5.55,t);
 const reopening=smooth(5.60,5.92,t);
 return opening*(1-.995*closing*(1-reopening));
}
function buildMessageMasks() {
  const layoutScale = Math.min(1, H / 390);
  const quiet = clamp(W * .116, 28, 67) * layoutScale;
  const title = clamp(W * .218, 48, 132) * layoutScale;
  const step = clamp(W / 146, 2.5, 4.8) * layoutScale;
  const top = H * .5 - quiet * .95 - title * .22;
  const specs = [
    { text: 'You asked me', y: top, start: finalStart, size: quiet },
    { text: 'where I’d gone…', y: top + quiet * 1.13, start: finalStart + .61, size: quiet },
    { text: 'I’m here.', y: top + quiet * 1.92 + title * .50, start: finalStart + 1.82, size: title, title: true }
  ];
  const mask = document.createElement('canvas'), blur = document.createElement('canvas');
  mask.width = blur.width = W;
  mask.height = blur.height = H;
  const m = mask.getContext('2d', { willReadFrequently: true });
  const b = blur.getContext('2d', { willReadFrequently: true });
  m.textAlign = 'center';
  m.textBaseline = 'middle';
  m.fillStyle = m.strokeStyle = '#fff';
  m.lineJoin = 'round';
  messageParts = [];

  for (const spec of specs) {
    m.clearRect(0, 0, W, H);
    const family = spec.title ? 'Georgia,"Times New Roman",serif' : 'ui-sans-serif,system-ui,sans-serif';
    const weight = spec.title ? 'italic 700 ' : '650 ';
    m.font = weight + spec.size + 'px ' + family;
    const size = spec.size * Math.min(1, Math.min(W * .86, 740) / m.measureText(spec.text).width);
    m.font = weight + size + 'px ' + family;
    m.lineWidth = step * .29;
    m.strokeText(spec.text, W / 2, spec.y);
    m.fillText(spec.text, W / 2, spec.y);
    const width = m.measureText(spec.text).width;
    const core = m.getImageData(0, 0, W, H).data;
    let halo;
    if (spec.title) {
      b.clearRect(0, 0, W, H);
      b.filter = 'blur(11px)';
      b.drawImage(mask, 0, 0);
      halo = b.getImageData(0, 0, W, H).data;
    }
    const x0 = Math.max(0, Math.floor((W - width) / 2 - 22));
    const x1 = Math.min(W - 1, Math.ceil((W + width) / 2 + 22));
    const y0 = Math.max(0, Math.floor(spec.y - size * .81 - 22));
    const y1 = Math.min(H - 1, Math.ceil(spec.y + size * .81 + 22));
    const points = [], glow = [];
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const index = (Math.round(y) * W + Math.round(x)) * 4 + 3;
        const seed = rand(x, y, spec.start);
        const point = { x, y, seed, delay: .44 * clamp((x - x0) / (x1 - x0)) + seed * .17 };
        if (core[index] > 61) {
          points.push({ ...point, alpha: core[index] / 255 });
        } else if (halo && halo[index] > 7 && seed > .74) {
          glow.push({ ...point, alpha: halo[index] / 255 });
        }
      }
    }
    messageParts.push({ ...spec, points, glow, step, font: m.font });
  }
}

function drawFinalMessage(t, origin) {
  if (t < finalStart - 1.52) return;
  const characters = '080A6M';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const part of messageParts) {
    const body = smooth(part.start + .36, part.start + .95, t);
    if (body > 0) {
      // A faint letter silhouette holds the word shapes together in compressed video.
      ctx.font = part.font;
      ctx.fillStyle = part.title ? '#f1c491' : '#dfcbb9';
      ctx.globalAlpha = body * .29;
      ctx.fillText(part.text, W / 2, part.y);
    }

    ctx.font = '700 ' + part.step * 1.49 + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
    ctx.fillStyle = '#d28a60';
    for (const p of part.glow) {
      const reveal = smooth(part.start + p.delay, part.start + p.delay + .55, t);
      if (reveal <= 0) continue;
      ctx.globalAlpha = Math.min(.24, p.alpha * 1.2) * reveal;
      ctx.fillText(p.seed > .86 ? '0' : '+', p.x, p.y);
    }

    for (const p of part.points) {
      const arrival = part.start + p.delay;
      const char = characters[Math.floor(p.seed * characters.length)];
      if (p.seed > .83 && t < arrival) {
        const launch = arrival - 1.28 - .23 * p.seed;
        const travel = smooth(launch, arrival, t);
        if (travel <= 0) continue;
        const spread = (p.seed - .915) * W * .45;
        const x = mix(origin.x + spread, p.x, travel);
        const y = mix(origin.y + spread * .43, p.y, travel) -
          Math.sin(Math.PI * travel) * H * (.048 + .12 * (p.seed - .83));
        ctx.fillStyle = p.seed > .93 ? '#f5c58b' : '#dc9980';
        ctx.globalAlpha = smooth(0, .21, travel) * .83;
        ctx.fillText(char, x, y);
      }
      const reveal = smooth(arrival - .08, arrival + .29, t);
      if (reveal <= 0) continue;
      ctx.fillStyle = part.title && p.seed < .26 ? '#f8c892' : '#fff2df';
      ctx.globalAlpha = (.77 + .23 * p.alpha) * reveal;
      ctx.fillText(char, p.x, p.y);
    }
  }
  ctx.restore();
}

const lens = { x: .506, y: .472, radius: .044 };
const dark = 0x050608;
const colors = Array.from({ length: 4096 }, (_, i) =>
  'rgb(' + (((i >> 8) & 15) * 17) + ',' + (((i >> 4) & 15) * 17) + ',' + ((i & 15) * 17) + ')'
);
const glyphSets = ['.:;i1+-', '17LTYxz=/+3', '02AS568BKM', '8B0W@Q#'];
const steelTones = Array.from({ length: 256 }, (_, value) =>
  value <= 8 ? value : Math.round(8 + 247 * ((value - 8) / 247) ** .74)
);
const figureTones = Array.from({ length: 256 }, (_, value) =>
  Math.round(255 * (value / 255) ** .82)
);
const upperLid = [[.145,.512],[.25,.430],[.35,.351],[.44,.314],[.51,.301],
  [.59,.309],[.67,.347],[.75,.422],[.83,.531],[.895,.604]];
const lowerLid = [[.145,.512],[.25,.605],[.35,.667],[.44,.702],[.51,.709],
  [.59,.697],[.67,.677],[.75,.662],[.83,.642],[.895,.604]];

function lidHeight(points, x) {
  for (let i = 1; i < points.length; i++) {
    const [right, height] = points[i];
    if (x <= right) {
      const [left, previous] = points[i - 1];
      return mix(previous, height, clamp((x - left) / (right - left)));
    }
  }
  return points.at(-1)[1];
}

function readPlate(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const surface = document.createElement('canvas');
        const width = surface.width = img.naturalWidth;
        const height = surface.height = img.naturalHeight;
        const pixels = surface.getContext('2d');
        pixels.drawImage(img, 0, 0);
        resolve({ width, height, aspect: width / height, data: pixels.getImageData(0, 0, width, height).data });
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = source;
  });
}

function view(plate, height, focusX, focusY, centerX = W / 2, centerY = H / 2) {
  const width = height * plate.aspect;
  return { x: centerX - width * focusX, y: centerY - height * focusY, width, height };
}

function pixelIndex(plate, u, v) {
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return -1;
  return (((v * plate.height) | 0) * plate.width + ((u * plate.width) | 0)) * 4;
}

function pixelColor(plate, index, tones) {
  const { data } = plate;
  if (tones) return (tones[data[index]] << 16) | (tones[data[index + 1]] << 8) | tones[data[index + 2]];
  return (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
}

function blend(a, b, amount) {
  if (amount <= 0) return a;
  if (amount >= 1) return b;
  return (mix(a >> 16, b >> 16, amount) << 16) |
    (mix((a >> 8) & 255, (b >> 8) & 255, amount) << 8) |
    (mix(a & 255, b & 255, amount) | 0);
}

function edgeLight(u, v, width = .12) {
  return smooth(0, width, Math.min(u, 1 - u, v, 1 - v));
}

function helmetShot(t) {
  const plate = artwork.helmet;
  const entering = smooth(2.35, 4.9, t);
  const scale = (1 + .07 * smooth(0, 2.35, t)) * Math.exp(entering * 2.7);
  const height = Math.min(H * .91, W * 1.50) * scale;
  const frame = view(plate, height, mix(.50, .602, entering), mix(.48, .506, entering));
  const exposure = mix(.55, 1, smooth(0, .7, t)) * (1 - .58 * smooth(4.13, 4.72, t));
  return (x, y) => {
    const u = (x - frame.x) / frame.width, v = (y - frame.y) / frame.height;
    const i = pixelIndex(plate, u, v);
    if (i < 0) return dark;
    const fire = (1 - smooth(.06, .24, u)) * (1 - smooth(.31, .53, v));
    const light = exposure * (1 - fire * (.10 + .085 * Math.sin(t * 10) + .05 * Math.sin(t * 19)));
    return blend(dark, pixelColor(plate, i, steelTones), light * edgeLight(u, v, .10));
  };
}

function gardenShot(t) {
  const { garden, couple } = artwork;
  const mobile = W < H * .83;
  const time = Math.max(0, t - 13.8);
  const push = smooth(14.8, 22.6, t);
  const drift = mix(-.016, .019, smooth(14.5, 20.8, t)) * W + Math.sin(time * .48) * W * .011;
  const backdropHeight = (mobile ? Math.min(H * .82, W * 1.43) : Math.max(H * .89, W / garden.aspect)) * (1 + .07 * push);
  const backdrop = view(garden, backdropHeight, mobile ? .655 : .50, .49, W / 2 + drift * .45);
  const actorHeight = Math.min(H * .81, W * .89 / couple.aspect, backdropHeight * .90) * (1 + .08 * push);
  const actors = view(couple, actorHeight, .49, .51, W / 2 + drift, H * .51);
  const lift = .043 * smooth(14.4, 16.6, t) * (1 - .72 * smooth(17.9, 21.9, t));
  const lean = .033 * Math.sin(time * .92);
  const close = smooth(20.55, 22.73, t);
  const cameraScale = 1 + close * .39;
  const flowersX = actors.x + actors.width * (.108 + lean * .9);
  const flowersY = actors.y + actors.height * (.222 - lift * .9);
  const bouquet = {
    x: mix(flowersX, W * bouquetCloseup.x, close),
    y: mix(flowersY, H * bouquetCloseup.y, close)
  };
  const sample = (screenX, screenY) => {
    const x = flowersX + (screenX - bouquet.x) / cameraScale;
    const y = flowersY + (screenY - bouquet.y) / cameraScale;
    const gx = (x - backdrop.x) / backdrop.width, gy = (y - backdrop.y) / backdrop.height;
    const gardenIndex = pixelIndex(garden, gx, gy);
    const focus = 1 - smooth(.12, .39, Math.abs(x / W - .5));
    const gardenLight = (.59 - .13 * focus) * edgeLight(gx, gy, .13);
    const ground = gardenIndex < 0 ? dark : blend(dark, pixelColor(garden, gardenIndex), gardenLight);
    let u = (x - actors.x) / actors.width, v = (y - actors.y) / actors.height;
    if (u < -.08 || u > 1.08 || v < -.09 || v > 1.08) return ground;

    // Anchor the planted foot. The torso turns and rises, then relaxes.
    const body = 1 - smooth(.16, .97, v);
    u -= body * lean;
    v += body * (lift + .008 * Math.sin(time * 2.6));

    // Loose fabric, the outer arm and bouquet respond after the torso.
    const skirt = smooth(.48, .93, u) * smooth(.26, .64, v);
    const flowers = (1 - smooth(.10, .31, u)) * smooth(.08, .18, v) * (1 - smooth(.31, .45, v));
    const hair = smooth(.49, .63, u) * (1 - smooth(.12, .34, v));
    u -= skirt * .023 * Math.sin(time * 2.2 + v * 5) + flowers * .017 * Math.sin(time * 2.3 - .7);
    v -= skirt * .025 * Math.sin(time * 2.4 - u * 4) +
      flowers * .019 * Math.sin(time * 2.1 + .8) + hair * .012 * Math.sin(time * 1.7);

    const i = pixelIndex(couple, u, v);
    if (i < 0 || couple.data[i + 3] === 0) return ground;
    let color = pixelColor(couple, i, figureTones);
    if (flowers > .3) {
      const r = color >> 16, g = (color >> 8) & 255, b = color & 255;
      const coral = flowers * smooth(12, 55, r - g);
      color = (Math.min(255, r + 32 * coral) << 16) | (g << 8) | Math.min(255, b + 23 * coral);
    }
    return blend(ground, color, couple.data[i + 3] / 255);
  };
  return { sample, bouquet };
}

function eyeShot(t, garden) {
  const plate = artwork.eye;
  const local = Math.max(0, t - 4.25);
  const aperture = opennessAt(local);
  const closed = 1 - aperture;
  const gaze = gazeAt(local) / 1580;
  const rise = gazeYAt(local) / 1050;
  const approach = smooth(9.85, 14.72, t);
  const baseWidth = Math.min(W * (W < H ? 1.15 : 1.02), H * 1.61);
  const maxZoom = Math.max(19, Math.hypot(W, H) * .57 / (baseWidth * lens.radius));
  const width = baseWidth * Math.exp(approach * Math.log(maxZoom));
  const frame = view(plate, width / plate.aspect, lens.x, mix(.515, lens.y, approach));
  const pupilX = frame.x + (lens.x + gaze) * frame.width;
  const pupilY = frame.y + (lens.y + rise) * frame.height;
  const radius = frame.width * lens.radius;
  const portal = smooth(10.9, 13.5, t);
  const insideScale = Math.min(1, radius / (H * .47));
  const finish = smooth(13.88, 14.76, t);
  for (const column of gridColumns) {
    const u = (column.x - frame.x) / frame.width;
    column.top = lidHeight(upperLid, u);
    column.bottom = lidHeight(lowerLid, u);
  }
  return (x, y, column) => {
    const u = (x - frame.x) / frame.width, v = (y - frame.y) / frame.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return dark;
    let sourceU = u, sourceV = v;
    if (u > upperLid[0][0] && u < upperLid.at(-1)[0]) {
      const top = column.top, bottom = column.bottom;
      const upper = top + (bottom - top) * closed * .81;
      const lower = bottom - (bottom - top) * closed * .19;
      const lidDepth = Math.min(.026, (bottom - top) * .17) * closed;
      if (v < upper) {
        sourceV = v * (top - lidDepth * .38) / upper;
      } else if (v > lower) {
        const skin = bottom + lidDepth;
        sourceV = skin + (v - lower) * (1 - skin) / (1 - lower);
      } else {
        sourceV = mix(top, bottom, (v - upper) / (lower - upper));
        const iris = 1 - smooth(.125, .276, Math.abs(u - lens.x));
        const rim = smooth(0, .05, Math.min(sourceV - top, bottom - sourceV));
        sourceU -= gaze * iris * rim;
        sourceV -= rise * iris * rim;
      }
    }
    const i = pixelIndex(plate, sourceU, sourceV);
    let color = i < 0 ? dark : blend(dark, pixelColor(plate, i), edgeLight(u, v, .17));
    if (portal > 0) {
      const reflectedWindow = 1 - smooth(.7, 1.2, Math.hypot((u - .558) / .032, (v - .437) / .038));
      color = blend(color, dark, reflectedWindow * portal * .76);
      const dx = x - pupilX, dy = y - pupilY;
      const edge = 1 - smooth(.76, 1.02, Math.hypot(dx, dy) / radius);
      if (edge > 0 || finish > 0) {
        const memory = garden(W / 2 + dx / insideScale, H / 2 + dy / insideScale);
        color = blend(color, memory, mix(edge * portal, 1, finish));
      }
    }
    return color;
  };
}

function renderGlyphs(sampler) {
  ctx.font = glyphFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const point of grid) {
    const color = sampler(point.x, point.y, point.column, point.seed);
    const r = color >> 16, g = (color >> 8) & 255, b = color & 255;
    const light = .213 * r + .715 * g + .072 * b;
    if (light < 12) continue;
    const chars = glyphSets[light > 153 ? 3 : light > 84 ? 2 : light > 44 ? 1 : 0];
    const gain = light < 60 ? 1.34 : 1.52;
    const key = (Math.min(15, Math.round(r * gain / 17)) << 8) |
      (Math.min(15, Math.round(g * gain / 17)) << 4) | Math.min(15, Math.round(b * gain / 17));
    ctx.fillStyle = colors[key];
    ctx.fillText(chars[(point.seed * chars.length) | 0], point.x, point.y);
  }
}

function floatingGlyphs(t, amount) {
  if (amount <= 0) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = glyphFont;
  const chars = '01+*';
  for (let i = 0; i < 26; i++) {
    const y = H * (.14 + .72 * fract(rand(i, 4) + (t - 14) * (.023 + rand(i, 5) * .038)));
    const x = W * (.07 + .86 * rand(i, 7)) + Math.sin(t * .8 + i) * (12 + i % 7);
    const alpha = smooth(0, .11, y / H) * (1 - smooth(.83, 1, y / H));
    ctx.globalAlpha = amount * alpha * (.25 + rand(i, 6) * .49);
    ctx.fillStyle = i % 3 === 0 ? '#ffe3bb' : '#ef9c85';
    ctx.fillText(chars[i % chars.length], x, y);
  }
  ctx.globalAlpha = 1;
}

function setup() {
  W = innerWidth;
  H = innerHeight;
  DPR = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cellH = clamp(Math.sqrt(W * H / 21000), 4.8, 11);
  cellW = cellH * .69;
  glyphFont = '600 ' + (cellH * 1.06) + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  grid = [];
  gridColumns = [];
  for (let column = 0; column * cellW < W; column++) {
    const x = (column + .5) * cellW;
    const eyeColumn = { x, top: 0, bottom: 1 };
    gridColumns.push(eyeColumn);
    for (let row = 0; row * cellH < H; row++) {
      grid.push({ x, y: (row + .5) * cellH, seed: rand(column, row), column: eyeColumn });
    }
  }
  buildCodeBackground();
  buildMessageMasks();
  lastRender = 0;
}

function render(t) {
  ctx.fillStyle = '#030405';
  ctx.fillRect(0, 0, W, H);
  const code = (1 - smooth(10.6, 14.9, t)) * .54;
  if (code > 0) {
    ctx.globalAlpha = code;
    ctx.drawImage(codeCanvas, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (!artwork) return;

  let messageOrigin = { x: W * bouquetCloseup.x, y: H * bouquetCloseup.y };
  if (t < 4.20) {
    renderGlyphs(helmetShot(t));
  } else if (t < 14.76) {
    const eye = eyeShot(t, t >= 10.9 ? gardenShot(t).sample : null);
    const transition = smooth(4.2, 4.95, t);
    const helmet = transition < 1 ? helmetShot(t) : null;
    renderGlyphs(helmet ? (x, y, column) => {
      const slit = 1 - smooth(transition * .57, transition * .57 + .15, Math.abs(y / H - .5));
      return blend(helmet(x, y), eye(x, y, column), transition * slit);
    } : eye);
  } else if (t < gardenEnd) {
    const { sample, bouquet } = gardenShot(t);
    messageOrigin = bouquet;
    const dissolve = smooth(21.77, gardenEnd, t);
    const lastLight = smooth(21.52, 22.26, t) * (1 - smooth(22.41, 23.55, t));
    renderGlyphs(dissolve > 0 || lastLight > 0 ? (x, y, column, seed) => {
      const distance = Math.hypot((x - bouquet.x) / W, (y - bouquet.y) / H);
      // Let the periphery recede first, leaving the flowers to release the words.
      const remaining = 1 - smooth(.02, .94, dissolve * (1 + .55 * distance + .16 * seed));
      const bloom = (1 - smooth(.025, .21, distance)) * lastLight * .17;
      return blend(dark, blend(sample(x, y), 0xd99564, bloom), remaining);
    } : sample);
    floatingGlyphs(t, (1 - dissolve) * smooth(14.8, 16.4, t));
  }
  drawFinalMessage(t, messageOrigin);
}

function updateTimelineUI() {
  if (loadError) status.textContent = 'ARTWORK COULD NOT LOAD';
  else if (!artwork) status.textContent = 'LOADING';
  else if (elapsed < 4.2) status.textContent = '01 / THE VISOR';
  else if (elapsed < 9.85) status.textContent = '02 / BETWEEN BLINKS';
  else if (elapsed < 14.76) status.textContent = '03 / THROUGH THE PUPIL';
  else if (elapsed < finalStart) status.textContent = '04 / THE BOUQUET';
  else status.textContent = '05 / FOR YOU';
  clock.textContent = '00:' + String(Math.floor(elapsed)).padStart(2, '0');
}

function syncPauseButton() {
  const finished = elapsed >= duration;
  btn.textContent = finished ? '↻   Replay' : paused ? '▶   Resume' : 'Ⅱ   Pause';
  btn.setAttribute('aria-label', finished ? 'Replay animation' : paused ? 'Resume animation' : 'Pause animation');
}

function frame(now) {
  const dt = Math.min(.10, (now - last) / 1000);
  last = now;
  if (artwork && !paused) {
    elapsed = Math.min(duration, elapsed + dt);
    if (elapsed >= duration) {
      paused = true;
      lastRender = 0;
      syncPauseButton();
    }
  }
  if (lastRender === 0 || (!paused && artwork && now - lastRender > 30)) {
    lastRender = now;
    render(elapsed);
    updateTimelineUI();
  }
  requestAnimationFrame(frame);
}

function replay() {
  if (!artwork) return;
  elapsed = 0;
  paused = false;
  last = performance.now();
  lastRender = 0;
  syncPauseButton();
}

function togglePlayback() {
  if (!artwork) return;
  if (elapsed >= duration) return replay();
  paused = !paused;
  syncPauseButton();
}

const replayButton = document.querySelector('#replay');
btn.addEventListener('click', togglePlayback);
replayButton.addEventListener('click', replay);
canvas.addEventListener('click', replay);
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLButtonElement) return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePlayback();
  }
  if (event.key.toLowerCase() === 'r') replay();
});
window.addEventListener('resize', setup);

setup();
syncPauseButton();
requestAnimationFrame(frame);
window.__artworkReady = Promise.all(Object.entries(window.betweenBlinksArtwork || {}).map(
  async ([name, source]) => [name, await readPlate(source)]
)).then(entries => {
  if (entries.length !== 4) throw new Error('Missing artwork');
  artwork = Object.fromEntries(entries);
  btn.disabled = replayButton.disabled = false;
  last = performance.now();
  lastRender = 0;
}).catch(error => {
  loadError = true;
  lastRender = 0;
  console.error('Unable to load cinematic artwork', error);
});

window.__previewTime = t => {
  paused = true;
  elapsed = clamp(t, 0, duration);
  syncPauseButton();
  render(elapsed);
  updateTimelineUI();
};
})();
