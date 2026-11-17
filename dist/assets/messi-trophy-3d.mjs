import * as THREE from './three-0.170.0.mjs';

export function mountTrophy(stage, onFailure) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 30);
  camera.position.set(0, .1, 5.2);
  const trophy = new THREE.Group();
  scene.add(trophy);

  const studio = document.createElement('canvas');
  studio.width = 512;
  studio.height = 256;
  const paint = studio.getContext('2d');
  paint.fillStyle = '#22202a';
  paint.fillRect(0, 0, 512, 256);
  paint.fillStyle = '#a8b5cf';
  paint.fillRect(0, 158, 512, 98);
  for (const [x, y, width, height, color] of [
    [20, 38, 100, 48, '#ffffff'], [208, 50, 44, 110, '#fff4ce'],
    [322, 25, 136, 60, '#ffffff'], [432, 125, 35, 40, '#c8e0ff'],
  ]) {
    paint.fillStyle = color;
    paint.fillRect(x, y, width, height);
  }
  const environment = new THREE.CanvasTexture(studio);
  environment.colorSpace = THREE.SRGBColorSpace;
  environment.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = environment;

  const gold = new THREE.MeshStandardMaterial({color: 0xefaf40, metalness: .91, roughness: .21, envMapIntensity: 1.6});
  const seam = new THREE.MeshStandardMaterial({color: 0x684314, metalness: .84, roughness: .33});
  const stone = new THREE.MeshStandardMaterial({color: 0xb8a485, metalness: .68, roughness: .42, flatShading: true});
  const ball = new THREE.Group();
  ball.position.y = .49;
  trophy.add(ball);
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(.678, 48, 24), seam));

  // Truncate an icosahedron to form the twelve pentagons and twenty hexagons.
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const coordinates = ico.getAttribute('position');
  const vertices = [];
  const triangles = [];
  for (let i = 0; i < coordinates.count; i += 3) {
    const triangle = [];
    for (let j = i; j < i + 3; j++) {
      const point = new THREE.Vector3().fromBufferAttribute(coordinates, j);
      let index = vertices.findIndex(vertex => vertex.distanceToSquared(point) < 1e-7);
      if (index < 0) index = vertices.push(point) - 1;
      triangle.push(index);
    }
    triangles.push(triangle);
  }
  ico.dispose();
  const edge = (a, b) => vertices[a].clone().lerp(vertices[b], 1 / 3);
  const panels = triangles.map(([a, b, c]) => [edge(a,b), edge(b,a), edge(b,c), edge(c,b), edge(c,a), edge(a,c)]);
  vertices.forEach((normal, index) => {
    const neighbors = new Set(triangles.filter(face => face.includes(index)).flat());
    neighbors.delete(index);
    const tangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
    const bitangent = normal.clone().cross(tangent);
    const angle = point => Math.atan2(point.dot(bitangent), point.dot(tangent));
    panels.push([...neighbors].map(neighbor => edge(index, neighbor)).sort((a,b) => angle(a) - angle(b)));
  });
  for (const panel of panels) {
    const center = panel.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(panel.length);
    const points = panel.map(point => point.clone().lerp(center, .028));
    const positions = [];
    const divisions = 8;
    const append = (a,b,c) => {
      const outward = b.clone().sub(a).cross(c.clone().sub(a)).dot(a);
      for (const point of outward > 0 ? [a,b,c] : [a,c,b]) positions.push(...point.clone().normalize().multiplyScalar(.69).toArray());
    };
    points.forEach((point, i) => {
      const next = points[(i + 1) % points.length];
      const sample = (u,v) => center.clone().multiplyScalar(1-u-v).addScaledVector(point,u).addScaledVector(next,v);
      for (let row = 0; row < divisions; row++) {
        for (let column = 0; column < divisions-row; column++) {
          const u = row/divisions, v = column/divisions, step = 1/divisions;
          append(sample(u,v),sample(u+step,v),sample(u,v+step));
          if (row+column < divisions-1) append(sample(u+step,v),sample(u+step,v+step),sample(u,v+step));
        }
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(positions.map(value => value/.69),3));
    ball.add(new THREE.Mesh(geometry,gold));
  }

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.39,.47,.13,48),gold);
  foot.position.y = -.83;
  trophy.add(foot);
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1),stone);
  rock.scale.set(.45,.36,.39);
  rock.position.y = -.49;
  trophy.add(rock);
  const facets = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 29; i++) {
    const angle = i * 2.39996;
    const fragment = new THREE.Mesh(facets,stone);
    const radius = .29 + .12 * Math.sin(i*8.13);
    fragment.position.set(Math.cos(angle)*radius,-.50 + .16*Math.sin(i*6.73),Math.sin(angle)*radius);
    fragment.scale.set(.10,.07 + .06*Math.sin(i*4)**2,.09);
    fragment.rotation.set(i,i*.73,0);
    trophy.add(fragment);
  }
  scene.add(new THREE.HemisphereLight(0xe7f3ff,0x72614b,1.35));
  const light = new THREE.DirectionalLight(0xffe7ad,2.7);
  light.position.set(-2,3,4);
  scene.add(light);

  stage.append(renderer.domElement);
  const resize = () => {
    const {width,height} = stage.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let rotation = -.38;
  renderer.setAnimationLoop(time => {
    if (!stage.isConnected) {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      const geometries = new Set();
      trophy.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
      geometries.forEach(geometry => geometry.dispose());
      [gold,seam,stone,environment].forEach(resource => resource.dispose());
      renderer.dispose();
      return;
    }
    const portrait = stage.closest('.messi-portrait-switch');
    const revealed = portrait.dataset.reveal === 'true';
    if (!revealed && portrait.dataset.hover !== 'true') {
      rotation = -.38;
      return;
    }
    const angle = revealed ? .15 + .16 * Math.sin(time * .0014) : Number(stage.dataset.angle || 0);
    rotation = reduced.matches ? .12 : THREE.MathUtils.lerp(rotation, angle, .085);
    trophy.rotation.y = rotation;
    trophy.rotation.z = -.04;
    light.position.x = 3*Math.sin(time*.0014);
    renderer.render(scene,camera);
  });
  renderer.domElement.addEventListener('webglcontextlost', () => {
    renderer.setAnimationLoop(null);
    onFailure();
  });
}
