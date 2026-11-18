import * as THREE from 'three';
import { getDiscreteElevationRgb } from './viewerLogic';

export const DEFAULT_MODEL_FILE_NAME = 'haryana_elevation_dem.glb';

const HARYANA_BOUNDARY_POLYGON: readonly (readonly [number, number])[] = [
  [0.32, -0.92],  // North-East tip: Panchkula / Morni Hills
  [0.68, -0.70],  // Yamunanagar (NE)
  [0.58, -0.25],  // Karnal / Panipat (East Yamuna border)
  [0.52, 0.22],   // Sonipat / Delhi border
  [0.62, 0.56],   // Faridabad / Palwal (SE)
  [0.42, 0.88],   // Nuh / Mewat (South-East tip)
  [0.12, 0.64],   // Rewari
  [-0.22, 0.84],  // Mahendragarh / Narnaul (South-West tip)
  [-0.58, 0.45],  // Bhiwani / Loharu (SW)
  [-0.62, -0.02], // Hisar / Fatehabad
  [-0.92, -0.28], // Sirsa West tip
  [-0.75, -0.52], // Sirsa / Mandi Dabwali North-West
  [-0.22, -0.45], // Kaithal / Jind border
  [0.08, -0.76],  // Ambala / Kurukshetra
];

/**
 * Evaluates whether normalized map coordinate (nx, nz) in [-1, 1] lies inside
 * the approximate Haryana state boundary polygon, returning a smoothed edge factor [0, 1].
 */
function getHaryanaBoundaryMask(nx: number, nz: number): number {
  let inside = false;
  let minEdgeDist = 10.0;
  const len = HARYANA_BOUNDARY_POLYGON.length;

  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = HARYANA_BOUNDARY_POLYGON[i][0];
    const zi = HARYANA_BOUNDARY_POLYGON[i][1];
    const xj = HARYANA_BOUNDARY_POLYGON[j][0];
    const zj = HARYANA_BOUNDARY_POLYGON[j][1];

    const intersect =
      zi > nz !== zj > nz &&
      nx < ((xj - xi) * (nz - zi)) / (zj - zi + 1e-7) + xi;
    if (intersect) inside = !inside;

    const dx = xj - xi;
    const dz = zj - zi;
    const lenSq = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((nx - xi) * dx + (nz - zi) * dz) / (lenSq || 1)));
    const projX = xi + t * dx;
    const projZ = zi + t * dz;
    const dist = Math.hypot(nx - projX, nz - projZ);
    if (dist < minEdgeDist) minEdgeDist = dist;
  }

  if (!inside) return 0;
  return Math.min(1, minEdgeDist / 0.085);
}

/**
 * Computes synthetic Haryana elevation normalized in [0, 1] for map coordinates (nx, nz) in [-1, 1].
 */
function computeHaryanaElevationNormalized(nx: number, nz: number): number {
  const mask = getHaryanaBoundaryMask(nx, nz);
  if (mask <= 0) return -1;

  // 1. North-East Shivalik Hills & Morni Hills
  const dShivalik1 = Math.hypot(nx - 0.36, nz + 0.78);
  const dShivalik2 = Math.hypot(nx - 0.54, nz + 0.62);
  const dAmbala = Math.hypot(nx - 0.16, nz + 0.64);
  const shivalikPeak =
    Math.exp(-dShivalik1 * dShivalik1 * 9.5) * 0.68 +
    Math.exp(-dShivalik2 * dShivalik2 * 8.0) * 0.46 +
    Math.exp(-dAmbala * dAmbala * 7.5) * 0.28;

  // 2. South & South-West Aravalli Range Outcrops
  const dAravalliSE = Math.hypot(nx - 0.42, nz - 0.58);
  const dAravalliSW = Math.hypot(nx + 0.18, nz - 0.68);
  const dTosham = Math.hypot(nx + 0.42, nz - 0.28);
  const aravalliRidge =
    Math.exp(-dAravalliSE * dAravalliSE * 9.0) * 0.46 +
    Math.exp(-dAravalliSW * dAravalliSW * 8.5) * 0.52 +
    Math.exp(-dTosham * dTosham * 10.0) * 0.36;

  // 3. West / South-West Bagar Sand-Dune Upland Slope
  const bagarSlope = Math.max(0, (-nx * 0.45 + nz * 0.35 + 0.15) * 0.26);

  // 4. Central Ghaggar-Yamuna Alluvial Terraces
  const yamunaDip = Math.max(0, (nx - 0.22) * 0.16);
  const basePlain =
    0.18 +
    0.05 * Math.sin(nx * 4.5 + nz * 3.8) +
    0.035 * Math.cos(nx * 7.0 - nz * 6.0);

  const rawNorm = Math.min(
    0.99,
    Math.max(0.06, basePlain + bagarSlope - yamunaDip + shivalikPeak + aravalliRidge)
  );

  return rawNorm * (0.35 + 0.65 * mask);
}

