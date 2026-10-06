import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const W = 7.5;
const D = 6.15;
const H = 6.2;
const EAVE = 0.28;
const START_YAW = 0.58;
const TURN = (300 * Math.PI) / 180;

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function shade(hex, amount) {
  const color = new THREE.Color(hex);
  color.offsetHSL(0, 0, amount);
  return `#${color.getHexString()}`;
}

function makeCanvasTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  draw(canvas.getContext("2d"), canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function plankTexture(base, gap) {
  return makeCanvasTexture((ctx) => {
    const plank = 46;
    for (let y = 0; y < 512; y += plank) {
      ctx.fillStyle = shade(base, (Math.random() - 0.5) * 0.06);
      ctx.fillRect(0, y, 512, plank - 2);
      ctx.fillStyle = gap;
      ctx.fillRect(0, y + plank - 2, 512, 2);
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#2a160c";
      for (let i = 0; i < 7; i += 1) {
        const yy = y + 6 + Math.random() * (plank - 12);
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(140, yy + 1, 320, yy - 1, 512, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });
}

function shingleTexture() {
  return makeCanvasTexture((ctx) => {
    ctx.fillStyle = "#241e1a";
    ctx.fillRect(0, 0, 512, 512);
    const row = 28;
    const col = 52;
    for (let y = 0; y < 512; y += row) {
      const offset = (y / row) % 2 ? col / 2 : 0;
      for (let x = -col; x < 512; x += col) {
        ctx.fillStyle = shade("#2c261f", (Math.random() - 0.55) * 0.08);
        ctx.fillRect(x + offset + 1, y + 1, col - 3, row - 3);
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.strokeRect(x + offset + 1.5, y + 1.5, col - 4, row - 4);
      }
    }
  });
}

function groundTexture() {
  return makeCanvasTexture((ctx) => {
    const glow = ctx.createRadialGradient(256, 256, 30, 256, 256, 250);
    glow.addColorStop(0, "rgba(46, 52, 36, 1)");
    glow.addColorStop(0.42, "rgba(28, 34, 24, 0.92)");
    glow.addColorStop(0.72, "rgba(22, 24, 20, 0.55)");
    glow.addColorStop(1, "rgba(20, 18, 16, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1400; i += 1) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const dx = x - 256;
      const dy = y - 256;
      if (dx * dx + dy * dy > 230 * 230) continue;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(70, 78, 48, 0.35)" : "rgba(16, 18, 12, 0.28)";
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  });
}

function halfAt(y, inset = 0.62) {
  const span = H - EAVE;
  const t = THREE.MathUtils.clamp((y - EAVE) / span, 0, 1);
  return Math.max(0.08, (W / 2 - inset) * (1 - t));
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

  const woodMap = plankTexture("#c4844a", "#6d4124");
  const trimMap = plankTexture("#d7a15c", "#8a5a2c");
  const deckMap = plankTexture("#9a6238", "#5c381f");
  const roofMap = shingleTexture();
  const groundMap = groundTexture();
  textures.push(woodMap, trimMap, deckMap, roofMap, groundMap);
  woodMap.repeat.set(2.4, 3.2);
  trimMap.repeat.set(1.2, 1.4);
  deckMap.repeat.set(3.2, 1.6);
  roofMap.repeat.set(2.2, 3.4);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  textures.forEach((texture) => {
    texture.anisotropy = maxAniso;
  });

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#141210", 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3(0, 2.45, 0.2);

  const hemi = new THREE.HemisphereLight(0xffe8cf, 0x2a241c, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e2, 3.15);
  sun.position.set(8.5, 12.5, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 36;
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc4a27a, 0.42);
  fill.position.set(-7, 5, -4);
  scene.add(fill);

  function trackGeo(geo) {
    geos.push(geo);
    return geo;
  }

  function trackMat(mat) {
    mats.push(mat);
    return mat;
  }

  const wood = trackMat(new THREE.MeshStandardMaterial({
    map: woodMap,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.02,
    envMapIntensity: 0.28,
  }));
  const trim = trackMat(new THREE.MeshStandardMaterial({
    map: trimMap,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.04,
    envMapIntensity: 0.32,
  }));
  const deckMat = trackMat(new THREE.MeshStandardMaterial({
    map: deckMap,
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.02,
    envMapIntensity: 0.2,
  }));
  const roof = trackMat(new THREE.MeshStandardMaterial({
    map: roofMap,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.04,
    envMapIntensity: 0.18,
  }));
  const dark = trackMat(new THREE.MeshStandardMaterial({
    color: 0x3a2a22,
    roughness: 0.8,
    metalness: 0.05,
  }));
  const metal = trackMat(new THREE.MeshStandardMaterial({
    color: 0x2c2824,
    roughness: 0.35,
    metalness: 0.72,
  }));
  const glass = trackMat(new THREE.MeshPhysicalMaterial({
    color: 0xe7f0ea,
    roughness: 0.12,
    metalness: 0,
    transmission: 0.55,
    thickness: 0.12,
    ior: 1.45,
    transparent: true,
    envMapIntensity: 1.35,
  }));
  const interiorMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x6a3a22,
    emissive: 0xff8a3a,
    emissiveIntensity: 0.85,
    roughness: 0.9,
  }));
  const groundMat = trackMat(new THREE.MeshStandardMaterial({
    map: groundMap,
    transparent: true,
    roughness: 1,
    metalness: 0,
  }));
  const gravelMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x4a433a,
    roughness: 0.96,
    metalness: 0,
  }));

  function add(geo, mat, x, y, z, parent) {
    const mesh = new THREE.Mesh(trackGeo(geo), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const house = new THREE.Group();
  scene.add(house);

  const run = W / 2 + 0.42;
  const rise = H - 0.05;
  const slope = Math.hypot(run, rise);
  const angle = Math.atan2(rise, run);
  const roofGeo = trackGeo(new THREE.BoxGeometry(slope, 0.16, D + 0.9));
  const rightRoof = new THREE.Mesh(roofGeo, roof);
  rightRoof.rotation.z = -angle;
  rightRoof.position.set(run / 2 - 0.02, rise / 2 + 0.12, 0);
  const leftRoof = new THREE.Mesh(roofGeo, roof);
  leftRoof.rotation.z = angle;
  leftRoof.position.set(-run / 2 + 0.02, rise / 2 + 0.12, 0);
  [rightRoof, leftRoof].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    house.add(mesh);
  });
  add(new THREE.BoxGeometry(0.28, 0.2, D + 1.05), dark, 0, H + 0.02, 0, house);

  const gable = new THREE.Shape();
  gable.moveTo(-W / 2, EAVE);
  gable.lineTo(0, H - 0.08);
  gable.lineTo(W / 2, EAVE);
  gable.closePath();
  const opening = new THREE.Path();
  opening.moveTo(-W / 2 + 0.58, EAVE + 0.22);
  opening.lineTo(0, H - 0.72);
  opening.lineTo(W / 2 - 0.58, EAVE + 0.22);
  opening.closePath();
  gable.holes.push(opening);
  const frameGeo = trackGeo(new THREE.ExtrudeGeometry(gable, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 1,
  }));
  const frontFrame = new THREE.Mesh(frameGeo, trim);
  frontFrame.position.z = D / 2 - 0.08;
  frontFrame.castShadow = true;
  frontFrame.receiveShadow = true;
  house.add(frontFrame);
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-W / 2 + 0.64, EAVE + 0.28);
  glassShape.lineTo(0, H - 0.8);
  glassShape.lineTo(W / 2 - 0.64, EAVE + 0.28);
  glassShape.closePath();
  const glassGeo = trackGeo(new THREE.ShapeGeometry(glassShape));
  const frontGlass = new THREE.Mesh(glassGeo, glass);
  frontGlass.position.z = D / 2 + 0.02;
  house.add(frontGlass);

  [1.15, 2.05, 2.95, 3.8, 4.6].forEach((y) => {
    const span = halfAt(y, 0.82) * 2;
    if (span < 0.35) return;
    add(new THREE.BoxGeometry(span, 0.045, 0.05), dark, 0, y, D / 2 + 0.07, house);
  });
  [-1.7, -0.85, 0, 0.85, 1.7].forEach((x) => {
    const top = H - 1.05 - Math.abs(x) * 0.62;
    const height = top - (EAVE + 0.32);
    if (height < 0.4) return;
    add(new THREE.BoxGeometry(0.045, height, 0.05), dark, x, EAVE + 0.32 + height / 2, D / 2 + 0.07, house);
  });

  add(new THREE.BoxGeometry(0.92, 2.35, 0.1), dark, 2.15, EAVE + 1.22, D / 2 + 0.11, house);
  add(new THREE.BoxGeometry(0.58, 1.15, 0.02), glass, 2.15, EAVE + 1.55, D / 2 + 0.17, house);
  add(new THREE.BoxGeometry(0.035, 0.22, 0.04), metal, 1.78, EAVE + 1.12, D / 2 + 0.18, house);

  const backWood = new THREE.Shape();
  backWood.moveTo(-W / 2 + 0.5, EAVE + 0.2);
  backWood.lineTo(0, H - 0.85);
  backWood.lineTo(W / 2 - 0.5, EAVE + 0.2);
  backWood.closePath();
  const backHole = new THREE.Path();
  backHole.moveTo(-0.7, 1.7);
  backHole.lineTo(-0.7, 2.9);
  backHole.lineTo(0.7, 2.9);
  backHole.lineTo(0.7, 1.7);
  backHole.closePath();
  backWood.holes.push(backHole);
  const backClad = new THREE.Mesh(trackGeo(new THREE.ShapeGeometry(backWood)), wood);
  backClad.position.z = -D / 2 - 0.02;
  backClad.rotation.y = Math.PI;
  house.add(backClad);
  const backWin = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.28, 1.12)), glass);
  backWin.position.set(0, 2.3, -D / 2 - 0.04);
  backWin.rotation.y = Math.PI;
  house.add(backWin);

  const deckZ = D / 2 + 1.15;
  add(new THREE.BoxGeometry(W + 1.15, 0.16, 2.55), deckMat, 0, 0.34, deckZ, house);
  add(new THREE.BoxGeometry(W + 0.95, 0.28, 2.35), dark, 0, 0.14, deckZ, house);
  for (let i = 0; i < 4; i += 1) {
    add(
      new THREE.BoxGeometry(1.7, 0.09, 0.36),
      deckMat,
      1.15,
      0.3 - i * 0.08,
      D / 2 + 2.35 + i * 0.36,
      house,
    );
  }

  function rail(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    [0.72, 1.08].forEach((y) => {
      const railMesh = add(new THREE.BoxGeometry(length, 0.05, 0.05), trim, midX, y, midZ, house);
      railMesh.rotation.y = Math.atan2(dz, dx);
    });
    const steps = Math.max(2, Math.round(length / 0.85));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      add(new THREE.BoxGeometry(0.07, 1.05, 0.07), dark, x1 + dx * t, 0.72, z1 + dz * t, house);
    }
  }

  const deckFront = D / 2 + 2.35;
  const deckBack = D / 2 - 0.05;
  const deckLeft = -W / 2 - 0.45;
  const deckRight = W / 2 + 0.45;
  rail(deckLeft, deckBack, deckLeft, deckFront);
  rail(deckRight, deckBack, deckRight, deckFront);
  rail(deckLeft, deckFront, 0.35, deckFront);
  rail(2.05, deckFront, deckRight, deckFront);

  add(new THREE.BoxGeometry(W - 1.8, 0.1, D - 1.5), deckMat, 0, 0.48, -0.1, house);
  add(new THREE.BoxGeometry(W - 2.4, 0.08, D - 2.1), wood, 0, 3.05, -0.25, house);
  add(new THREE.BoxGeometry(W - 2.1, 3.1, 0.12), wood, 0, 2.05, -1.7, house);
  add(new THREE.BoxGeometry(1.4, 0.06, 0.5), interiorMat, -0.4, 3.35, 0.15, house);
  [-1.55, 1.45].forEach((x) => {
    add(new THREE.BoxGeometry(0.1, 2.7, 0.1), dark, x, 1.85, 0.15, house);
  });
  const glow = new THREE.PointLight(0xff9344, 5.5, 9, 2);
  glow.position.set(-0.2, 2.6, 0.2);
  house.add(glow);
  const glow2 = new THREE.PointLight(0xffc27a, 3.2, 6, 2);
  glow2.position.set(1.4, 1.8, D / 2 - 0.4);
  house.add(glow2);

  const ground = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(16, 48)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.001;
  ground.receiveShadow = true;
  scene.add(ground);
  const pad = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(5.6, 40)), gravelMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  pad.receiveShadow = true;
  scene.add(pad);

  house.position.y = 0;

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

  function resize() {
    const width = stage.clientWidth || window.innerWidth;
    const height = stage.clientHeight || window.innerHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
  }

  function frame() {
    raf = 0;
    if (disposed || !visible) return;
    const reduced = reducedMotion.matches;
    const progress = reduced ? 0 : storyProgress();
    const goal = START_YAW + (reduced ? 0 : progress * TURN);
    yaw += (goal - yaw) * (reduced ? 1 : 0.075);
    house.rotation.y = yaw;

    const dist = 12.4 - Math.sin(progress * Math.PI) * 0.85;
    const camY = 3.05 + Math.sin(progress * Math.PI) * 0.42;
    desired.set(dist * 0.04, camY, dist);
    camera.position.lerp(desired, reduced ? 1 : 0.08);
    camera.lookAt(look);
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
    else if (raf) cancelAnimationFrame(raf);
    raf = visible ? raf : 0;
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
  camera.position.copy(desired.set(12.4 * 0.04, 3.05, 12.4));
  camera.lookAt(look);
  start();
  if (reducedMotion.matches) requestAnimationFrame(frame);

  return {
    stop() {
      desktop.removeEventListener("change", onDesktopChange);
      stop();
    },
  };
}
