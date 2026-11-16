// Special Delivery: WebGL 3D scene. No external 3D libraries required.
const experience = document.getElementById('experience');
const canvas = document.getElementById('world');
const startWindow = document.getElementById('startWindow');
const openMailbox = document.getElementById('openMailbox');
const mailboxTarget = document.getElementById('mailboxTarget');
const confettiLayer = document.getElementById('confettiLayer');
const replayButton = document.getElementById('replay');
const chapterNumber = document.getElementById('chapterNumber');
const chapterTitle = document.getElementById('chapterTitle');
const statusText = document.getElementById('status');
const caption = document.getElementById('flightCaption');
const letterOverlay = document.getElementById('letterOverlay');
const letterPaper = document.getElementById('letterPaper');
const letterBackdrop = document.getElementById('letterBackdrop');
const closeLetter = document.getElementById('closeLetter');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Interactive stationery: a page turn overlays the next sheet without changing the flight.
const letterPages = Array.from(document.querySelectorAll('.letter-page'));
const prevPageButton = document.getElementById('prevPage');
const nextPageButton = document.getElementById('nextPage');
const pageCounter = document.getElementById('pageCounter');
const pageDots = Array.from(document.querySelectorAll('#pageDots span'));
const pageAnnouncer = document.getElementById('pageAnnouncer');
let currentPage = 0;
let pageAnimating = false;
let pageAnimationToken = 0;
function finishPageChange(pageNumber) {
  currentPage = pageNumber;
  letterPages.forEach((page, index) => {
    page.classList.remove('page-current', 'page-under', 'page-turn-forward', 'page-turn-backward');
    page.classList.toggle('page-current', index === pageNumber);
    page.setAttribute('aria-hidden', index === pageNumber ? 'false' : 'true');
    page.inert = index !== pageNumber;
    if (index === pageNumber) page.querySelector('.page-content').scrollTop = 0;
  });
  prevPageButton.disabled = pageNumber === 0;
  nextPageButton.disabled = pageNumber === letterPages.length - 1;
  nextPageButton.textContent = pageNumber === letterPages.length - 1 ? 'The End ♡' : 'Next →';
  pageCounter.textContent = `${String(pageNumber + 1).padStart(2, '0')} / ${String(letterPages.length).padStart(2, '0')}`;
  pageDots.forEach((dot, index) => dot.classList.toggle('active', index === pageNumber));
  pageAnnouncer.textContent = `Page ${pageNumber + 1} of ${letterPages.length}`;
  pageAnimating = false;
}
function resetLetterPages() {
  pageAnimationToken++;
  finishPageChange(0);
}
function turnPage(direction) {
  const target = currentPage + direction;
  if (pageAnimating || target < 0 || target >= letterPages.length || letterOverlay.hidden) return;
  if (reducedMotion.matches) { finishPageChange(target); return; }
  pageAnimating = true;
  prevPageButton.disabled = true;
  nextPageButton.disabled = true;
  const outgoing = letterPages[currentPage];
  const incoming = letterPages[target];
  const token = ++pageAnimationToken;
  let animatedPage;
  let animationClass;
  if (direction > 0) {
    incoming.classList.add('page-under');
    incoming.setAttribute('aria-hidden', 'true');
    animatedPage = outgoing;
    animationClass = 'page-turn-forward';
  } else {
    outgoing.classList.add('page-under');
    outgoing.classList.remove('page-current');
    incoming.classList.add('page-turn-backward');
    animatedPage = incoming;
    animationClass = 'page-turn-backward';
  }
  if (direction > 0) animatedPage.classList.add(animationClass);
  let completed = false;
  const complete = () => {
    if (completed || token !== pageAnimationToken) return;
    completed = true;
    finishPageChange(target);
  };
  animatedPage.addEventListener('animationend', (event) => {
    if (event.target === animatedPage) complete();
  }, { once: true });
  setTimeout(complete, 1050);
}
prevPageButton.addEventListener('click', () => turnPage(-1));
nextPageButton.addEventListener('click', () => turnPage(1));
letterOverlay.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); turnPage(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); turnPage(1); }
});

let state = 'ready', startTime = 0, phaseTime = 0, frameId = 0, lastFocus = null, readStart = 0;

function setPhase(name, number, title, message) {
  state = name;
  experience.dataset.phase = name;
  chapterNumber.textContent = number;
  chapterTitle.textContent = title;
  if (message) statusText.textContent = message;
}
function showCaption(message) {
  caption.textContent = message;
  caption.classList.toggle('visible', Boolean(message));
}
const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
let rendererReady = Boolean(gl);
if (!gl) {
  rendererReady = false;
  document.getElementById('webglError').hidden = false;
  startWindow.disabled = true;
} else {
  try { initialize3D(); } catch (error) {
    console.error("3D scene failed:", error);
    rendererReady = false;
    document.getElementById("webglError").hidden = false;
    startWindow.disabled = true;
  }
}
if (!rendererReady) {
  const showLetterWithout3D = () => { resetLetterPages(); letterOverlay.hidden = false; document.body.classList.add('letter-visible'); letterPaper.focus({ preventScroll: true }); };
  const hideLetterWithout3D = () => { letterOverlay.hidden = true; document.body.classList.remove('letter-visible'); document.getElementById('fallbackLetter').focus(); };
  document.getElementById('fallbackLetter').addEventListener('click', showLetterWithout3D);
  closeLetter.addEventListener('click', hideLetterWithout3D);
  letterBackdrop.addEventListener('click', hideLetterWithout3D);
}

