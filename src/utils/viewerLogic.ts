export interface ZScaleConfig {
  min: number;
  max: number;
  scale: number;
  step: number;
}

export interface WaterLevelConfig {
  enabled: boolean;
  min: number;
  max: number;
  level: number;
  step: number;
}

export interface Dimensions3D {
  x: number;
  y: number;
  z: number;
}

export interface RangeValidationResult {
  valid: boolean;
  error: string | null;
  min: number;
  max: number;
}

export interface MapClickPointInfo {
  /** Horizontal X coordinate in model space (East-West) */
  x: number;
  /** Horizontal Y coordinate in model space (North-South depth) */
  y: number;
  /** Unscaled base Z height in model units */
  baseZ: number;
  /** Vertically scaled Z height at current Z-axis exaggeration */
  scaledZ: number;
  /** Mapped geographic latitude (degrees North) */
  latitude: number;
  /** Mapped geographic longitude (degrees East) */
  longitude: number;
  /** Formatted geographic Lat/Long string */
  coordinateLabel: string;
  /** Formatted X, Y model coordinate string */
  xyLabel: string;
  /** Unscaled elevation in meters Above Sea Level (m ASL) */
  elevationMeters: number;
}

export const MIN_ELEVATION_METERS = 180;
export const MAX_ELEVATION_METERS = 1467;

export const DEFAULT_Z_SCALE_CONFIG: ZScaleConfig = {
  min: 0.1,
  max: 5.0,
  scale: 1.0,
  step: 0.1,
};

export const DEFAULT_WATER_LEVEL_CONFIG: WaterLevelConfig = {
  enabled: false,
  min: MIN_ELEVATION_METERS,
  max: MAX_ELEVATION_METERS,
  level: 280,
  step: 5,
};

/**
 * 8 distinct, high-contrast hypsometric elevation color bands (RGB normalized in [0, 1]).
 */
export const ELEVATION_BAND_RGB: readonly (readonly [number, number, number])[] = [
  [0.008, 0.518, 0.780], // Low Floodplain (#0284c7)
  [0.051, 0.580, 0.533], // Lower Alluvial Basin (#0d9488)
  [0.086, 0.639, 0.290], // Central Plains (#16a34a)
  [0.396, 0.639, 0.051], // Upper Terrace (#65a30d)
  [0.918, 0.702, 0.031], // Bagar Uplands (#eab308)
  [0.976, 0.451, 0.086], // Aravalli Foothills (#f97316)
  [0.863, 0.149, 0.149], // Lower Shivalik Ridge (#dc2626)
  [0.576, 0.200, 0.918], // High Shivalik Peaks (#9333ea)
];

/**
 * Returns the discrete elevation RGB color tuple for a normalized height [0, 1] without blending.
 */
export function getDiscreteElevationRgb(
  normalizedHeight: number
): readonly [number, number, number] {
  const clamped = Math.min(0.9999, Math.max(0, normalizedHeight));
  const idx = Math.min(
    ELEVATION_BAND_RGB.length - 1,
    Math.floor(clamped * ELEVATION_BAND_RGB.length)
  );
  return ELEVATION_BAND_RGB[idx];
}

/**
 * Computes Geo Coordinates (Lat/Long), X/Y Coordinates, and Elevation value (Meters ASL)
 * when a user hovers or clicks a point on the 3D map/model.
 */
export function computeClickedMapPointInfo(params: {
  worldX: number;
  worldHorizontalZ: number;
  worldVerticalY: number;
  zScale: number;
  baseDimensions: Dimensions3D;
  minReliefZ?: number;
  maxReliefZ?: number;
}): MapClickPointInfo {
  const safeScale =
    Number.isFinite(params.zScale) && params.zScale > 0 ? params.zScale : 1.0;

  const x = roundScale(params.worldX);
  const y = roundScale(params.worldHorizontalZ);
  const scaledZ = roundScale(Math.max(0, params.worldVerticalY));
  const baseZ = roundScale(Math.max(0, params.worldVerticalY / safeScale));

  const halfW = Math.max(0.1, params.baseDimensions.x * 0.5);
  const halfD = Math.max(0.1, params.baseDimensions.y * 0.5);

  // Normalized horizontal coordinates in [-1, 1] (nx: West->East, ny: South->North)
  const nx = Math.max(-1, Math.min(1, x / halfW));
  const ny = Math.max(-1, Math.min(1, -y / halfD));

  // Map onto Haryana / Regional Survey Geographic Bounds (27.65°N–30.92°N, 74.46°E–77.60°E)
  const latitude = Math.round((29.285 + ny * 1.635) * 10000) / 10000;
  const longitude = Math.round((76.03 + nx * 1.57) * 10000) / 10000;

  const minZ = params.minReliefZ ?? 0.2;
  const maxZ = Math.max(minZ + 0.05, params.maxReliefZ ?? params.baseDimensions.z);
  const normalizedElevation = Math.max(
    0,
    Math.min(1, (baseZ - minZ) / Math.max(0.001, maxZ - minZ))
  );

  const elevationMeters = Math.round(
    MIN_ELEVATION_METERS +
      normalizedElevation * (MAX_ELEVATION_METERS - MIN_ELEVATION_METERS)
  );

  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  const coordinateLabel = `${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(
    longitude
  ).toFixed(4)}° ${lonDir}`;
  const xyLabel = `X: ${x.toFixed(2)}, Y: ${y.toFixed(2)}`;

  return {
    x,
    y,
    baseZ,
    scaledZ,
    latitude,
    longitude,
    coordinateLabel,
    xyLabel,
    elevationMeters,
  };
}

