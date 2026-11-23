import * as THREE from 'three';
import {
  ElevationColorConfig,
  MAX_ELEVATION_METERS,
  MIN_ELEVATION_METERS,
  computeElevationMetersFromBaseZ,
  evaluateCustomElevationColorRgb,
  getDiscreteElevationRgb,
} from './viewerLogic';

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
  const segs = 110;
  const demGeo = new THREE.PlaneGeometry(2.36, 2.36, segs, segs);
  demGeo.rotateX(-Math.PI / 2);
  const pos = demGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const skirtMask = new Uint8Array(pos.count);

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
      skirtMask[i] = 1;
    } else {
      const y = minTerrainY + normElev * maxReliefHeight;
      pos.setY(i, y);
      const rgb = getDiscreteElevationRgb(normElev);
      colors[cIdx] = rgb[0];
      colors[cIdx + 1] = rgb[1];
      colors[cIdx + 2] = rgb[2];
      skirtMask[i] = 0;
    }
  }

  demGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  demGeo.userData.skirtMask = skirtMask;
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
  root.userData.elevationRange = {
    min: MIN_ELEVATION_METERS,
    max: MAX_ELEVATION_METERS,
  };
  root.add(demMesh);

  return root;
}

function readElevationRangeFromRecord(
  record: unknown
): { min: number; max: number } | null {
  if (!record || typeof record !== 'object') return null;
  const obj = record as Record<string, unknown>;

  const rangeVal = obj.elevationRange ?? obj.elevation_range;
  if (Array.isArray(rangeVal) && rangeVal.length >= 2) {
    const min = Number(rangeVal[0]);
    const max = Number(rangeVal[1]);
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return { min, max };
    }
  } else if (rangeVal && typeof rangeVal === 'object') {
    const r = rangeVal as Record<string, unknown>;
    const min = Number(r.min);
    const max = Number(r.max);
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return { min, max };
    }
  }

  const minCandidate =
    obj.minElevation ??
    obj.min_elevation ??
    obj.elevationMin ??
    obj.elevation_min ??
    obj.demMin ??
    obj.dem_min;
  const maxCandidate =
    obj.maxElevation ??
    obj.max_elevation ??
    obj.elevationMax ??
    obj.elevation_max ??
    obj.demMax ??
    obj.dem_max;

  if (minCandidate !== undefined && maxCandidate !== undefined) {
    const min = Number(minCandidate);
    const max = Number(maxCandidate);
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      return { min, max };
    }
  }

  return null;
}

/**
 * Inspects glTF extras, root userData, and child mesh userData for explicit elevation bounds.
 */
export function extractElevationMetadataFromModel(
  rawObject: THREE.Object3D,
  extraSources: unknown[] = []
): { min: number; max: number } | null {
  for (const src of extraSources) {
    const found = readElevationRangeFromRecord(src);
    if (found) return found;
  }

  const fromRoot = readElevationRangeFromRecord(rawObject.userData);
  if (fromRoot) return fromRoot;

  let fromChild: { min: number; max: number } | null = null;
  rawObject.traverse((child) => {
    if (fromChild) return;
    const found = readElevationRangeFromRecord(child.userData);
    if (found) fromChild = found;
  });

  return fromChild;
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
  let hasExplicitElevationSurface = false;

  rawObject.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (mesh.userData?.isElevationSurface) {
      hasExplicitElevationSurface = true;
    }
  });

  const replacedOriginals = new Set<THREE.Material>();

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

    mesh.userData.isTargetTerrainMesh = hasExplicitElevationSurface
      ? Boolean(mesh.userData?.isElevationSurface)
      : true;

    if (mesh.geometry && !mesh.geometry.attributes.normal) {
      mesh.geometry.computeVertexNormals();
    }

    // Clone materials so custom elevation color overrides never mutate unrelated shared materials
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => {
        if (!m) return m;
        replacedOriginals.add(m);
        return m.clone();
      });
    } else if (mesh.material) {
      replacedOriginals.add(mesh.material);
      mesh.material = mesh.material.clone();
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

      // Snapshot original material state for lossless restoration when Custom Color is turned Off
      mat.userData.originalMap = stdMat.map ?? null;
      mat.userData.originalVertexColors = Boolean(stdMat.vertexColors);
      mat.userData.originalColorHex = stdMat.color
        ? stdMat.color.getHex()
        : 0xffffff;

      stdMat.needsUpdate = true;
    });

    if (mesh.geometry) {
      const geo = mesh.geometry;
      if (!geo.userData.originalSnapshotSaved) {
        geo.userData.originalUvAttr = geo.attributes.uv
          ? geo.attributes.uv.clone()
          : null;
        geo.userData.originalColorAttr = geo.attributes.color
          ? geo.attributes.color.clone()
          : null;
        geo.userData.originalSnapshotSaved = true;
      }
    }
  });

  // Dispose replaced original material instances (textures remain referenced by clones)
  replacedOriginals.forEach((origMat) => origMat.dispose());

  if (maxY - minY < 1e-7) {
    maxY = minY + 1e-4;
  }

  return { minY, maxY };
}

