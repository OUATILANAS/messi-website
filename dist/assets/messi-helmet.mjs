import * as THREE from './three-0.170.0.mjs';
import { GLTFLoader } from './helmet/GLTFLoader.mjs';
import { DRACOLoader } from './helmet/DRACOLoader.mjs';

export async function mountHelmet(stage, onFailure) {
  const directory = new URL('./helmet/', import.meta.url);
  const draco = new DRACOLoader().setDecoderPath(new URL('draco/', directory).href);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const textures = new THREE.TextureLoader();
  const load = name => textures.loadAsync(new URL(name, directory).href);
  const [{ scene: model }, shell, visor, normal] = await Promise.all([
    loader.loadAsync(new URL('helmet.glb', directory).href),
    load('shell.webp'), load('visor.webp'), load('normal.webp'),
  ]).finally(() => draco.dispose());
  if (!stage.isConnected) return;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 30);
  const pivot = new THREE.Group();
  const wireframe = new THREE.Group();
  const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.position.sub(center);
  wireframe.position.copy(model.position);
  pivot.add(model, wireframe);
  scene.add(pivot);

  for (const texture of [shell, visor, normal]) texture.flipY = false;
  shell.colorSpace = visor.colorSpace = THREE.SRGBColorSpace;
  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x667a8b, transparent: true, opacity: .115, depthWrite: false });
  const reveal = { value: 0 };
  const cursor = { value: new THREE.Vector2(.5, .5) };
  const viewport = { value: new THREE.Vector2() };
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const glass = mesh.name === 'glass';
    const plastic = mesh.name === 'plastic';
    mesh.material = new THREE.MeshStandardMaterial({
      color: glass ? 0x222733 : plastic ? 0x191a1d : 0xffffff,
      map: glass ? visor : plastic ? null : shell,
      normalMap: glass || plastic ? null : normal,
      roughness: glass ? .22 : .42,
      metalness: .18,
    });
    mesh.material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { reveal, cursor, viewport });
      shader.fragmentShader = 'uniform float reveal; uniform vec2 cursor; uniform vec2 viewport;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        vec2 point = gl_FragCoord.xy / viewport;
        float edge = length((point - cursor) * vec2(1.0, .85));
        if (edge > reveal) discard;
      `);
    };
    if (!plastic) wireframe.add(new THREE.LineSegments(new THREE.WireframeGeometry(mesh.geometry), wireMaterial));
  });

  const lighting = new THREE.HemisphereLight(0xf6f8ff, 0x524d42, 2.5);
  const key = new THREE.DirectionalLight(0xfff1d6, 3.2);
  key.position.set(2, 4, 5);
  scene.add(lighting, key);

  const resize = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(viewport.value);
    camera.aspect = width / height;
    camera.position.z = Math.max(size.x / camera.aspect, size.y) * 1.91;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  const portrait = stage.closest('.messi-portrait-switch');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const target = new THREE.Vector2();
  renderer.setAnimationLoop(() => {
    if (!stage.isConnected) {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      pivot.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      for (const texture of [shell, visor, normal]) texture.dispose();
      renderer.dispose();
      return;
    }
    const full = portrait.dataset.reveal === 'true';
    const hover = portrait.dataset.hover === 'true';
    const easing = reduced.matches ? 1 : .09;
    target.set(Number(stage.dataset.x ?? .5), 1 - Number(stage.dataset.y ?? .5));
    cursor.value.lerp(target, easing);
    reveal.value = THREE.MathUtils.lerp(reveal.value, full ? 1.7 : hover ? .33 : 0, easing);
    pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, reduced.matches ? 0 : Number(stage.dataset.angle || 0), easing);
    wireMaterial.opacity = THREE.MathUtils.lerp(wireMaterial.opacity, full ? 0 : .12, easing);
    renderer.render(scene, camera);
  });
  renderer.domElement.addEventListener('webglcontextlost', () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    onFailure();
  });
}