/**
 * Converts a water level in meters into the scaled 3D vertical Y height in world space.
 * Uses the exact same vertical relief datum (minZ .. maxZ) as computeClickedMapPointInfo
 * so that any elevation value in Information matches the 3D water plane height 1:1,
 * independent of the Water Level slider's Min/Max range settings.
 */
export function computeWaterPlaneWorldY(params: {
  waterLevelMeters: number;
  minReliefZ: number;
  maxReliefZ: number;
  zScale: number;
}): number {
  const safeScale =
    Number.isFinite(params.zScale) && params.zScale > 0 ? params.zScale : 1.0;
  const minZ = params.minReliefZ;
  const maxZ = Math.max(minZ + 0.05, params.maxReliefZ);
  const norm = Math.max(
    0,
    (params.waterLevelMeters - MIN_ELEVATION_METERS) /
      Math.max(1, MAX_ELEVATION_METERS - MIN_ELEVATION_METERS)
  );
  const baseZ = minZ + norm * (maxZ - minZ);
  return roundScale(baseZ * safeScale);
}

/**
 * Validates user-supplied minimum and maximum Z-scale bounds.
 * Prevents invalid ranges where minimum >= maximum, NaN, or <= 0.
 */
export function validateZRange(
  minRaw: string | number,
  maxRaw: string | number
): RangeValidationResult {
  const minStr = String(minRaw).trim();
  const maxStr = String(maxRaw).trim();

  if (minStr === '' || maxStr === '') {
    return {
      valid: false,
      error: 'Both Minimum and Maximum values are required.',
      min: DEFAULT_Z_SCALE_CONFIG.min,
      max: DEFAULT_Z_SCALE_CONFIG.max,
    };
  }

  const min = Number(minStr);
  const max = Number(maxStr);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return {
      valid: false,
      error: 'Minimum and Maximum must be valid numbers.',
      min: DEFAULT_Z_SCALE_CONFIG.min,
      max: DEFAULT_Z_SCALE_CONFIG.max,
    };
  }

  if (min <= 0 || max <= 0) {
    return {
      valid: false,
      error: 'Minimum and Maximum scaling values must be greater than 0.',
      min,
      max,
    };
  }

  if (min >= max) {
    return {
      valid: false,
      error: 'Minimum value must be strictly less than Maximum value (Min < Max).',
      min,
      max,
    };
  }

  return {
    valid: true,
    error: null,
    min: roundScale(min),
    max: roundScale(max),
  };
}

/**
 * Validates user-supplied minimum and maximum Water Level bounds (allows >= 0, requires Min < Max).
 */
export function validateWaterRange(
  minRaw: string | number,
  maxRaw: string | number
): RangeValidationResult {
  const minStr = String(minRaw).trim();
  const maxStr = String(maxRaw).trim();

  if (minStr === '' || maxStr === '') {
    return {
      valid: false,
      error: 'Both Minimum and Maximum water levels are required.',
      min: DEFAULT_WATER_LEVEL_CONFIG.min,
      max: DEFAULT_WATER_LEVEL_CONFIG.max,
    };
  }

  const min = Number(minStr);
  const max = Number(maxStr);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return {
      valid: false,
      error: 'Min and Max must be valid numbers.',
      min: DEFAULT_WATER_LEVEL_CONFIG.min,
      max: DEFAULT_WATER_LEVEL_CONFIG.max,
    };
  }

  if (min < 0 || max <= 0) {
    return {
      valid: false,
      error: 'Water level bounds must be 0 or greater.',
      min,
      max,
    };
  }

  if (min >= max) {
    return {
      valid: false,
      error: 'Min water level must be less than Max (Min < Max).',
      min,
      max,
    };
  }

  return {
    valid: true,
    error: null,
    min: roundScale(min),
    max: roundScale(max),
  };
}

/**
 * Applies a manual custom Water Level input value.
 * Auto-expands min or max if the typed level is outside the current [min, max] bounds.
 */
export function applyCustomWaterLevel(
  currentConfig: WaterLevelConfig,
  rawLevel: string | number
): { config: WaterLevelConfig; valid: boolean; error: string | null } {
  const str = String(rawLevel).trim();
  if (str === '' || str === '.' || str === '-') {
    return { config: currentConfig, valid: false, error: null };
  }

  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      config: currentConfig,
      valid: false,
      error: 'Water level must be 0 or greater.',
    };
  }

  const safeLevel = roundScale(Math.min(parsed, 10000));
  const nextMin = safeLevel < currentConfig.min ? safeLevel : currentConfig.min;
  const nextMax = safeLevel > currentConfig.max ? safeLevel : currentConfig.max;

  return {
    config: {
      ...currentConfig,
      min: nextMin,
      max: nextMax,
      level: safeLevel,
    },
    valid: true,
    error: null,
  };
}