/**
 * Precomputes and caches unscaled elevation values (in meters ASL) for every vertex of
 * every terrain mesh in rawObject so real-time slider updates execute instantaneously.
 */
export function cacheModelVertexElevations(params: {
  rawObject: THREE.Object3D;
  rawBoxMinY: number;
  normFactor: number;
  minReliefZ: number;
  maxReliefZ: number;
  minElevationMeters: number;
  maxElevationMeters: number;
}): void {
  const {
    rawObject,
    rawBoxMinY,
    normFactor,
    minReliefZ,
    maxReliefZ,
    minElevationMeters,
    maxElevationMeters,
  } = params;
  rawObject.updateMatrixWorld(true);
  const invRootMatrix = new THREE.Matrix4().copy(rawObject.matrixWorld).invert();
  const localToRootMatrix = new THREE.Matrix4();
  const tempVec = new THREE.Vector3();

  rawObject.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.userData?.isTargetTerrainMesh || !mesh.geometry) return;

    const pos = mesh.geometry.attributes.position;
    if (!pos) return;

    localToRootMatrix.multiplyMatrices(invRootMatrix, mesh.matrixWorld);
    const vertexElevations = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      tempVec.fromBufferAttribute(pos, i).applyMatrix4(localToRootMatrix);
      const baseZ = Math.max(0, (tempVec.y - rawBoxMinY) * normFactor);
      vertexElevations[i] = computeElevationMetersFromBaseZ(
        baseZ,
        minReliefZ,
        maxReliefZ,
        minElevationMeters,
        maxElevationMeters
      );
    }

    mesh.geometry.userData.vertexElevations = vertexElevations;
  });
}

function getElevationRampSignature(colorConfig: ElevationColorConfig): string {
  const stopsKey = colorConfig.stops
    .map((s) => `${s.elevation}:${s.hex}`)
    .join('|');
  return `${colorConfig.distributionMode}|${colorConfig.interpolation}|${stopsKey}`;
}

/**
 * Populates a 1024x1 1D RGBA DataTexture buffer from the active ElevationColorConfig.
 * The ramp pixels depend only on stops, distributionMode, and interpolation (not min/max range),
 * so the texture can be reused across min/max slider drags with zero GPU texture churn.
 */
