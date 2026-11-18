import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_Z_SCALE_CONFIG,
  DEFAULT_WATER_LEVEL_CONFIG,
  MIN_ELEVATION_METERS,
  MAX_ELEVATION_METERS,
  validateZRange,
  validateWaterRange,
  validateWaterStep,
  clampZScale,
  applyCustomZScale,
  applyCustomWaterLevel,
  updateZScaleRange,
  getZTransformationScale,
  validateModelFileName,
  computeCameraFit,
  getDiscreteElevationRgb,
  computeClickedMapPointInfo,
  computeWaterPlaneWorldY,
} from './viewerLogic';

test('default Z-axis exaggeration settings match specification', () => {
  assert.equal(DEFAULT_Z_SCALE_CONFIG.min, 0.1);
  assert.equal(DEFAULT_Z_SCALE_CONFIG.max, 5.0);
  assert.equal(DEFAULT_Z_SCALE_CONFIG.scale, 1.0);
  assert.equal(DEFAULT_Z_SCALE_CONFIG.step, 0.1);
});

test('validateZRange accepts valid min < max and rejects min >= max', () => {
  const valid = validateZRange(0.2, 8.5);
  assert.equal(valid.valid, true);
  assert.equal(valid.error, null);
  assert.equal(valid.min, 0.2);
  assert.equal(valid.max, 8.5);

  const equalRange = validateZRange(3.0, 3.0);
  assert.equal(equalRange.valid, false);
  assert.ok(equalRange.error?.includes('Minimum value must be strictly less than Maximum value'));

  const invertedRange = validateZRange(6.0, 2.0);
  assert.equal(invertedRange.valid, false);
  assert.ok(invertedRange.error?.includes('Minimum value must be strictly less than Maximum value'));

  const negativeRange = validateZRange(-1, 5);
  assert.equal(negativeRange.valid, false);
  assert.ok(negativeRange.error?.includes('greater than 0'));
});

test('validateWaterRange, validateWaterStep, and applyCustomWaterLevel support custom water level min/max/step bounds', () => {
  const valid = validateWaterRange(100, 2000);
  assert.equal(valid.valid, true);
  assert.equal(valid.min, 100);
  assert.equal(valid.max, 2000);

  const invalid = validateWaterRange(1500, 500);
  assert.equal(invalid.valid, false);

  const validStep = validateWaterStep('10');
  assert.equal(validStep.valid, true);
  assert.equal(validStep.step, 10);

  const zeroStep = validateWaterStep('0');
  assert.equal(zeroStep.valid, false);
  assert.ok(zeroStep.error?.includes('greater than 0'));

  const customAbove = applyCustomWaterLevel(DEFAULT_WATER_LEVEL_CONFIG, '1800');
  assert.equal(customAbove.valid, true);
  assert.equal(customAbove.config.level, 1800);
  assert.equal(customAbove.config.max, 1800);
});

test('applyCustomZScale updates scale immediately and auto-expands min or max if custom value exceeds current bounds', () => {
  const within = applyCustomZScale(DEFAULT_Z_SCALE_CONFIG, '2.75');
  assert.equal(within.valid, true);
  assert.equal(within.config.scale, 2.75);
  assert.equal(within.config.min, 0.1);
  assert.equal(within.config.max, 5.0);

  const aboveMax = applyCustomZScale(DEFAULT_Z_SCALE_CONFIG, '8.5');
  assert.equal(aboveMax.valid, true);
  assert.equal(aboveMax.config.scale, 8.5);
  assert.equal(aboveMax.config.max, 8.5);

  const belowMin = applyCustomZScale(DEFAULT_Z_SCALE_CONFIG, '0.05');
  assert.equal(belowMin.valid, true);
  assert.equal(belowMin.config.scale, 0.05);
  assert.equal(belowMin.config.min, 0.05);
});

test('updateZScaleRange updates slider bounds and clamps current Z-scale into new range', () => {
  const initial = { ...DEFAULT_Z_SCALE_CONFIG, scale: 4.5 };
  const updated = updateZScaleRange(initial, 0.5, 3.0);
  assert.equal(updated.error, null);
  assert.equal(updated.config.min, 0.5);
  assert.equal(updated.config.max, 3.0);
  assert.equal(updated.config.scale, 3.0);

  const invalidAttempt = updateZScaleRange(updated.config, 5.0, 2.0);
  assert.notEqual(invalidAttempt.error, null);
  assert.equal(invalidAttempt.config.min, 0.5);
  assert.equal(invalidAttempt.config.max, 3.0);
  assert.equal(invalidAttempt.config.scale, 3.0);
});