/**
 * Validates user-supplied slider step for Water Level (requires step > 0).
 */
export function validateWaterStep(stepRaw: string | number): {
  valid: boolean;
  error: string | null;
  step: number;
} {
  const stepStr = String(stepRaw).trim();
  if (stepStr === '' || stepStr === '.') {
    return {
      valid: false,
      error: 'Step value is required.',
      step: DEFAULT_WATER_LEVEL_CONFIG.step,
    };
  }

  const parsed = Number(stepStr);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      valid: false,
      error: 'Slider step must be greater than 0.',
      step: DEFAULT_WATER_LEVEL_CONFIG.step,
    };
  }

  return {
    valid: true,
    error: null,
    step: roundScale(Math.min(parsed, 5000)),
  };
}

/**
 * Rounds a scaling number to 3 decimal places to avoid floating-point drift.
 */
export function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Clamps a numeric Z-scale value between the active min and max bounds.
 */
export function clampZScale(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(Math.max(value, min), max);
  return roundScale(clamped);
}

/**
 * Applies a manual custom Z-scale input value.
 * If the user manually types a positive scale value outside the current [min, max] range,
 * it automatically expands min or max so the custom Z-scale works immediately.
 */
export function applyCustomZScale(
  currentConfig: ZScaleConfig,
  rawCustomScale: string | number
): { config: ZScaleConfig; valid: boolean; error: string | null } {
  const str = String(rawCustomScale).trim();
  if (str === '' || str === '.' || str === '0.') {
    return { config: currentConfig, valid: false, error: null };
  }

  const parsed = Number(str);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      config: currentConfig,
      valid: false,
      error: 'Z-Axis scale must be a number greater than 0.',
    };
  }

  const safeScale = roundScale(Math.min(parsed, 100));
  const nextMin = safeScale < currentConfig.min ? safeScale : currentConfig.min;
  const nextMax = safeScale > currentConfig.max ? safeScale : currentConfig.max;

  return {
    config: {
      ...currentConfig,
      min: nextMin,
      max: nextMax,
      scale: safeScale,
    },
    valid: true,
    error: null,
  };
}

/**
 * Applies a range update and automatically clamps the current Z-scale
 * so the slider and model always respect the active [min, max] bounds.
 */
export function updateZScaleRange(
  currentConfig: ZScaleConfig,
  newMinRaw: string | number,
  newMaxRaw: string | number
): { config: ZScaleConfig; error: string | null } {
  const validation = validateZRange(newMinRaw, newMaxRaw);
  if (!validation.valid) {
    return {
      config: currentConfig,
      error: validation.error,
    };
  }

  const nextScale = clampZScale(currentConfig.scale, validation.min, validation.max);
  return {
    config: {
      ...currentConfig,
      min: validation.min,
      max: validation.max,
      scale: nextScale,
    },
    error: null,
  };
}

/**
 * Computes the transformation group scale vector.
 * Preserves original X (1.0) and Y (1.0) dimensions while changing only Z-axis scale.
 */
export function getZTransformationScale(zScale: number): Dimensions3D {
  const safeZ = Number.isFinite(zScale) && zScale > 0 ? roundScale(zScale) : 1.0;
  return {
    x: 1,
    y: 1,
    z: safeZ,
  };
}

/**
 * Validates that a file name has a supported .glb or .gltf extension.
 */
export function validateModelFileName(fileName: string): {
  valid: boolean;
  error: string | null;
  extension: '.glb' | '.gltf' | null;
} {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'No file selected. Please choose a valid .glb or .gltf 3D model file.',
      extension: null,
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.endsWith('.glb')) {
    return { valid: true, error: null, extension: '.glb' };
  }
  if (lower.endsWith('.gltf')) {
    return { valid: true, error: null, extension: '.gltf' };
  }

  return {
    valid: false,
    error: `Unsupported file format "${trimmed}". Please upload a binary (.glb) or ASCII (.gltf) 3D model file.`,
    extension: null,
  };
}

/**
 * Calculates camera framing parameters to automatically fit a loaded 3D model inside the viewport.
 */
export function computeCameraFit(
  boundingSize: Dimensions3D,
  fovDegrees = 45
): {
  distance: number;
  targetZ: number;
  near: number;
  far: number;
} {
  const maxDim = Math.max(boundingSize.x, boundingSize.y, boundingSize.z, 0.1);
  const fovRad = (fovDegrees * Math.PI) / 180;
  const rawDistance = (maxDim / 2) / Math.tan(fovRad / 2);
  const distance = roundScale(Math.max(rawDistance * 2.05, 1.8));
  const targetZ = roundScale(boundingSize.z * 0.55);
  const near = Math.max(0.01, roundScale(distance / 100));
  const far = Math.max(100, roundScale(distance * 50));

  return {
    distance,
    targetZ,
    near,
    far,
  };
}