/**
 * Builds the default Haryana 3D Elevation Map (DEM) in glTF local space (+Y up, grounded at y = 0).
 */
export function buildDefaultModelGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'haryana_elevation_dem';

  // 1. Survey Datum Base Plinth (y: 0.00 -> 0.14)
  const plinthGeo = new THREE.BoxGeometry(2.65, 0.14, 2.65);
  plinthGeo.translate(0, 0.07, 0);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.9,
    metalness: 0.05,
  });
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.name = 'Survey_Base_Plinth';
  root.add(plinth);

  // 2. State Datum Frame Border (y: 0.14 -> 0.22)
  const frameGeo = new THREE.BoxGeometry(2.48, 0.08, 2.48);
  frameGeo.translate(0, 0.18, 0);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.88,
    metalness: 0.08,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.name = 'State_Datum_Platform';
  root.add(frame);

  // 3. Primary Hero Relief: Haryana 3D Topographic DEM Mesh
  const segs = 80;
  const demGeo = new THREE.PlaneGeometry(2.36, 2.36, segs, segs);
  demGeo.rotateX(-Math.PI / 2);
  const pos = demGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const minTerrainY = 0.25;
  const maxReliefHeight = 0.78;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = x / 1.18;
    const nz = z / 1.18;
    const cIdx = i * 3;

    const normElev = computeHaryanaElevationNormalized(nx, nz);
    if (normElev < 0) {
      pos.setY(i, 0.16);
      colors[cIdx] = 0.2;
      colors[cIdx + 1] = 0.25;
      colors[cIdx + 2] = 0.33;
    } else {
      const y = minTerrainY + normElev * maxReliefHeight;
      pos.setY(i, y);
      const rgb = getDiscreteElevationRgb(normElev);
      colors[cIdx] = rgb[0];
      colors[cIdx + 1] = rgb[1];
      colors[cIdx + 2] = rgb[2];
    }
  }

  demGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  demGeo.computeVertexNormals();

  const demMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const demMesh = new THREE.Mesh(demGeo, demMat);
  demMesh.name = 'Haryana_DEM_Relief_Surface';
  demMesh.userData.isElevationSurface = true;
  demMesh.userData.minY = minTerrainY;
  demMesh.userData.maxY = minTerrainY + maxReliefHeight;
  root.add(demMesh);

  return root;
}

/**
 * Prepares any loaded 3D model (.glb / .gltf or procedural) for crisp, non-washing 3D visualization:
 * - Preserves 100% of the model's original texture map and vertex colors across the entire mesh.
 * - Configures a matte surface finish (high roughness, zero metalness, zero environment reflection)
 *   so colors never mix or wash out under lighting.
 * - Enables DoubleSide rendering so all terrain surfaces remain visible from every angle.
 */
export function prepareModelForCrispViewing(
  rawObject: THREE.Object3D,
  maxAnisotropy = 4
): { minY: number; maxY: number } {
  rawObject.updateMatrixWorld(true);
  const fullBox = new THREE.Box3().setFromObject(rawObject);

  let minY = fullBox.min.y;
  let maxY = fullBox.max.y;

  rawObject.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;

    if (
      mesh.userData?.isElevationSurface &&
      typeof mesh.userData.minY === 'number' &&
      typeof mesh.userData.maxY === 'number'
    ) {
      minY = mesh.userData.minY;
      maxY = mesh.userData.maxY;
    }

    if (mesh.geometry && !mesh.geometry.attributes.normal) {
      mesh.geometry.computeVertexNormals();
    }

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    materials.forEach((mat) => {
      if (!mat) return;
      mat.side = THREE.DoubleSide;

      const stdMat = mat as THREE.MeshStandardMaterial;
      if ('roughness' in stdMat) {
        stdMat.roughness = 0.92;
      }
      if ('metalness' in stdMat) {
        stdMat.metalness = 0.0;
      }
      if ('envMapIntensity' in stdMat) {
        stdMat.envMapIntensity = 0.0;
      }
      if (stdMat.map) {
        stdMat.map.colorSpace = THREE.SRGBColorSpace;
        stdMat.map.anisotropy = maxAnisotropy;
        stdMat.map.needsUpdate = true;
      }
      stdMat.needsUpdate = true;
    });
  });

  if (maxY - minY < 0.001) {
    maxY = minY + 1.0;
  }

  return { minY, maxY };
}