function initialize3D() {
  const vs = `
attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uMVP; uniform mat4 uModel;
varying vec3 vNormal; varying vec3 vColor; varying vec3 vWorld;
void main(){ vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;
vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;gl_Position=uMVP*vec4(aPosition,1.0); }
`;
  const fs = `
precision mediump float;
varying vec3 vNormal;varying vec3 vColor;varying vec3 vWorld;
uniform float uAlpha;uniform float uEmissive;uniform vec3 uEye;
void main(){
  vec3 n=normalize(vNormal);
  vec3 warm=normalize(vec3(-.50,.86,.42));
  vec3 cool=normalize(vec3(.34,.31,-.90));
  float key=max(dot(n,warm),0.0);
  float fill=max(dot(n,cool),0.0);
  float lit=.44+.49*key+.15*fill;
  vec3 col=vColor*lit + vec3(.07,.055,.038)*uEmissive;
  float edge=pow(1.0-abs(dot(n,normalize(uEye-vWorld))),3.0);
  col+=vec3(.08,.075,.061)*edge;
  float fog=1.0-exp(-length(uEye-vWorld)*.006);
  col=mix(col,vec3(.73,.65,.69),min(.33,fog*.35));
  gl_FragColor=vec4(col,uAlpha);
}`;
  function compile(type, source) {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc = { pos: gl.getAttribLocation(program, 'aPosition'), normal: gl.getAttribLocation(program, 'aNormal'), color: gl.getAttribLocation(program, 'aColor'), mvp: gl.getUniformLocation(program, 'uMVP'), model: gl.getUniformLocation(program, 'uModel'), alpha: gl.getUniformLocation(program, 'uAlpha'), emissive: gl.getUniformLocation(program, 'uEmissive'), eye: gl.getUniformLocation(program, 'uEye') };
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const ID = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  function mul(a, b) { const o = new Array(16).fill(0); for (let col = 0; col < 4; col++)for (let row = 0; row < 4; row++)for (let k = 0; k < 4; k++)o[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]; return o; }
  const T = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const S = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  const RX = a => [1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1];
  const RY = a => [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1];
  const RZ = a => [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const model = (p = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => mul(mul(mul(mul(T(...p), RY(rot[1])), RX(rot[0])), RZ(rot[2])), S(...scale));
  function norm(v) { const l = Math.hypot(...v) || 1; return v.map(n => n / l); }
  function sub(a, b) { return a.map((x, i) => x - b[i]); }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function mix(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
  function projection(fov, aspect, near, far) { const f = 1 / Math.tan(fov * Math.PI / 360); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]; }
  function lookAt(eye, target) { const z = norm(sub(eye, target)); const x = norm(cross([0, 1, 0], z)); const y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -x.reduce((s, n, i) => s + n * eye[i], 0), -y.reduce((s, n, i) => s + n * eye[i], 0), -z.reduce((s, n, i) => s + n * eye[i], 0), 1]; }
  let viewProj = ID(), eye = [0, 4, 7];
  function setCamera(position, target, fov = 49) { eye = position; viewProj = mul(projection(fov, canvas.width / canvas.height, .08, 240), lookAt(position, target)); gl.uniform3fv(loc.eye, position); }
  function geometry() { return { pos: [], norm: [], color: [] }; }
  function tri(g, a, b, c, color) { let n = norm(cross(sub(b, a), sub(c, a))); for (const p of [a, b, c]) { g.pos.push(...p); g.norm.push(...n); g.color.push(...color); } }
  function quad(g, a, b, c, d, color) { tri(g, a, b, c, color); tri(g, a, c, d, color); }
  function box(g, x, y, z, w, h, d, c) { const a = [x - w / 2, y - h / 2, z - d / 2], b = [x + w / 2, y - h / 2, z - d / 2], cc = [x + w / 2, y + h / 2, z - d / 2], dd = [x - w / 2, y + h / 2, z - d / 2], e = [x - w / 2, y - h / 2, z + d / 2], f = [x + w / 2, y - h / 2, z + d / 2], h1 = [x + w / 2, y + h / 2, z + d / 2], i = [x - w / 2, y + h / 2, z + d / 2]; quad(g, a, b, cc, dd, c); quad(g, f, e, i, h1, c.map(v => v * .92)); quad(g, e, a, dd, i, c.map(v => v * .77)); quad(g, b, f, h1, cc, c.map(v => v * .82)); quad(g, dd, cc, h1, i, c.map(v => Math.min(1, v * 1.1))); quad(g, e, f, b, a, c.map(v => v * .7)); }
  function cylinder(g, r, height, col, segments = 16) { const cap = [0, height / 2, 0], base = [0, -height / 2, 0]; for (let i = 0; i < segments; i++) { let a = i * 2 * Math.PI / segments, b = (i + 1) * 2 * Math.PI / segments; let p = [Math.cos(a) * r, height / 2, Math.sin(a) * r], q = [Math.cos(b) * r, height / 2, Math.sin(b) * r], r1 = [Math.cos(a) * r, -height / 2, Math.sin(a) * r], s = [Math.cos(b) * r, -height / 2, Math.sin(b) * r]; quad(g, p, q, s, r1, col); tri(g, cap, q, p, col); tri(g, base, r1, s, col); } }
  function sphere(g, lat = 8, lng = 12) { for (let i = 0; i < lat; i++) { let t = i * Math.PI / lat, t2 = (i + 1) * Math.PI / lat; for (let j = 0; j < lng; j++) { let p = j * 2 * Math.PI / lng, p2 = (j + 1) * 2 * Math.PI / lng; const v = (a, b) => [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]; quad(g, v(t, p), v(t2, p), v(t2, p2), v(t, p2), [1, 1, 1]); } } }
  function upload(g) { const attrs = [['pos', loc.pos], ['norm', loc.normal], ['color', loc.color]]; const bs = attrs.map(([name, index]) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(g[name]), gl.STATIC_DRAW); return { buffer: b, index }; }); return { attrs: bs, count: g.pos.length / 3 }; }
  function draw(g, m, alpha = 1, emissive = 0) { gl.uniformMatrix4fv(loc.model, false, new Float32Array(m)); gl.uniformMatrix4fv(loc.mvp, false, new Float32Array(mul(viewProj, m))); gl.uniform1f(loc.alpha, alpha); gl.uniform1f(loc.emissive, emissive); g.attrs.forEach(({ buffer, index }) => { gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index, 3, gl.FLOAT, false, 0, 0); }); gl.drawArrays(gl.TRIANGLES, 0, g.count); }
  const palette = { paper: [.99, .965, .87], paperFold: [.83, .77, .65], fold: [.92, .865, .74], gold: [.85, .63, .39], navy: [.17, .34, .49], blue: [.21, .44, .63], lightBlue: [.53, .71, .82], dark: [.065, .13, .21], red: [.85, .28, .24], wood: [.41, .29, .22], grass: [.14, .30, .31] };
  // An origami dart built from separate folded paper faces (not a flat silhouette).
  // Wingspan at the real-world flight scale is about .78 units; mailbox width is 1.74.
  const paperWhite = [.999, .988, .949], paperBright = [.976, .967, .924];
  const paperShadow = [.875, .854, .806], paperCrease = [.93, .903, .856];
  const planeG = geometry();
  const N = [0, .075, -1.53], ridge = [0, .205, -.44], spine = [0, .25, 1.19], stern = [0, -.015, 1.31];
  const LF = [-.16, .115, -.48], RF = [.16, .115, -.48];
  const LM = [-.88, .267, .15], RM = [.88, .267, .15];
  const LT = [-1.44, .39, 1.23], RT = [1.44, .39, 1.23];
  const LR = [-.23, .10, 1.28], RR = [.23, .10, 1.28];
  // Tapered outer wings, their angled folded inner panels, and a raised central spine.
  tri(planeG, N, LM, LF, paperWhite);
  tri(planeG, LM, LT, LR, paperBright);
  tri(planeG, LM, LR, LF, paperWhite);
  tri(planeG, N, LF, ridge, paperCrease);
  tri(planeG, ridge, LF, LR, paperBright);
  tri(planeG, ridge, LR, spine, paperWhite);
  tri(planeG, spine, LR, stern, paperShadow);
  tri(planeG, N, RF, RM, paperWhite);
  tri(planeG, RM, RR, RT, paperWhite);
  tri(planeG, RM, RF, RR, paperBright);
  tri(planeG, N, ridge, RF, paperCrease);
  tri(planeG, ridge, RR, RF, paperShadow);
  tri(planeG, ridge, spine, RR, paperBright);
  tri(planeG, spine, stern, RR, paperCrease);
  // Back of the single sheet, thin folded paper thickness and rear-facing keel.
  const lower = (p) => [p[0], p[1] - .014, p[2]];
  for (const [a, b, c] of [[N, LM, LF], [LM, LT, LR], [LM, LR, LF], [N, LF, ridge], [ridge, LF, LR], [ridge, LR, spine], [N, RF, RM], [RM, RR, RT], [RM, RF, RR], [N, ridge, RF], [ridge, RR, RF], [ridge, spine, RR]]) {
    tri(planeG, lower(c), lower(b), lower(a), paperShadow);
  }
  const keel = [0, -.26, 1.2], keelf = [0, -.15, -.55];
  tri(planeG, N, keelf, keel, [.86, .83, .79]);
  tri(planeG, N, keel, stern, [.90, .87, .82]);
  tri(planeG, N, stern, keel, [.82, .79, .75]);
  const plane = upload(planeG);
  const edgeG = geometry();
  function paperLine(g, a, b, width, color) {
    const v = sub(b, a), l = Math.hypot(v[0], v[2]) || 1;
    const perp = [-v[2] / l * width, .007, v[0] / l * width];
    quad(g, a.map((n, i) => n - perp[i] + (i === 1 ? .018 : 0)), b.map((n, i) => n - perp[i] + (i === 1 ? .018 : 0)),
      b.map((n, i) => n + perp[i] + (i === 1 ? .018 : 0)), a.map((n, i) => n + perp[i] + (i === 1 ? .018 : 0)), color);
  }
  paperLine(edgeG, N, ridge, .010, [.84, .78, .70]);
  paperLine(edgeG, ridge, spine, .009, [.88, .83, .76]);
  paperLine(edgeG, LF, LR, .006, [.84, .79, .72]);
  paperLine(edgeG, RF, RR, .006, [.87, .82, .76]);
  paperLine(edgeG, N, LT, .0035, [.88, .84, .78]);
  paperLine(edgeG, N, RT, .0035, [.88, .84, .78]);
  const planeEdges = upload(edgeG);
  const AIRPLANE_SCALE = .265;
  const postG = geometry(); box(postG, 0, 1.17, 0, .40, 2.35, .42, palette.wood); const post = upload(postG);
  const archOutline = [[-.87, 0], [.87, 0], [.87, .68]]; for (let i = 1; i <= 16; i++) { let a = i * Math.PI / 16; archOutline.push([.87 * Math.cos(a), .68 + .87 * Math.sin(a)]); } // ends at left shoulder
  function archMesh(g, frontZ, backZ, c, solidFront) { for (let i = 0; i < archOutline.length; i++) { const a = archOutline[i], b = archOutline[(i + 1) % archOutline.length]; quad(g, [a[0], a[1], frontZ], [b[0], b[1], frontZ], [b[0], b[1], backZ], [a[0], a[1], backZ], c); } if (solidFront) { const center = [0, .67, frontZ]; for (let i = 0; i < archOutline.length; i++) { let a = archOutline[i], b = archOutline[(i + 1) % archOutline.length]; tri(g, center, [a[0], a[1], frontZ], [b[0], b[1], frontZ], c); } } }
  const mailboxG = geometry(); archMesh(mailboxG, 1.09, -1.1, palette.blue, false);
  const capG = geometry(); archMesh(capG, -1.06, -1.15, palette.navy, true);
  const hollowG = geometry(); archMesh(hollowG, 1.045, 1.038, palette.dark, true);
  const rimG = geometry();
  for (let i = 0; i < archOutline.length; i++) { const a = archOutline[i], b = archOutline[(i + 1) % archOutline.length], c = palette.lightBlue; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const delta = .042; quad(rimG, [a[0], a[1], 1.12], [b[0], b[1], 1.12], [b[0] * 1.045 + .0, my * 0 + b[1] * 1.055 - .02, 1.12], [a[0] * 1.045, a[1] * 1.055 - .02, 1.12], c); }
  const mailbox = upload(mailboxG), backCap = upload(capG), hollow = upload(hollowG), rim = upload(rimG);
  const doorG = geometry(); const hingeX = .87; const centerD = [-hingeX, .66, 0];
  for (let i = 0; i < archOutline.length; i++) { const a = archOutline[i], b = archOutline[(i + 1) % archOutline.length]; tri(doorG, centerD, [a[0] - hingeX, a[1], 0], [b[0] - hingeX, b[1], 0], palette.lightBlue); }
  const door = upload(doorG);
  const knobG = geometry(); cylinder(knobG, .09, .10, palette.gold, 16); const knob = upload(knobG);
  const flagG = geometry(); box(flagG, 0, .49, 0, .13, 1.0, .11, palette.red); box(flagG, .19, .92, 0, .44, .25, .13, palette.red); const flag = upload(flagG);
  const rivetG = geometry(); sphere(rivetG, 6, 8); const rivet = upload(rivetG);
  const paperG = geometry(); box(paperG, 0, 0, 0, 1.1, 1.6, .06, palette.paper); const peekPaper = upload(paperG);
  // A separate physical note rises from the ORIGINAL mailbox, then rushes toward the camera.
  const deliveryPaperG = geometry();
  box(deliveryPaperG, 0, 0, 0, 1.08, 1.48, .024, palette.paper);
  box(deliveryPaperG, 0, .44, .018, .88, .048, .007, palette.gold);
  for (let j = 0; j < 4; j++)box(deliveryPaperG, -.07, .17 - j * .16, .019, .62, .018, .006, palette.paperFold);
  box(deliveryPaperG, 0, -.46, .02, .24, .24, .01, [.76, .45, .43]);
  const deliveryPaper = upload(deliveryPaperG);
  // V6: layered alpine relief with irregular rocky peaks, shadowed faces,
  // snow caps and forest foothills. Terrain stays fixed in WORLD coordinates.
  const groundG = geometry(); box(groundG, 0, -.4, 0, 160, .42, 130, [.13, .255, .293]); const ground = upload(groundG);
  const ranges = [
    { z: -117, base: 7.2, amplitude: 8.7, peaks: [[-100, 12, 15], [-66, 17, 13], [-26, 15, 16], [20, 19, 15], [69, 14, 17], [110, 16, 13]], color: [.49, .56, .65], snowline: 12.4, alpha: .95 },
    { z: -79, base: 4.3, amplitude: 5.8, peaks: [[-108, 10, 16], [-55, 12, 13], [-12, 9, 15], [39, 13, 17], [95, 10, 15]], color: [.33, .43, .52], snowline: 9.3, alpha: .97 },
    { z: -48, base: 2.3, amplitude: 3.1, peaks: [[-102, 6, 21], [-53, 6, 23], [4, 6, 19], [55, 5.4, 23], [109, 6, 21]], color: [.17, .29, .35], snowline: 99, alpha: 1 }
  ];
  function terrainNoise(x, s) {
    return .22 * Math.sin(x * .53 + s * 6.1) + .18 * Math.sin(x * .91 + s * 2.4) + .11 * Math.sin(x * 1.76 + s * 4.2);
  }
  function ridgeHeight(x, layer) {
    const r = ranges[layer]; let y = r.base;
    for (const [cx, amp, width] of r.peaks) {
      const d = Math.abs((x - cx) / width);
      y += amp * Math.exp(-Math.pow(d, 1.55));
    }
    const jag = layer === 0 ? 1.0 : layer === 1 ? .65 : .27;
    y += jag * terrainNoise(x, layer);
    y += .29 * Math.sin(x * .082 + layer * .7);
    return Math.max(r.base * .8, y);
  }
  function buildAlpineRange(layer) {
    const r = ranges[layer], g = geometry(), snow = geometry();
    const step = 1.3, front = r.z + 2.4, back = r.z - 2.4;
    for (let x = -148; x < 148; x += step) {
      const x2 = x + step, mid = (x + x2) / 2;
      const y1 = ridgeHeight(x, layer), y2 = ridgeHeight(x2, layer);
      const ym = ridgeHeight(mid, layer) - .17;
      const slope = (y2 - y1) / step;
      // Angular, shaded rock faces with broad valleys and fine irregular ridgelines.
      const lit = Math.max(.67, Math.min(1.18, 1.015 - slope * .09));
      const c = r.color.map((v, i) => Math.min(1, v * lit * (i === 2 ? 1.03 : 1)));
      const shadow = r.color.map(v => v * Math.max(.48, lit * .75));
      const highlight = r.color.map(v => Math.min(1, v * Math.min(1.32, lit * 1.15)));
      tri(g, [x, -8, front], [x2, -8, front], [mid, ym, front], shadow);
      tri(g, [x, -8, front], [mid, ym, front], [x, y1, front], c);
      tri(g, [mid, ym, front], [x2, -8, front], [x2, y2, front], highlight);
      // A small angled upper face creates a real 3D highlight when camera shifts.
      tri(g, [x, y1, front], [mid, ym, back], [mid, ym, front], c);
      tri(g, [mid, ym, front], [mid, ym, back], [x2, y2, front], shadow);
      if (layer < 2) {
        // Snow accumulates only on the higher ridges, following the outline.
        const s1 = Math.max(0, y1 - r.snowline), s2 = Math.max(0, y2 - r.snowline), sm = Math.max(0, ym - r.snowline);
        const snowDepth = layer === 0 ? 2.5 : 1.05;
        const whiten = (layer === 0 ? [.88, .91, .91] : [.72, .80, .85]);
        if (s1 > 0.1 || s2 > 0.1 || sm > .1) {
          const y1b = y1 - Math.min(snowDepth, s1 * .8), y2b = y2 - Math.min(snowDepth, s2 * .8), ymb = ym - Math.min(snowDepth, sm * .8);
          tri(snow, [x, y1b, front + .015], [mid, ymb, front + .015], [mid, ym, front + .02], whiten.map(v => v * .87));
          tri(snow, [x, y1b, front + .015], [mid, ym, front + .02], [x, y1, front + .02], whiten);
          tri(snow, [mid, ymb, front + .015], [x2, y2b, front + .015], [x2, y2, front + .02], whiten.map(v => v * .77));
          tri(snow, [mid, ymb, front + .015], [x2, y2, front + .02], [mid, ym, front + .02], whiten.map(v => v * .94));
        }
      }
    }
    return { rock: upload(g), snow: layer < 2 ? upload(snow) : null, alpha: r.alpha };
  }
  const alpineRanges = ranges.map((_, i) => buildAlpineRange(i));
  const treeG = geometry();
  for (let i = 0; i < 165; i++) {
    const x = -125 + i * 1.56, z = -45.1 + (i % 7) * .34;
    const base = ridgeHeight(x, 2) - .12;
    const h = .52 + (i % 8) * .105 + .08 * Math.sin(i * 1.9);
    const width = .18 + h * .18;
    const green = (i % 5 === 0 ? [.12, .245, .28] : i % 3 === 0 ? [.10, .225, .255] : [.135, .265, .29]);
    // Two overlapping evergreen tiers give a forested near-ridge skyline.
    tri(treeG, [x - width, base, z], [x, base + h, z], [x + width, base, z], green);
    tri(treeG, [x - width * .72, base + h * .38, z + .012], [x, base + h * 1.17, z + .012], [x + width * .72, base + h * .38, z + .012], green.map(v => v * 1.09));
  }
  const trees = upload(treeG);
  const sphereG = geometry(); sphere(sphereG, 12, 18); const puff = upload(sphereG);
  // The moon is at a FIXED 3D world coordinate: as the camera pivots,
  // it exhibits real parallax and may naturally pass out of frame.
  const MOON_POSITION = [43, 31, -155];
  function drawWorldMoon() {
    gl.depthMask(false);
    // Render the atmospheric glow as very translucent shells behind the lunar disc.
    draw(puff, model(MOON_POSITION, [0, 0, 0], [8.4, 8.4, 8.4]), .035, 1.8);
    draw(puff, model(MOON_POSITION, [0, 0, 0], [6.5, 6.5, 6.5]), .065, 1.8);
    gl.depthMask(true);
    draw(puff, model(MOON_POSITION, [0, 0, 0], [4.2, 4.2, 4.2]), 1, 3.0);
  }
  function drawLandscape() {
    for (const ridge of alpineRanges) {
      draw(ridge.rock, ID(), ridge.alpha);
      if (ridge.snow) draw(ridge.snow, ID(), ridge.alpha);
    }
    draw(trees, ID(), .93);
  }
  const windG = geometry(); box(windG, 0, 0, 0, 2.7, .023, .018, [.93, .96, 1.0]); const wind = upload(windG);
  const cloudPositions = [];
  for (let i = 0; i < 16; i++) { const x = -32 + i * 4.8, z = -24 + (i % 5) * 9, y = 7.8 + (i % 4) * 1.25; cloudPositions.push({ x, z, y, scale: 1.1 + (i % 4) * .25 }); }
  function drawClouds(time) { gl.depthMask(false); for (const c of cloudPositions) { for (let j = 0; j < 3; j++) { const drift = Math.sin(time * .09 + c.x * .2) * .7; const p = [c.x + drift + (j - 1.5) * 1.15, c.y + Math.sin(j * 2) * .28, c.z]; const sc = [c.scale * (1.25 + (j % 2) * .35), .48 * c.scale, .85 * c.scale]; draw(puff, model(p, [0, 0, 0], sc), .15, 0); } } gl.depthMask(true); }
  const MAIL = [8, 2.42, -2];
  function drawMailbox(closed, flagUp, peek) {
    draw(post, model([MAIL[0], 0, MAIL[2]]));
    const base = model(MAIL); draw(mailbox, base); draw(backCap, base); draw(hollow, base); draw(rim, base);
    for (const x of [-.67, .67]) draw(rivet, mul(base, model([x, .15, 1.13], [0, 0, 0], [.06, .06, .035])));
    const angle = 1.92 * (1 - closed);
    const doorPivot = mul(base, model([hingeX, 0, 1.19], [0, angle, 0]));
    draw(door, doorPivot); draw(knob, mul(doorPivot, model([-1.44, .64, .075], [Math.PI / 2, 0, 0])));
    const flagPivot = mul(base, model([1.02, .37, .04], [0, 0, -1.30 * (1 - flagUp)])); draw(flag, flagPivot);
    if (peek > 0) draw(peekPaper, mul(base, model([0, 1.0 + peek * .9, 1.21], [0, 0, 0], [.75, Math.min(1, peek * 1.5), 1])));
  }
  // Projects the real 3D mailbox into screen coordinates for a correctly aligned hitbox.
  function projectToScreen(point) {
    const x = point[0], y = point[1], z = point[2], m = viewProj;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.05) return null;
    return {
      x: ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * .5 + .5) * canvas.clientWidth,
      y: (.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * .5) * canvas.clientHeight
    };
  }
  function alignMailboxHitbox() {
    const points = [];
    for (const x of [6.98, 9.02]) for (const y of [2.28, 4.25]) for (const z of [-1.04, -.55]) {
      const p = projectToScreen([x, y, z]); if (p) points.push(p);
    }
    if (!points.length) return;
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const left = Math.min(...xs) - 10, top = Math.min(...ys) - 10;
    const width = Math.max(128, Math.max(...xs) - Math.min(...xs) + 20);
    const height = Math.max(115, Math.max(...ys) - Math.min(...ys) + 20);
    mailboxTarget.style.left = Math.max(0, left) + 'px';
    mailboxTarget.style.top = Math.max(0, top) + 'px';
    mailboxTarget.style.width = Math.min(canvas.clientWidth - Math.max(0, left), width) + 'px';
    mailboxTarget.style.height = Math.min(canvas.clientHeight - Math.max(0, top), height) + 'px';
  }
  function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  const flightWaypoints = [
    [-15.05, 6.46, -5.00], [-11.7, 7.04, -5.2], [-7.5, 7.48, -4.5],
    [-2.3, 7.14, -5.2], [2.15, 6.40, -4.4], [5.4, 5.16, .9],
    [7.45, 4.0, 1.65], [8.02, 3.13, .10], [8, 3.10, -1.14]
  ];
  function catmull(points, t) {
    const u = Math.max(0, Math.min(1, t)) * (points.length - 1);
    const i = Math.min(points.length - 2, Math.floor(u)), a = u - i;
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    return [0, 1, 2].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * a + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * a * a + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * a * a * a));
  }
  function planePosition(time) {
    let p;
    if (time <= 3.05) {
      const t = smooth((time - .78) / 2.27);
      p = [-23.35 + 8.3 * t, 5.44 + .98 * t, -5.0];
    } else {
      p = catmull(flightWaypoints, smooth((time - 3.05) / 7.93));
    }
    if (time > 1.08 && time < 10.35) {
      const gust = smooth((time - 1.08) / .48) * (1 - smooth((time - 10.05) / .3));
      p[1] += gust * (.045 * Math.sin(time * 7.4) + .026 * Math.sin(time * 15.8));
    }
    return p;
  }
  function planeAttitude(time) {
    const nowP = planePosition(time), nextP = planePosition(Math.min(10.94, time + .055));
    const dir = sub(nextP, nowP), horizontal = Math.hypot(dir[0], dir[2]) || 1;
    const yaw = Math.atan2(-dir[0], -dir[2]);
    const pitch = Math.atan2(dir[1], horizontal) * .65;
    let bank = .07 * Math.sin(time * 2.6) + .038 * Math.sin(time * 8.3);
    bank += .32 * smooth((time - 7.2) / 1.1) - .27 * smooth((time - 9.1) / 1.3);
    return [pitch, yaw, bank];
  }
  function setView(time) {
    if (time <= 2.9) {
      // Inside the room: the stationary camera is BEHIND the airplane.
      // It catches the airplane coming from behind the viewer, travelling away through the square window.
      setCamera([-22.16, 6.06, -5], [-15.05, 6.41, -5], 47);
      return;
    }
    if (time < 8.45) {
      const p = planePosition(time);
      const behind = [p[0] - 2.1, p[1] + .85, p[2] + 1.85];
      const orbit = [p[0] - .22, p[1] + 1.04, p[2] + 2.76];
      const side = smooth((time - 5.15) / 2.3);
      const following = mix(behind, orbit, side);
      let focus = [p[0] + .23, p[1] + .04, p[2] - .13];
      let position = following;
      if (time < 4.05) {
        const flyThrough = smooth((time - 2.9) / 1.15);
        position = mix([-22.16, 6.06, -5], behind, flyThrough);
        focus = mix([-15.05, 6.41, -5], focus, flyThrough);
      }
      const approaching = smooth((time - 7.2) / 1.25);
      position = mix(position, [10.5, 4.9, 5.25], approaching);
      focus = mix(focus, [8, 3.1, -1.65], approaching);
      if (time >= 4.1 && time <= 7.8) { position[1] += .018 * Math.sin(time * 4.2); }
      setCamera(position, focus, 38 + 9 * approaching);
    } else {
      const pivot = smooth((time - 12.9) / 2.75);
      const camera = mix([10.5, 4.9, 5.25], [8, 3.65, 4.1], pivot);
      const target = mix([8, 3.1, -1.65], [8, 3.15, -2], pivot);
      setCamera(camera, target, 46);
    }
  }
  const SPEED_LINES = 22;
  function drawAirflow(time, p, attitude) {
    if (time < 3.3 || time > 9.6) return;
    gl.depthMask(false);
    const dyaw = attitude[1];
    for (let i = 0; i < SPEED_LINES; i++) {
      let progress = (time * 6.2 + i * .87) % 10;
      const ring = (i % 6) * .53 + .65;
      const theta = i * 2.399;
      // Wind flows backwards relative to the plane's nose. No oversized cartoon trails.
      const behind = (progress - 5.5);
      const tangent = [-Math.sin(dyaw), 0, -Math.cos(dyaw)];
      const right = [Math.cos(dyaw), 0, -Math.sin(dyaw)];
      const center = [p[0] + tangent[0] * behind + right[0] * Math.cos(theta) * ring,
      p[1] + Math.sin(theta) * ring * .37, p[2] + tangent[2] * behind + right[2] * Math.cos(theta) * ring];
      draw(wind, model(center, [0, -dyaw - Math.PI / 2, 0], [.24 + i % 3 * .08, .70, 1]), .095, 0);
    }
    gl.depthMask(true);
  }
  function drawFlightPlane(time) {
    if (time < .85 || time > 10.99) return;
    const p = planePosition(time), r = planeAttitude(time);
    const landing = smooth((time - 10.37) / .61);
    const size = AIRPLANE_SCALE * (1 - .26 * landing);
    const m = model(p, r, [size, size, size]);
    const alpha = 1 - smooth((time - 10.78) / .20);
    drawAirflow(time, p, r);
    draw(plane, m, alpha, .02);
    draw(planeEdges, m, alpha, 0);
  }
  function drawLetterTowardCamera(now) {
    const seconds = (now - readStart) / 1000;
    if (seconds < .18 || seconds > 1.72) return;
    const rise = smooth((seconds - .18) / .49);
    const forward = smooth((seconds - .58) / 1.06);
    const pos = [8 + .08 * Math.sin(seconds * 4.2) * (1 - forward),
    3.06 + .66 * rise - .12 * forward,
    -.96 + .38 * rise + 3.42 * forward];
    const size = .49 + .12 * rise + .43 * forward;
    const rot = [-.13 * (1 - forward), .19 * (1 - forward), -.17 * (1 - rise) + .035 * Math.sin(seconds * 5) * (1 - forward)];
    const opacity = 1 - smooth((seconds - 1.48) / .20);
    draw(deliveryPaper, model(pos, rot, [size, size, size]), opacity, .16);
  }
  function drawScene(time) {
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 1.7);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (state === 'ready' || state === 'opening') return;
    setView(time);
    if (time > 3.15) {
      drawWorldMoon();
      drawLandscape();
      drawClouds(time);
      if (time > 7.0) draw(ground, ID(), .96);
      if (time > 7.0) {
        const reopen = state === 'reading' ? smooth((performance.now() - readStart) / 340) : 0;
        const closed = smooth((time - 11.14) / .75) * (1 - reopen);
        const flagUp = smooth((time - 12.15) / .62);
        drawMailbox(closed, flagUp, 0);
        if (state === 'reading') drawLetterTowardCamera(performance.now());
      }
    }
    drawFlightPlane(time);
  }
  let lastStamp = 0;
  function frame(now) {
    frameId = requestAnimationFrame(frame);
    if (!gl) return;
    const current = state === 'ready' || state === 'opening' ? 0 :
      (state === 'delivered' || state === 'reading' ? 16 : Math.max(0, (now - startTime) / 1000));
    if (state === 'flight') {
      if (current >= 2.67 && !experience.classList.contains('crossing')) experience.classList.add('crossing');
      let part = 0, num = '01 / 03', title = 'THROUGH THE WINDOW', message = 'The airplane passes the camera and sails out through the window.', subtitle = '';
      if (current >= 3.15 && current < 7.4) { part = 1; num = '02 / 03'; title = 'RIDING THE WIND'; message = 'A close 3D tracking shot follows the paper airplane.'; subtitle = 'Above the clouds.'; }
      else if (current >= 7.4 && current < 11.04) { part = 2; num = '02 / 03'; title = 'THE APPROACH'; message = 'The paper airplane banks and gets smaller as it nears the mailbox.'; subtitle = 'Almost there...'; }
      else if (current >= 11.04 && current < 12.99) { part = 3; num = '03 / 03'; title = 'SPECIAL DELIVERY'; message = 'The mailbox closes and its red flag rises.'; subtitle = 'Special delivery.'; }
      else if (current >= 12.99) { part = 4; num = '03 / 03'; title = 'THE FINAL SHOT'; message = 'The camera moves to the front of the mailbox.'; subtitle = 'One last message.'; }
      if (part !== phaseTime) { phaseTime = part; setPhase('flight', num, title, message); showCaption(subtitle); }
      if (current >= 15.85) { setPhase('delivered', '03 / 03', 'A LETTER FOR YOU', 'Click the 3D mailbox to open your letter.'); showCaption(''); openMailbox.disabled = false; mailboxTarget.disabled = false; }
    }
    drawScene(current);
    if (current >= 15.25 && (state === 'flight' || state === 'delivered' || state === 'reading')) alignMailboxHitbox();
    lastStamp = now;
  }
  frameId = requestAnimationFrame(frame);
  let sequenceId = 0;
  startWindow.addEventListener('click', () => {
    if (state !== 'ready') return;
    startWindow.disabled = true;
    experience.classList.remove('crossing');
    phaseTime = -1;
    setPhase('flight', '01 / 03', 'THE WINDOW OPENS', 'The window opens. A letter begins its journey.');
    showCaption(''); startTime = performance.now(); sequenceId++;
  });
  function burstFromMailbox() {
    confettiLayer.textContent = '';
    if (reducedMotion.matches) return;
    const center = projectToScreen([8, 3.32, -.67]);
    if (!center) return;
    const colors = ['#f2cf91', '#fff3db', '#cd8c87', '#98bed4', '#ddc5e0', '#f6b564'];
    for (let i = 0; i < 72; i++) {
      const piece = document.createElement('span');
      const direction = (i / 72) * Math.PI * 2 + (Math.random() - .5) * .29;
      const distance = 90 + Math.random() * 260;
      piece.className = 'confetti-bit' + (i % 6 === 0 ? ' circle' : '');
      piece.style.left = center.x + 'px'; piece.style.top = center.y + 'px';
      piece.style.setProperty('--shade', colors[i % colors.length]);
      const dx = Math.cos(direction) * distance;
      const up = -(75 + Math.random() * 190);
      piece.style.setProperty('--dx', dx + 'px');
      piece.style.setProperty('--dx13', dx * .13 + 'px');
      piece.style.setProperty('--dx57', dx * .57 + 'px');
      piece.style.setProperty('--up', up + 'px');
      piece.style.setProperty('--up37', up * .37 + 'px');
      piece.style.setProperty('--down', (120 + Math.random() * 310) + 'px');
      piece.style.setProperty('--rotation', (Math.random() - .5) * 1440 + 'deg');
      piece.style.setProperty('--duration', (1.2 + Math.random() * .6) + 's');
      piece.style.setProperty('--delay', (Math.random() * .11) + 's');
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
      confettiLayer.appendChild(piece);
    }
  }
  function revealLetter() {
    if (state !== 'delivered') return;
    lastFocus = document.activeElement;
    setPhase('reading', '03 / 03', 'YOUR LETTER', 'The mailbox opens, and your letter flies toward you.');
    openMailbox.disabled = true;
    mailboxTarget.disabled = true;
    resetLetterPages(); readStart = performance.now(); showCaption('');
    burstFromMailbox();
    const token = sequenceId;
    setTimeout(() => {
      if (token !== sequenceId || state !== 'reading') return;
      letterOverlay.hidden = false;
      document.body.classList.add('letter-visible');
      letterPaper.focus({ preventScroll: true });
    }, reducedMotion.matches ? 100 : 1710);
  }
  openMailbox.addEventListener('click', revealLetter);
  mailboxTarget.addEventListener('click', revealLetter);
  function closeTheLetter() {
    if (letterOverlay.hidden) return;
    letterOverlay.hidden = true;
    resetLetterPages();
    document.body.classList.remove('letter-visible');
    setPhase('delivered', '03 / 03', 'A LETTER FOR YOU', 'Click the 3D mailbox to open your letter again.');
    confettiLayer.textContent = '';
    openMailbox.disabled = false;
    mailboxTarget.disabled = false;
    (lastFocus || openMailbox).focus({ preventScroll: true });
  }
  closeLetter.addEventListener('click', closeTheLetter); letterBackdrop.addEventListener('click', closeTheLetter);
  function reset() { sequenceId++; phaseTime = -1; experience.classList.remove('crossing'); openMailbox.disabled = true; mailboxTarget.disabled = true; confettiLayer.textContent = ''; startWindow.disabled = false; letterOverlay.hidden = true; resetLetterPages(); document.body.classList.remove('letter-visible'); showCaption(''); setPhase('ready', '01 / 03', 'THE BEGINNING', 'A little letter is ready for its journey.'); startWindow.focus({ preventScroll: true }); }
  replayButton.addEventListener('click', reset);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTheLetter(); });
}
