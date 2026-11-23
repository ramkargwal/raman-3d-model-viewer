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

export type ColorMapInterpolationMode = 'INTERPOLATED' | 'DISCRETE' | 'EXACT';

export type ColorDistributionMode = 'even' | 'ratio';

export interface ColorMapStop {
  /** Original elevation value from the QGIS color file (meters) */
  elevation: number;
  /** Red channel normalized in [0, 1] */
  r: number;
  /** Green channel normalized in [0, 1] */
  g: number;
  /** Blue channel normalized in [0, 1] */
  b: number;
  /** Alpha channel normalized in [0, 1] */
  a: number;
  /** CSS hex color string (e.g. '#2cc92c') */
  hex: string;
  /** Stop label */
  label: string;
}

export interface ElevationColorConfig {
  /** False by default so the model opens in its default colors and UI remains clean */
  enabled: boolean;
  /** Active minimum elevation (meters) where the color ramp starts */
  minElevation: number;
  /** Active maximum elevation (meters) where the color ramp ends */
  maxElevation: number;
  /** Slider track lower bound (meters) */
  domainMin: number;
  /** Slider track upper bound (meters) */
  domainMax: number;
  /** Original minimum elevation of the loaded 3D model (meters) */
  modelMinElevation?: number;
  /** Original maximum elevation of the loaded 3D model (meters) */
  modelMaxElevation?: number;
  /** Slider step in meters */
  step: number;
  /** Interpolation mode from QGIS color file or user selection */
  interpolation: ColorMapInterpolationMode;
  /** How stops are distributed across [minElevation, maxElevation] */
  distributionMode: ColorDistributionMode;
  /** Parsed QGIS color stops */
  stops: ColorMapStop[];
  /** Loaded color map file name */
  fileName: string;
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
export const DEFAULT_UPLOADED_MIN_ELEVATION_METERS = 0;
export const DEFAULT_UPLOADED_MAX_ELEVATION_METERS = 1000;

export interface ModelElevationDetectionInput {
  /** Raw unnormalized bounding box size (Three.js +Y up: x=width, y=height, z=depth) */
  rawSize: { x: number; y: number; z: number };
  /** Minimum raw Y coordinate of the terrain surface */
  rawMinY: number;
  /** Maximum raw Y coordinate of the terrain surface */
  rawMaxY: number;
  /** Optional explicit elevation range extracted from glTF extras/userData */
  metadataRange?: { min: number; max: number } | null;
}

export interface ResolvedModelElevationBounds {
  minElevation: number;
  maxElevation: number;
  source: 'metadata' | 'geometry-meters' | 'default';
}

/**
 * Determines the elevation range [minElevation, maxElevation] in meters for any loaded 3D map/model:
 * 1. Explicit model metadata (glTF asset/scene/mesh extras or procedural DEM metadata) if present.
 * 2. True-scale meter DEM geometry (horizontal span >= 500 m, vertical relief >= 1 m within Earth bounds).
 * 3. Clean topographic fallback [0 m, 1000 m] for normalized/scene-unit 3D maps (e.g. sea level 0 m to peak 1000 m).
 */
export function resolveModelElevationBounds(
  input: ModelElevationDetectionInput
): ResolvedModelElevationBounds {
  const { rawSize, rawMinY, rawMaxY, metadataRange } = input;

  if (
    metadataRange &&
    Number.isFinite(metadataRange.min) &&
    Number.isFinite(metadataRange.max) &&
    metadataRange.max > metadataRange.min
  ) {
    const minElevation = Math.max(0, roundScale(metadataRange.min));
    const maxElevation = Math.max(minElevation + 1, roundScale(metadataRange.max));
    return { minElevation, maxElevation, source: 'metadata' };
  }

  const maxHorizontal = Math.max(
    Number.isFinite(rawSize.x) ? Math.abs(rawSize.x) : 0,
    Number.isFinite(rawSize.z) ? Math.abs(rawSize.z) : 0
  );
  const rawSpanY =
    Number.isFinite(rawMinY) && Number.isFinite(rawMaxY) ? rawMaxY - rawMinY : 0;

  // Detect real-world meter-scale DEMs (e.g. UTM/Web Mercator/BlenderGIS exports where 1 unit = 1 meter)
  if (
    maxHorizontal >= 500 &&
    rawSpanY >= 1 &&
    rawMinY >= -11000 &&
    rawMaxY > 0 &&
    rawMaxY <= 9500
  ) {
    const minElevation = Math.max(0, Math.round(rawMinY));
    const maxElevation = Math.max(minElevation + 1, Math.round(rawMaxY));
    return { minElevation, maxElevation, source: 'geometry-meters' };
  }

  return {
    minElevation: DEFAULT_UPLOADED_MIN_ELEVATION_METERS,
    maxElevation: DEFAULT_UPLOADED_MAX_ELEVATION_METERS,
    source: 'default',
  };
}

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

export const DEFAULT_QGIS_COLOR_MAP_ASSET_PATH =
  './assets/aistudio/haryana_color_48a943d1.txt';

export const DEFAULT_QGIS_COLOR_MAP_FILE_NAME = 'haryana_color.txt';

export const DEFAULT_QGIS_COLOR_MAP_TEXT = `# QGIS Generated Color Map Export File
INTERPOLATION:INTERPOLATED
170,0,0,0,255,170
200,44,201,44,255,200
230,248,225,7,255,230
260,253,136,136,255,260
300,225,0,0,255,300
500,139,0,197,255,500
900,255,0,255,255,900
2000,255,255,255,255,2000
`;

function rgbBytesToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parses a QGIS Generated Color Map Export File (.txt / .clr).
 * Supports INTERPOLATION:INTERPOLATED|DISCRETE|EXACT and lines of format:
 * elevation, r, g, b, a, label
 */
export function parseQgisColorMapText(rawText: string): {
  valid: boolean;
  error: string | null;
  interpolation: ColorMapInterpolationMode;
  stops: ColorMapStop[];
  minElevation: number;
  maxElevation: number;
} {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  let interpolation: ColorMapInterpolationMode = 'INTERPOLATED';
  const stops: ColorMapStop[] = [];

  for (const line of lines) {
    if (/^INTERPOLATION\s*:/i.test(line)) {
      const modeRaw = line.split(':')[1]?.trim().toUpperCase() || '';
      if (modeRaw === 'DISCRETE') {
        interpolation = 'DISCRETE';
      } else if (modeRaw === 'EXACT') {
        interpolation = 'EXACT';
      } else {
        interpolation = 'INTERPOLATED';
      }
      continue;
    }

    const parts = line.split(/[,\s;]+/).map((p) => p.trim());
    if (parts.length < 4) continue;

    const elevation = Number(parts[0]);
    const rByte = Number(parts[1]);
    const gByte = Number(parts[2]);
    const bByte = Number(parts[3]);
    const aByte = parts.length >= 5 ? Number(parts[4]) : 255;
    const label = parts.length >= 6 ? parts.slice(5).join(' ') : String(elevation);

    if (
      !Number.isFinite(elevation) ||
      !Number.isFinite(rByte) ||
      !Number.isFinite(gByte) ||
      !Number.isFinite(bByte)
    ) {
      continue;
    }

    const rClamped = Math.max(0, Math.min(255, rByte));
    const gClamped = Math.max(0, Math.min(255, gByte));
    const bClamped = Math.max(0, Math.min(255, bByte));
    const aClamped = Number.isFinite(aByte)
      ? Math.max(0, Math.min(255, aByte))
      : 255;

    stops.push({
      elevation: roundScale(elevation),
      r: roundScale(rClamped / 255),
      g: roundScale(gClamped / 255),
      b: roundScale(bClamped / 255),
      a: roundScale(aClamped / 255),
      hex: rgbBytesToHex(rClamped, gClamped, bClamped),
      label: label || String(elevation),
    });
  }

  stops.sort((a, b) => a.elevation - b.elevation);

  if (stops.length < 2) {
    return {
      valid: false,
      error:
        'Invalid color map file. Please provide a QGIS color map (.txt) with at least 2 elevation color stops.',
      interpolation: 'INTERPOLATED',
      stops: [],
      minElevation: MIN_ELEVATION_METERS,
      maxElevation: MAX_ELEVATION_METERS,
    };
  }

  const minElevation = stops[0].elevation;
  const maxElevation = Math.max(
    minElevation + 1,
    stops[stops.length - 1].elevation
  );

  return {
    valid: true,
    error: null,
    interpolation,
    stops,
    minElevation,
    maxElevation,
  };
}

const PARSED_DEFAULT_QGIS = parseQgisColorMapText(DEFAULT_QGIS_COLOR_MAP_TEXT);

export const DEFAULT_ELEVATION_COLOR_CONFIG: ElevationColorConfig = {
  enabled: false,
  minElevation: MIN_ELEVATION_METERS,
  maxElevation: MAX_ELEVATION_METERS,
  domainMin: MIN_ELEVATION_METERS,
  domainMax: MAX_ELEVATION_METERS,
  modelMinElevation: MIN_ELEVATION_METERS,
  modelMaxElevation: MAX_ELEVATION_METERS,
  step: 1,
  interpolation: PARSED_DEFAULT_QGIS.interpolation,
  distributionMode: 'even',
  stops: PARSED_DEFAULT_QGIS.stops,
  fileName: DEFAULT_QGIS_COLOR_MAP_FILE_NAME,
};

/**
 * Clamps the active [minElevation, maxElevation] slider values within the current [domainMin, domainMax] bounds
 * without altering domainMin or domainMax, so sliders can move freely left and right within the domain
 * and moving a slider does not overwrite the Min (m) / Max (m) input box limits.
 */
export function clampElevationColorRange(
  minVal: number,
  maxVal: number,
  domainMin = MIN_ELEVATION_METERS,
  domainMax = MAX_ELEVATION_METERS
): { minElevation: number; maxElevation: number; domainMin: number; domainMax: number } {
  const safeDomainMin = Number.isFinite(domainMin)
    ? roundScale(Math.max(0, domainMin))
    : MIN_ELEVATION_METERS;
  const safeDomainMax =
    Number.isFinite(domainMax) && domainMax >= safeDomainMin
      ? roundScale(domainMax)
      : Math.max(safeDomainMin, MAX_ELEVATION_METERS);

  const rawMin = Number.isFinite(minVal) ? roundScale(minVal) : safeDomainMin;
  const rawMax = Number.isFinite(maxVal) ? roundScale(maxVal) : safeDomainMax;

  const clampedMin = Math.max(safeDomainMin, Math.min(safeDomainMax, rawMin));
  const clampedMax = Math.max(safeDomainMin, Math.min(safeDomainMax, rawMax));

  const finalMin = Math.min(clampedMin, clampedMax);
  const finalMax = Math.max(clampedMin, clampedMax);

  return {
    minElevation: finalMin,
    maxElevation: finalMax,
    domainMin: safeDomainMin,
    domainMax: safeDomainMax,
  };
}

/**
 * Updates the slider domain limits [domainMin, domainMax] when the user edits the Min (m) or Max (m)
 * input boxes, and positions the corresponding slider thumb at the newly set boundary.
 */
export function applyElevationColorDomain(
  prev: Pick<ElevationColorConfig, 'minElevation' | 'maxElevation' | 'domainMin' | 'domainMax'>,
  newDomainMin: number,
  newDomainMax: number,
  changedBound: 'min' | 'max' | 'both' = 'both'
): { minElevation: number; maxElevation: number; domainMin: number; domainMax: number } {
  const rawMin = Number.isFinite(newDomainMin)
    ? roundScale(Math.max(0, newDomainMin))
    : prev.domainMin;
  const rawMax = Number.isFinite(newDomainMax)
    ? roundScale(Math.max(0, newDomainMax))
    : prev.domainMax;

  const safeDomainMin = Math.min(rawMin, rawMax);
  const safeDomainMax = Math.max(rawMin, rawMax);

  let nextMin =
    changedBound === 'min' || changedBound === 'both'
      ? safeDomainMin
      : Math.max(safeDomainMin, Math.min(safeDomainMax, prev.minElevation));
  let nextMax =
    changedBound === 'max' || changedBound === 'both'
      ? safeDomainMax
      : Math.max(safeDomainMin, Math.min(safeDomainMax, prev.maxElevation));

  if (nextMin > nextMax) {
    if (changedBound === 'min') {
      nextMax = nextMin;
    } else {
      nextMin = nextMax;
    }
  }

  return {
    minElevation: nextMin,
    maxElevation: nextMax,
    domainMin: safeDomainMin,
    domainMax: safeDomainMax,
  };
}

/**
 * Computes the redistributed elevation stops within the user's selected [minElevation, maxElevation] range.
 * - In 'even' mode: all stops from the color map are distributed at equal intervals across [minElevation, maxElevation]
 *   so every color is clearly visible even in narrow flat-plain ranges like 180m–220m.
 * - In 'ratio' mode: stops preserve their relative spacing ratios from the original QGIS file within [minElevation, maxElevation].
 */
export function getRedistributedColorStops(
  config: Pick<
    ElevationColorConfig,
    'minElevation' | 'maxElevation' | 'distributionMode' | 'stops'
  >
): Array<ColorMapStop & { ratio: number; mappedElevation: number }> {
  const { stops, minElevation, maxElevation, distributionMode } = config;
  if (!stops || stops.length === 0) return [];

  const count = stops.length;
  const origMin = stops[0].elevation;
  const origMax = stops[count - 1].elevation;
  const origSpan = origMax - origMin;
  const targetSpan = Math.max(0, maxElevation - minElevation);

  return stops.map((stop, idx) => {
    let ratio: number;
    if (count === 1) {
      ratio = 0;
    } else if (distributionMode === 'ratio' && origSpan > 0.0001) {
      ratio = (stop.elevation - origMin) / origSpan;
    } else {
      ratio = idx / (count - 1);
    }
    ratio = Math.max(0, Math.min(1, ratio));
    const mappedElevation = roundScale(minElevation + ratio * targetSpan);
    return {
      ...stop,
      ratio,
      mappedElevation,
    };
  });
}

/**
 * Evaluates the normalized RGB color [r, g, b] in [0, 1] for a given elevation (in meters)
 * using the active ElevationColorConfig and its [minElevation, maxElevation] range.
 */
export function evaluateCustomElevationColorRgb(
  elevationMeters: number,
  config: Pick<
    ElevationColorConfig,
    | 'minElevation'
    | 'maxElevation'
    | 'interpolation'
    | 'distributionMode'
    | 'stops'
  >
): readonly [number, number, number] {
  const stops = config.stops;
  if (!stops || stops.length === 0) {
    return [0.5, 0.5, 0.5];
  }
  if (stops.length === 1) {
    return [stops[0].r, stops[0].g, stops[0].b];
  }

  const span = Math.max(0.001, config.maxElevation - config.minElevation);
  const t = Math.max(
    0,
    Math.min(1, (elevationMeters - config.minElevation) / span)
  );

  const count = stops.length;
  const origMin = stops[0].elevation;
  const origMax = stops[count - 1].elevation;
  const origSpan = origMax - origMin;
  const useRatio = config.distributionMode === 'ratio' && origSpan > 0.0001;
  const invCountMinusOne = 1 / (count - 1);

  if (t <= 0) {
    return [stops[0].r, stops[0].g, stops[0].b];
  }
  if (t >= 1) {
    const last = stops[count - 1];
    return [last.r, last.g, last.b];
  }

  let r0 = useRatio
    ? Math.max(0, Math.min(1, (stops[0].elevation - origMin) / origSpan))
    : 0;

  for (let i = 0; i < count - 1; i++) {
    const r1 = useRatio
      ? Math.max(0, Math.min(1, (stops[i + 1].elevation - origMin) / origSpan))
      : (i + 1) * invCountMinusOne;
    if (t >= r0 && t <= r1) {
      if (config.interpolation !== 'INTERPOLATED') {
        const s = stops[i];
        return [s.r, s.g, s.b];
      }
      const segSpan = r1 - r0;
      const localT = segSpan > 1e-6 ? (t - r0) / segSpan : 0;
      const s0 = stops[i];
      const s1 = stops[i + 1];
      return [
        roundScale(s0.r + (s1.r - s0.r) * localT),
        roundScale(s0.g + (s1.g - s0.g) * localT),
        roundScale(s0.b + (s1.b - s0.b) * localT),
      ];
    }
    r0 = r1;
  }

  const last = stops[count - 1];
  return [last.r, last.g, last.b];
}

/**
 * Validates user-supplied minimum and maximum Elevation Color bounds from the Min (m) / Max (m) input boxes.
 * Allows any non-negative minimum and maximum values (whether higher or lower than previous limits)
 * as long as 0 <= min <= max.
 */
export function validateElevationColorRange(
  minRaw: string | number,
  maxRaw: string | number,
  domainMin = MIN_ELEVATION_METERS,
  domainMax = MAX_ELEVATION_METERS
): RangeValidationResult {
  const minStr = String(minRaw).trim();
  const maxStr = String(maxRaw).trim();

  if (minStr === '' || maxStr === '') {
    return {
      valid: false,
      error: 'Both Minimum and Maximum elevation values are required.',
      min: domainMin,
      max: domainMax,
    };
  }

  const min = Number(minStr);
  const max = Number(maxStr);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return {
      valid: false,
      error: 'Minimum and Maximum elevation must be valid numbers.',
      min: domainMin,
      max: domainMax,
    };
  }