test('getZTransformationScale preserves X and Y while scaling only Z', () => {
  const scaleVec = getZTransformationScale(2.8);
  assert.deepEqual(scaleVec, { x: 1, y: 1, z: 2.8 });
});

test('clampZScale respects min and max boundaries', () => {
  assert.equal(clampZScale(0.01, 0.1, 5.0), 0.1);
  assert.equal(clampZScale(7.2, 0.1, 5.0), 5.0);
  assert.equal(clampZScale(2.4, 0.1, 5.0), 2.4);
});

test('validateModelFileName allows .glb and .gltf and rejects unsupported extensions', () => {
  assert.equal(validateModelFileName('haryana_dem.glb').valid, true);
  assert.equal(validateModelFileName('assembly.GLTF').valid, true);

  const bad = validateModelFileName('document.pdf');
  assert.equal(bad.valid, false);
  assert.ok(bad.error?.includes('Unsupported file format'));
});

test('computeCameraFit calculates positive framing distance and clip planes', () => {
  const fit = computeCameraFit({ x: 2, y: 2, z: 3 }, 45);
  assert.ok(fit.distance > 2);
  assert.ok(fit.near > 0);
  assert.ok(fit.far > fit.distance);
});

test('getDiscreteElevationRgb returns distinct non-mixing RGB colors across elevation steps', () => {
  const low = getDiscreteElevationRgb(0.05);
  const mid = getDiscreteElevationRgb(0.45);
  const high = getDiscreteElevationRgb(0.95);
  assert.notDeepEqual(low, mid);
  assert.notDeepEqual(mid, high);
});

test('computeClickedMapPointInfo calculates geographic coordinates, X/Y coordinates, and elevation values', () => {
  const point = computeClickedMapPointInfo({
    worldX: 0.42,
    worldHorizontalZ: -0.68,
    worldVerticalY: 1.5,
    zScale: 2.0,
    baseDimensions: { x: 2.4, y: 2.4, z: 1.0 },
    minReliefZ: 0.2,
    maxReliefZ: 1.0,
  });

  assert.equal(point.baseZ, 0.75);
  assert.equal(point.scaledZ, 1.5);
  assert.ok(point.latitude > 29.5);
  assert.ok(point.longitude > 76.0);
  assert.ok(point.elevationMeters > 900);
  assert.ok(point.coordinateLabel.includes('° N'));
  assert.ok(point.coordinateLabel.includes('° E'));
  assert.equal(point.xyLabel, 'X: 0.42, Y: -0.68');
});

test('computeWaterPlaneWorldY maps water level meters accurately to scaled world Y height and matches model elevation 1:1', () => {
  const minY = computeWaterPlaneWorldY({
    waterLevelMeters: MIN_ELEVATION_METERS,
    minReliefZ: 0.2,
    maxReliefZ: 1.0,
    zScale: 2.0,
  });
  assert.equal(minY, 0.4);

  const maxY = computeWaterPlaneWorldY({
    waterLevelMeters: MAX_ELEVATION_METERS,
    minReliefZ: 0.2,
    maxReliefZ: 1.0,
    zScale: 2.0,
  });
  assert.equal(maxY, 2.0);

  // Verify thin DEM case (minReliefZ = 0, maxReliefZ = 0.012 where top of model is 489 m):
  // Water level 181 m stays near the bottom, and water level 489 m reaches the 0.012 top.
  const topPoint = computeClickedMapPointInfo({
    worldX: 0,
    worldHorizontalZ: 0,
    worldVerticalY: 0.012,
    zScale: 1.0,
    baseDimensions: { x: 2.4, y: 2.4, z: 0.012 },
    minReliefZ: 0,
    maxReliefZ: 0.012,
  });
  assert.equal(topPoint.elevationMeters, 489);

  const waterAt181 = computeWaterPlaneWorldY({
    waterLevelMeters: 181,
    minReliefZ: 0,
    maxReliefZ: 0.012,
    zScale: 1.0,
  });
  assert.ok(waterAt181 < 0.001);

  const waterAt489 = computeWaterPlaneWorldY({
    waterLevelMeters: 489,
    minReliefZ: 0,
    maxReliefZ: 0.012,
    zScale: 1.0,
  });
  assert.equal(waterAt489, 0.012);
});
