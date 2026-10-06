import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const START_YAW = 0.06;
const TURN = Math.PI * 2;
const SHIFT = 0.2;

function linger(t) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

const HW = 3.22;
const BASE = 0.5;
const PEAK = 7.35;
const DEPTH = 4.55;

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function makeCanvasTexture(draw, w = 512, h = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function seamTexture() {
  return makeCanvasTexture((ctx) => {
    ctx.fillStyle = "#101216";
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 18; x < 512; x += 36) {
      ctx.fillStyle = "#07080a";
      ctx.fillRect(x, 0, 4, 512);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + 4, 0, 1, 512);
    }
  });
}

function deckTexture() {
  return makeCanvasTexture((ctx) => {
    const plank = 34;
    for (let y = 0; y < 512; y += plank) {
      const shift = ((y / plank) % 2) * 0.04;
      ctx.fillStyle = y % (plank * 2) === 0 ? "#c4894f" : "#b47b43";
      ctx.fillRect(0, y, 512, plank - 2);
      ctx.fillStyle = "#6b4428";
      ctx.fillRect(0, y + plank - 2, 512, 2);
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#4a2c16";
      ctx.beginPath();
      ctx.moveTo(0, y + 8);
      ctx.lineTo(512, y + 8 + shift * 20);
      ctx.moveTo(0, y + 20);
      ctx.lineTo(512, y + 19);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });
}

function boardTexture() {
  return makeCanvasTexture((ctx) => {
    const board = 28;
    for (let x = 0; x < 512; x += board) {
      const tone = x % (board * 2) === 0 ? "#16181c" : "#101216";
      ctx.fillStyle = tone;
      ctx.fillRect(x, 0, board - 2, 512);
      ctx.fillStyle = "#060708";
      ctx.fillRect(x + board - 2, 0, 2, 512);
    }
  });
}

function interiorTexture() {
  return makeCanvasTexture((ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#3a2418");
    sky.addColorStop(0.42, "#c4622a");
    sky.addColorStop(0.72, "#e8873a");
    sky.addColorStop(1, "#6a3418");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 512);
    const lamp = ctx.createRadialGradient(256, 150, 8, 256, 168, 150);
    lamp.addColorStop(0, "rgba(255, 214, 150, 0.95)");
    lamp.addColorStop(0.25, "rgba(255, 140, 50, 0.55)");
    lamp.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#1a120e";
    ctx.fillRect(118, 188, 276, 5);
    for (const x of [132, 256, 372]) {
      ctx.fillRect(x, 188, 4, 28);
    }
    ctx.fillStyle = "#2a1c16";
    ctx.fillRect(146, 360, 220, 78);
    ctx.fillRect(156, 332, 200, 36);
    ctx.fillStyle = "#4a3024";
    ctx.fillRect(70, 470, 372, 42);
  }, 512, 512);
}

function reflectTexture() {
  return makeCanvasTexture((ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    const band = ctx.createLinearGradient(0, 0, 512, 512);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.42, "rgba(255,244,230,0.0)");
    band.addColorStop(0.52, "rgba(255,248,240,0.55)");
    band.addColorStop(0.62, "rgba(255,244,230,0)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, 512, 512);
  });
}

function groundTexture() {
  return makeCanvasTexture((ctx) => {
    const glow = ctx.createRadialGradient(256, 256, 16, 256, 256, 250);
    glow.addColorStop(0, "rgba(32, 31, 28, 0.96)");
    glow.addColorStop(0.42, "rgba(24, 23, 21, 0.55)");
    glow.addColorStop(0.72, "rgba(20, 18, 16, 0.16)");
    glow.addColorStop(1, "rgba(20, 18, 16, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 700; i += 1) {
      const x = (i * 47) % 512;
      const y = (i * 91) % 512;
      const dx = x - 256;
      const dy = y - 256;
      if (dx * dx + dy * dy > 190 * 190) continue;
      ctx.fillStyle = i % 3 === 0 ? "rgba(86, 84, 74, 0.28)" : "rgba(8, 8, 7, 0.32)";
      ctx.fillRect(x, y, 2, 2);
    }
  });
}

function tri(half, base, peak) {
  const shape = new THREE.Shape();
  shape.moveTo(-half, base);
  shape.lineTo(0, peak);
  shape.lineTo(half, base);
  shape.closePath();
  return shape;
}