function populateElevationRampData(
  data: Uint8Array,
  width: number,
  colorConfig: ElevationColorConfig
): void {
  const normalizedConfig = {
    minElevation: 0,
    maxElevation: 1,
    interpolation: colorConfig.interpolation,
    distributionMode: colorConfig.distributionMode,
    stops: colorConfig.stops,
  };

  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const [r, g, b] = evaluateCustomElevationColorRgb(t, normalizedConfig);
    const idx = x * 4;
    data[idx] = Math.max(0, Math.min(255, Math.round(r * 255)));
    data[idx + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
    data[idx + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
    data[idx + 3] = 255;
  }
}

function createOrUpdateElevationRampTexture(
  existing: THREE.DataTexture | null,
  colorConfig: ElevationColorConfig
): THREE.DataTexture {
  const width = 1024;
  const filter =
    colorConfig.interpolation === 'INTERPOLATED'
      ? THREE.LinearFilter
      : THREE.NearestFilter;

  if (
    existing &&
    existing.image &&
    existing.image.width === width &&
    existing.image.data instanceof Uint8Array
  ) {
    populateElevationRampData(existing.image.data, width, colorConfig);
    existing.minFilter = filter;
    existing.magFilter = filter;
    existing.needsUpdate = true;
    return existing;
  }

  const data = new Uint8Array(width * 4);
  populateElevationRampData(data, width, colorConfig);

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = filter;
  texture.magFilter = filter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Applies or restores custom elevation color mapping across all target terrain meshes in the model.
 * - When colorConfig.enabled === false: restores original textures, UVs, and vertex colors.
 * - When colorConfig.enabled === true: maps each vertex's elevation in meters into [minElevation, maxElevation]
 *   and binds the 1024-step QGIS color ramp texture.
 */
export function applyElevationColorConfigToModel(
  rootObject: THREE.Object3D,
  colorConfig: ElevationColorConfig
): void {
  const rampSignature = colorConfig.enabled
    ? getElevationRampSignature(colorConfig)
    : '';
  const invSpan =
    1 / Math.max(0.001, colorConfig.maxElevation - colorConfig.minElevation);
  const minElev = colorConfig.minElevation;

  let sharedRampTexture: THREE.DataTexture | null = null;
  let sharedRampUpdated = false;
  const disposedTextures = new Set<THREE.Texture>();

  rootObject.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.userData?.isTargetTerrainMesh || !mesh.geometry) return;

    const geo = mesh.geometry;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    if (!colorConfig.enabled) {
      if (!mesh.userData.customColorApplied) return;

      // Restore original geometry attributes
      if (geo.userData.originalUvAttr) {
        geo.setAttribute('uv', geo.userData.originalUvAttr.clone());
      } else if (geo.getAttribute('uv')) {
        geo.deleteAttribute('uv');
      }
      if (geo.userData.originalColorAttr) {
        geo.setAttribute('color', geo.userData.originalColorAttr.clone());
      } else if (geo.getAttribute('color')) {
        geo.deleteAttribute('color');
      }
      geo.userData.customUvAllocated = false;
      geo.userData.customSkirtColorsApplied = false;

      materials.forEach((mat) => {
        if (!mat) return;
        const stdMat = mat as THREE.MeshStandardMaterial;
        const rampTex = mat.userData.customRampTexture as
          | THREE.Texture
          | null
          | undefined;
        if (rampTex && !disposedTextures.has(rampTex)) {
          rampTex.dispose();
          disposedTextures.add(rampTex);
        }
        mat.userData.customRampTexture = null;
        mat.userData.customRampKey = null;
        stdMat.map = mat.userData.originalMap ?? null;
        stdMat.vertexColors = Boolean(mat.userData.originalVertexColors);
        if (stdMat.color && typeof mat.userData.originalColorHex === 'number') {
          stdMat.color.setHex(mat.userData.originalColorHex);
        }
        stdMat.needsUpdate = true;
      });
      mesh.userData.customColorApplied = false;
      return;
    }

    // Custom Color Mode enabled: update UVs (and apply skirtMask vertex colors once)
    const vertexElevations = geo.userData.vertexElevations as
      | Float32Array
      | undefined;
    if (!vertexElevations) return;

    const count = vertexElevations.length;
    let uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (
      !geo.userData.customUvAllocated ||
      !uvAttr ||
      uvAttr.count !== count ||
      uvAttr.itemSize !== 2 ||
      !(uvAttr.array instanceof Float32Array)
    ) {
      const uvArray = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
        uvArray[i * 2 + 1] = 0.5;
      }
      uvAttr = new THREE.BufferAttribute(uvArray, 2);
      geo.setAttribute('uv', uvAttr);
      geo.userData.customUvAllocated = true;
    }

    const uvArray = uvAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      uvArray[i * 2] = (vertexElevations[i] - minElev) * invSpan;
    }
    uvAttr.needsUpdate = true;

    const skirtMask = geo.userData.skirtMask as Uint8Array | undefined;
    if (skirtMask && !geo.userData.customSkirtColorsApplied) {
      let colorAttr = geo.getAttribute('color') as
        | THREE.BufferAttribute
        | undefined;
      if (
        !colorAttr ||
        colorAttr.count !== count ||
        colorAttr.itemSize !== 3 ||
        !(colorAttr.array instanceof Float32Array)
      ) {
        colorAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
        geo.setAttribute('color', colorAttr);
      }
      const colorArray = colorAttr.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const cIdx = i * 3;
        if (skirtMask[i] === 1) {
          colorArray[cIdx] = 0.2;
          colorArray[cIdx + 1] = 0.25;
          colorArray[cIdx + 2] = 0.33;
        } else {
          colorArray[cIdx] = 1.0;
          colorArray[cIdx + 1] = 1.0;
          colorArray[cIdx + 2] = 1.0;
        }
      }
      colorAttr.needsUpdate = true;
      geo.userData.customSkirtColorsApplied = true;
    }

    materials.forEach((mat) => {
      if (!mat) return;
      const stdMat = mat as THREE.MeshStandardMaterial;
      const existingTex = (mat.userData.customRampTexture ??
        null) as THREE.DataTexture | null;

      if (!sharedRampTexture) {
        if (existingTex && mat.userData.customRampKey === rampSignature) {
          sharedRampTexture = existingTex;
          sharedRampUpdated = true;
        } else {
          sharedRampTexture = createOrUpdateElevationRampTexture(
            existingTex,
            colorConfig
          );
          sharedRampUpdated = true;
        }
      } else if (!sharedRampUpdated) {
        createOrUpdateElevationRampTexture(sharedRampTexture, colorConfig);
        sharedRampUpdated = true;
      }

      if (
        existingTex &&
        existingTex !== sharedRampTexture &&
        !disposedTextures.has(existingTex)
      ) {
        existingTex.dispose();
        disposedTextures.add(existingTex);
      }

      const prevHasMap = Boolean(stdMat.map);
      const nextVertexColors = Boolean(skirtMask);
      const needsMaterialUpdate =
        !prevHasMap ||
        stdMat.map !== sharedRampTexture ||
        stdMat.vertexColors !== nextVertexColors;

      mat.userData.customRampTexture = sharedRampTexture;
      mat.userData.customRampKey = rampSignature;
      stdMat.map = sharedRampTexture;
      stdMat.vertexColors = nextVertexColors;
      if (stdMat.color) {
        stdMat.color.setHex(0xffffff);
      }
      if (needsMaterialUpdate) {
        stdMat.needsUpdate = true;
      }
    });

    mesh.userData.customColorApplied = true;
  });
}