  if (min < 0 || max < 0) {
    return {
      valid: false,
      error: 'Minimum and Maximum elevation values must be 0 or greater.',
      min,
      max,
    };
  }

  if (min > max) {
    return {
      valid: false,
      error: 'Minimum value must be less than or equal to Maximum value (Min ≤ Max).',
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
 * Computes the unscaled elevation in meters Above Sea Level (m ASL) from a model's baseZ height.
 * Shared between point inspection, water level simulation, and custom elevation color mapping.
 */
export function computeElevationMetersFromBaseZ(
  baseZ: number,
  minReliefZ = 0.2,
  maxReliefZ = 1.0,
  minElevationMeters = MIN_ELEVATION_METERS,
  maxElevationMeters = MAX_ELEVATION_METERS
): number {
  const spanZ = maxReliefZ - minReliefZ;
  const normalizedElevation =
    spanZ > 1e-7
      ? Math.max(0, Math.min(1, (baseZ - minReliefZ) / spanZ))
      : 0;
  return (
    minElevationMeters +
    normalizedElevation * (maxElevationMeters - minElevationMeters)
  );
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
  minElevationMeters?: number;
  maxElevationMeters?: number;
}): MapClickPointInfo {
  const safeScale =
    Number.isFinite(params.zScale) && params.zScale > 0 ? params.zScale : 1.0;

  const x = roundScale(params.worldX);
  const y = roundScale(params.worldHorizontalZ);
  const rawBaseZ = Math.max(0, params.worldVerticalY / safeScale);
  const scaledZ = roundScale(Math.max(0, params.worldVerticalY));
  const baseZ = roundScale(rawBaseZ);

  const halfW = Math.max(0.1, params.baseDimensions.x * 0.5);
  const halfD = Math.max(0.1, params.baseDimensions.y * 0.5);

  // Normalized horizontal coordinates in [-1, 1] (nx: West->East, ny: South->North)
  const nx = Math.max(-1, Math.min(1, x / halfW));
  const ny = Math.max(-1, Math.min(1, -y / halfD));

  // Map onto Haryana / Regional Survey Geographic Bounds (27.65°N–30.92°N, 74.46°E–77.60°E)
  const latitude = Math.round((29.285 + ny * 1.635) * 10000) / 10000;
  const longitude = Math.round((76.03 + nx * 1.57) * 10000) / 10000;

  const minZ = params.minReliefZ ?? 0.2;
  const rawMaxZ = params.maxReliefZ ?? params.baseDimensions.z;
  const maxZ = rawMaxZ > minZ + 1e-7 ? rawMaxZ : minZ + 1e-4;
  const minElev = params.minElevationMeters ?? MIN_ELEVATION_METERS;
  const maxElev = params.maxElevationMeters ?? MAX_ELEVATION_METERS;
  const elevationMeters = Math.round(
    computeElevationMetersFromBaseZ(rawBaseZ, minZ, maxZ, minElev, maxElev)
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
 * Uses the exact same vertical relief datum (minZ .. maxZ) and elevation range as computeClickedMapPointInfo
 * so that any elevation value in Information matches the 3D water plane height 1:1,
 * independent of the Water Level slider's Min/Max range settings.
 */
export function computeWaterPlaneWorldY(params: {
  waterLevelMeters: number;
  minReliefZ: number;
  maxReliefZ: number;
  zScale: number;
  minElevationMeters?: number;
  maxElevationMeters?: number;
}): number {
  const safeScale =
    Number.isFinite(params.zScale) && params.zScale > 0 ? params.zScale : 1.0;
  const minZ = params.minReliefZ;
  const maxZ = params.maxReliefZ > minZ + 1e-7 ? params.maxReliefZ : minZ + 1e-4;
  const minElev = params.minElevationMeters ?? MIN_ELEVATION_METERS;
  const maxElev = params.maxElevationMeters ?? MAX_ELEVATION_METERS;
  const norm = Math.max(
    0,
    (params.waterLevelMeters - minElev) / Math.max(1e-6, maxElev - minElev)
  );
  const baseZ = minZ + norm * (maxZ - minZ);
  return Math.round(baseZ * safeScale * 1e6) / 1e6;
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