function addHole(shape, half, base, peak) {
  const hole = new THREE.Path();
  hole.moveTo(-half, base);
  hole.lineTo(half, base);
  hole.lineTo(0, peak);
  hole.closePath();
  shape.holes.push(hole);
}

function insetTriangle(half, base, peak, dist) {
  const rise = peak - base;
  const edge = Math.hypot(half, rise);
  const pLx = -half + (rise / edge) * dist;
  const pLy = base + (-half / edge) * dist;
  const yBase = base + dist;
  const baseX = pLx + half * ((yBase - pLy) / rise);
  const peakY = pLy + rise * (-pLx / half);
  return { half: Math.abs(baseX), base: yBase, peak: peakY };
}

export function mountHouseScene(stage, { reducedMotion, desktop }) {
  if (!webglAvailable()) return { stop() {} };

  const canvas = document.createElement("canvas");
  canvas.className = "house-webgl";
  canvas.setAttribute("aria-hidden", "true");
  stage.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    canvas.remove();
    return { stop() {} };
  }

  const geos = [];
  const mats = [];
  const textures = [];
  const seam = seamTexture();
  const deckMap = deckTexture();
  const boards = boardTexture();
  const groundMap = groundTexture();
  const interiorMap = interiorTexture();
  const reflectMap = reflectTexture();
  interiorMap.wrapS = THREE.ClampToEdgeWrapping;
  interiorMap.wrapT = THREE.ClampToEdgeWrapping;
  reflectMap.wrapS = THREE.ClampToEdgeWrapping;
  reflectMap.wrapT = THREE.ClampToEdgeWrapping;
  textures.push(seam, deckMap, boards, groundMap, interiorMap, reflectMap);
  seam.repeat.set(2.4, 1);
  deckMap.repeat.set(3.2, 1.6);
  boards.repeat.set(1.8, 1.1);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  textures.forEach((texture) => {
    texture.anisotropy = maxAniso;
  });

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.08, 160);
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0xc5d4e8, 0x2a2118, 0.46));
  const sun = new THREE.DirectionalLight(0xffc9a0, 2.05);
  sun.position.set(7.5, 11, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9eb6d6, 0.42);
  fill.position.set(-8, 6, 5);
  scene.add(fill);

  function trackGeo(geo) {
    geos.push(geo);
    return geo;
  }
  function trackMat(mat) {
    mats.push(mat);
    return mat;
  }

  const roofMat = trackMat(new THREE.MeshStandardMaterial({
    map: seam,
    color: 0x1a1c20,
    roughness: 0.84,
    metalness: 0.22,
    envMapIntensity: 0.16,
    side: THREE.DoubleSide,
  }));
  const black = trackMat(new THREE.MeshStandardMaterial({
    color: 0x121418,
    roughness: 0.58,
    metalness: 0.16,
    envMapIntensity: 0.18,
  }));
  const cladMat = trackMat(new THREE.MeshStandardMaterial({
    map: boards,
    roughness: 0.78,
    metalness: 0.08,
    envMapIntensity: 0.12,
  }));
  const wood = trackMat(new THREE.MeshStandardMaterial({
    color: 0xc4894f,
    roughness: 0.58,
    metalness: 0.02,
    envMapIntensity: 0.18,
  }));
  const deckMat = trackMat(new THREE.MeshStandardMaterial({
    map: deckMap,
    roughness: 0.72,
    metalness: 0.02,
    envMapIntensity: 0.14,
  }));
  const glassMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xfff4ea,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.14,
    envMapIntensity: 1.15,
    emissive: 0xffb060,
    emissiveIntensity: 0.08,
    depthWrite: false,
  }));
  const interiorMat = trackMat(new THREE.MeshStandardMaterial({
    map: interiorMap,
    emissive: 0xffffff,
    emissiveMap: interiorMap,
    emissiveIntensity: 0.95,
    roughness: 1,
  }));
  const reflectMat = trackMat(new THREE.MeshBasicMaterial({
    map: reflectMap,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.28,
  }));
  const warm = trackMat(new THREE.MeshStandardMaterial({
    color: 0xffc27a,
    emissive: 0xff8a32,
    emissiveIntensity: 1.35,
    roughness: 0.4,
  }));
  const sofaMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x3a2c28,
    roughness: 0.86,
    metalness: 0,
  }));
  const potMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x1a1816,
    roughness: 0.8,
  }));
  const leafMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x243028,
    roughness: 0.9,
  }));
  const groundMat = trackMat(new THREE.MeshStandardMaterial({
    map: groundMap,
    transparent: true,
    roughness: 1,
    metalness: 0,
    depthWrite: false,
  }));

  const subject = new THREE.Group();
  scene.add(subject);

  function add(geo, mat, x, y, z, parent = subject) {
    const mesh = new THREE.Mesh(trackGeo(geo), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addSlope(x0, y0, x1, y1, z0 = -DEPTH / 2 - 0.12, z1 = DEPTH / 2 + 0.2) {
    const geo = trackGeo(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.Float32BufferAttribute([
      x0, y0, z0,
      x1, y1, z0,
      x0, y0, z1,
      x1, y1, z1,
    ], 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([
      0, 0,
      0, 1,
      1, 0,
      1, 1,
    ], 2));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    subject.add(mesh);
  }

  const annexTop = 2.02;
  const annexInner = -2.68;
  const annexW = 2.28;
  const annexD = DEPTH - 0.7;
  const annexZ = -0.16;
  const annexX = annexInner - annexW / 2;

  addSlope(0, PEAK + 0.04, HW + 0.16, BASE - 0.02);
  const annexFrontZ = annexZ + annexD / 2;
  const annexBackZ = annexZ - annexD / 2;
  addSlope(0, PEAK + 0.04, -HW - 0.04, BASE - 0.02, -DEPTH / 2 - 0.12, annexBackZ);
  addSlope(0, PEAK + 0.04, annexInner + 0.02, annexTop + 0.06, annexBackZ, annexFrontZ);
  addSlope(0, PEAK + 0.04, -HW - 0.04, BASE - 0.02, annexFrontZ, DEPTH / 2 + 0.2);
  add(new THREE.BoxGeometry(0.14, 0.1, DEPTH + 0.55), black, 0, PEAK + 0.08, 0.04);

  const woodBand = insetTriangle(HW, BASE, PEAK, 0.2);
  const glassEdge = insetTriangle(HW, BASE, PEAK, 0.4);

  function addFascia(z, rotY) {
    const shape = tri(HW, BASE, PEAK);
    addHole(shape, woodBand.half, woodBand.base, woodBand.peak);
    const mesh = new THREE.Mesh(trackGeo(new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: false,
    })), black);
    mesh.position.z = z;
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    subject.add(mesh);

    const soffitShape = tri(woodBand.half, woodBand.base, woodBand.peak);
    addHole(soffitShape, glassEdge.half, glassEdge.base, glassEdge.peak);
    const soffit = new THREE.Mesh(trackGeo(new THREE.ExtrudeGeometry(soffitShape, {
      depth: 0.1,
      bevelEnabled: false,
    })), wood);
    soffit.position.z = z + (rotY === 0 ? 0.05 : -0.05);
    soffit.rotation.y = rotY;
    soffit.castShadow = true;
    subject.add(soffit);
  }

  addFascia(DEPTH / 2 - 0.02, 0);
  addFascia(-DEPTH / 2 + 0.02, Math.PI);

  const opening = {
    half: glassEdge.half - 0.03,
    base: glassEdge.base + 0.015,
    peak: glassEdge.peak - 0.04,
  };
  const glassShape = tri(opening.half, opening.base, opening.peak);
  const glassMesh = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(glassShape)), glassMat);
  glassMesh.position.z = DEPTH / 2 + 0.16;
  subject.add(glassMesh);

  const interior = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(glassShape)), interiorMat);
  interior.position.z = 0.55;
  subject.add(interior);
  const reflection = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(glassShape)), reflectMat);
  reflection.position.z = DEPTH / 2 + 0.2;
  subject.add(reflection);

  function slopeY(x) {
    const span = opening.peak - opening.base;
    return opening.base + span * (1 - Math.abs(x) / opening.half);
  }
  function addBar(w, h, d, x, y, z) {
    if (w < 0.02 || h < 0.02) return;
    add(new THREE.BoxGeometry(w, h, d), black, x, y, z);
  }
  const transomY = opening.base + (opening.peak - opening.base) * 0.55;
  const mullionZ = DEPTH / 2 + 0.26;
  const doorZ = mullionZ + 0.02;
  const deckLine = 0.52;
  const doorHalf = 0.76;
  const transomHalf = opening.half * (1 - 0.55) + 0.03;
  addBar(transomHalf * 2, 0.055, 0.05, 0, transomY, mullionZ);
  const sillW = opening.half - doorHalf;
  const sillX = (opening.half + doorHalf) / 2;
  addBar(sillW, 0.05, 0.05, -sillX, opening.base, mullionZ);
  addBar(sillW, 0.05, 0.05, sillX, opening.base, mullionZ);

  [-2.02, -1.4, -doorHalf, doorHalf, 1.4, 2.02].forEach((x) => {
    const y0 = Math.abs(x) < doorHalf + 0.01 ? deckLine : opening.base;
    const y1 = slopeY(Math.abs(x) + 0.04) - 0.015;
    addBar(0.05, y1 - y0, 0.05, x, (y0 + y1) / 2, mullionZ);
  });
  addBar(doorHalf * 2, 0.055, 0.05, 0, deckLine + 0.02, doorZ);
  addBar(0.045, transomY - deckLine, 0.045, 0, (deckLine + transomY) / 2, doorZ);

  const rear = tri(glassEdge.half - 0.04, glassEdge.base + 0.02, glassEdge.peak - 0.08);
  const rearHole = new THREE.Path();
  rearHole.moveTo(-0.34, 2.85);
  rearHole.lineTo(0.34, 2.85);
  rearHole.lineTo(0.34, 3.85);
  rearHole.lineTo(-0.34, 3.85);
  rearHole.closePath();
  rear.holes.push(rearHole);
  const rearMesh = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(rear)), cladMat);
  rearMesh.position.z = -DEPTH / 2 - 0.04;
  rearMesh.rotation.y = Math.PI;
  rearMesh.castShadow = true;
  rearMesh.receiveShadow = true;
  subject.add(rearMesh);
  const rearGlass = add(new THREE.PlaneGeometry(0.62, 0.92), glassMat, 0, 3.35, -DEPTH / 2 - 0.08);
  rearGlass.rotation.y = Math.PI;

  add(new THREE.BoxGeometry(annexW, annexTop, annexD), cladMat, annexX, annexTop / 2, annexZ);
  add(new THREE.BoxGeometry(annexW + 0.14, 0.08, annexD + 0.12), black, annexX, annexTop + 0.02, annexZ);
  {
    const winZ = annexZ + annexD / 2 + 0.03;
    const winX = annexX + 0.2;
    const winY = 1.15;
    add(new THREE.BoxGeometry(0.7, 0.86, 0.04), black, winX, winY, winZ);
    add(new THREE.BoxGeometry(0.52, 0.66, 0.03), warm, winX, winY, winZ + 0.02);
    add(new THREE.BoxGeometry(0.03, 0.66, 0.02), black, winX, winY, winZ + 0.035);
  }

  const deckTop = 0.52;
  const deckD = 2.05;
  const deckFront = DEPTH / 2 - 0.05;
  const deckX0 = annexX - annexW / 2 + 0.08;
  const deckX1 = HW + 0.05;
  const deckW = deckX1 - deckX0;
  const deckX = (deckX0 + deckX1) / 2;
  const deckZ = deckFront + deckD / 2;
  add(new THREE.BoxGeometry(deckW, 0.16, deckD), deckMat, deckX, deckTop - 0.08, deckZ);
  add(new THREE.BoxGeometry(deckW - 0.08, 0.28, deckD - 0.1), black, deckX, 0.16, deckZ);

  const stepW = 2.35;
  const stepX = annexX + 0.15;
  const stepRun = 0.5;
  for (let i = 0; i < 3; i += 1) {
    const top = deckTop - (i + 1) * 0.145;
    add(
      new THREE.BoxGeometry(stepW, 0.1, stepRun),
      deckMat,
      stepX,
      top - 0.05,
      deckFront + deckD + i * stepRun + stepRun / 2,
    );
  }

  add(new THREE.CylinderGeometry(0.2, 0.16, 0.28, 16), potMat, HW - 0.35, deckTop + 0.14, DEPTH / 2 + 1.15);
  add(new THREE.SphereGeometry(0.34, 16, 12), leafMat, HW - 0.35, deckTop + 0.48, DEPTH / 2 + 1.15);

  function bollard(x, z) {
    add(new THREE.CylinderGeometry(0.055, 0.065, 0.42, 12), black, x, 0.21, z);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 12), warm, x, 0.45, z);
  }
  const stepFront = deckFront + deckD + 3 * stepRun;
  bollard(stepX - 0.95, stepFront + 0.35);
  bollard(stepX + 1.15, stepFront + 0.15);

  add(new THREE.BoxGeometry(opening.half * 1.35, 0.08, DEPTH - 1.5), wood, 0.05, 0.62, 0.15);
  add(new THREE.BoxGeometry(1.85, 0.4, 0.62), sofaMat, 0.02, 0.98, 1.25);
  add(new THREE.BoxGeometry(1.85, 0.46, 0.16), sofaMat, 0.02, 1.32, 1.02);
  add(new THREE.BoxGeometry(0.72, 0.06, 0.42), wood, 0.02, 0.82, 1.7);
  const railY = opening.base + (opening.peak - opening.base) * 0.62;
  add(new THREE.BoxGeometry(1.55, 0.04, 0.04), black, 0, railY, 1.05);
  [-0.85, 0, 0.85].forEach((x) => {
    add(new THREE.BoxGeometry(0.035, 0.32, 0.035), black, x, railY - 0.14, 1.05);
  });
  add(new THREE.SphereGeometry(0.1, 16, 12), warm, 0, 3.45, 1.15);
  const pendant = new THREE.PointLight(0xffb15a, 6, 9, 2);
  pendant.position.set(0, 3.25, 1.15);
  subject.add(pendant);
  const room = new THREE.PointLight(0xff8a3c, 3.2, 8, 2);
  room.position.set(0.1, 1.7, 0.9);
  subject.add(room);

  const ao = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(5.4, 40)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })),
  );
  ao.rotation.x = -Math.PI / 2;
  ao.position.y = 0.012;
  scene.add(ao);
  const ground = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(9.2, 48)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  subject.updateWorldMatrix(true, true);
  const pivot = new THREE.Box3().setFromObject(subject).getCenter(new THREE.Vector3());
  subject.position.x -= pivot.x;
  subject.position.z -= pivot.z;
  subject.updateWorldMatrix(true, true);
  const fitted = new THREE.Box3().setFromObject(subject);
  const sphere = fitted.getBoundingSphere(new THREE.Sphere());
  const sphereR = sphere.radius;
  const sphereY = sphere.center.y;
  const lookY = sphereY - sphereR * 0.05;
  const localBox = fitted.clone();
  localBox.min.sub(subject.position);
  localBox.max.sub(subject.position);
  const localCorners = [];
  for (const x of [localBox.min.x, localBox.max.x]) {
    for (const y of [localBox.min.y, localBox.max.y]) {
      for (const z of [localBox.min.z, localBox.max.z]) {
        localCorners.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  const cornerWorld = new THREE.Vector3();

  let fitDist = 24;

  function updateFit() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.6));
    const top = sphereY + sphereR - lookY;
    const bottom = lookY - (sphereY - sphereR);
    const distV = Math.max(top, bottom) / Math.tan(vFov / 2);
    const distH = sphereR / (Math.tan(hFov / 2) * (1 - SHIFT));
    fitDist = Math.max(distV, distH) * 0.84;
  }

  let yaw = START_YAW;
  let disposed = false;
  let visible = true;
  let raf = 0;
  let shown = false;

  function storyProgress() {
    const story = stage.closest(".story");
    const scrollable = story.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    const scrolled = Math.min(Math.max(-story.getBoundingClientRect().top, 0), scrollable);
    return scrolled / scrollable;
  }

  function readCards() {
    const width = stage.clientWidth || window.innerWidth || 1;
    const root = stage.parentElement;
    if (!root) return null;
    const items = root.querySelectorAll(".features li");
    let cover = 0;
    let right = width;
    items.forEach((el) => {
      const opacity = parseFloat(getComputedStyle(el).opacity) || 0;
      if (opacity < 0.04) return;
      cover = Math.max(cover, Math.min(opacity, 1));
      right = Math.min(right, el.getBoundingClientRect().left);
    });
    if (cover < 0.04) return null;
    const name = root.querySelector(".panel--name");
    const nameOpacity = name ? parseFloat(getComputedStyle(name).opacity) || 0 : 0;
    const left = name && nameOpacity > 0.15 ? name.getBoundingClientRect().right : width * 0.08;
    const gapPx = right - left;
    if (gapPx < 64) return null;
    return { cover, center: (left + right) / 2 / width, gap: gapPx / width };
  }

  function spanAt(dist, shiftFrac, az) {
    const y = lookY + dist * 0.04;
    camera.position.set(Math.sin(az) * dist, y, Math.cos(az) * dist);
    const shift = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect * shiftFrac;
    camera.lookAt(-Math.cos(az) * shift, lookY, Math.sin(az) * shift);
    camera.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    localCorners.forEach((corner) => {
      cornerWorld.copy(corner).applyMatrix4(subject.matrixWorld).project(camera);
      if (cornerWorld.x < minX) minX = cornerWorld.x;
      if (cornerWorld.x > maxX) maxX = cornerWorld.x;
    });
    return { minX, maxX };
  }

  function placeCamera(progress, snap) {
    const breathe = 1 + Math.sin(progress * Math.PI) * 0.016;
    const az = 0.48 + Math.sin(progress * Math.PI) * 0.035;
    const cards = readCards();
    let dist = fitDist * breathe;
    let shiftFrac = SHIFT;
    if (cards) {
      const gapNdc = cards.gap * 2 * 0.96;
      const centerNdc = cards.center * 2 - 1;
      let tuckedShift = (cards.center - 0.5) * 2;
      let lo = fitDist * 0.92;
      let hi = fitDist * 2.15;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) * 0.5;
        const span = spanAt(mid, tuckedShift, az);
        if (span.maxX - span.minX > gapNdc) lo = mid;
        else hi = mid;
      }
      let tuckedDist = hi;
      for (let i = 0; i < 3; i += 1) {
        const span = spanAt(tuckedDist, tuckedShift, az);
        const mid = (span.minX + span.maxX) * 0.5;
        tuckedShift += (centerNdc - mid) * 0.9;
      }
      dist = THREE.MathUtils.lerp(fitDist, tuckedDist, cards.cover) * breathe;
      shiftFrac = THREE.MathUtils.lerp(SHIFT, tuckedShift, cards.cover);
    }
    const y = lookY + dist * 0.04;
    desired.set(Math.sin(az) * dist, y, Math.cos(az) * dist);
    if (snap) camera.position.copy(desired);
    else camera.position.lerp(desired, 0.1);
    const shift = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect * shiftFrac;
    look.set(-Math.cos(az) * shift, lookY, Math.sin(az) * shift);
    camera.lookAt(look);
  }

  function resize() {
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    updateFit();
  }

  function frame() {
    raf = 0;
    if (disposed || !visible) return;
    const reduced = reducedMotion.matches;
    const progress = reduced ? 0 : storyProgress();
    const spun = reduced ? 0 : linger(progress);
    const goal = START_YAW + spun * TURN;
    yaw += (goal - yaw) * (reduced ? 1 : 0.075);
    subject.rotation.y = yaw;
    subject.updateMatrixWorld(true);
    placeCamera(progress, reduced);
    renderer.render(scene, camera);
    if (!shown) {
      shown = true;
      stage.classList.add("is-model");
    }
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (disposed || !visible || raf) return;
    raf = requestAnimationFrame(frame);
  }

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) start();
    else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  observer.observe(stage);

  const onScroll = () => {
    if (!reducedMotion.matches) start();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  const resizeObserver = new ResizeObserver(() => {
    resize();
    start();
  });
  resizeObserver.observe(stage);
  reducedMotion.addEventListener("change", start);

  function stop() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    observer.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener("scroll", onScroll);
    reducedMotion.removeEventListener("change", start);
    stage.classList.remove("is-model");
    geos.forEach((geo) => geo.dispose());
    mats.forEach((mat) => mat.dispose());
    textures.forEach((texture) => texture.dispose());
    env.dispose();
    pmrem.dispose();
    renderer.dispose();
    canvas.remove();
  }

  function onDesktopChange() {
    if (!desktop.matches) stop();
  }
  desktop.addEventListener("change", onDesktopChange);

  resize();
  placeCamera(0, true);
  start();
  if (reducedMotion.matches) requestAnimationFrame(frame);

  return {
    stop() {
      desktop.removeEventListener("change", onDesktopChange);
      stop();
    },
  };
}
