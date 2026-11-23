import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_Z_SCALE_CONFIG,
  DEFAULT_WATER_LEVEL_CONFIG,
  DEFAULT_ELEVATION_COLOR_CONFIG,
  DEFAULT_QGIS_COLOR_MAP_TEXT,
  MIN_ELEVATION_METERS,
  MAX_ELEVATION_METERS,
  validateZRange,
  validateWaterRange,
  validateWaterStep,
  validateElevationColorRange,
  clampElevationColorRange,
  applyElevationColorDomain,
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
  parseQgisColorMapText,
  getRedistributedColorStops,
  evaluateCustomElevationColorRgb,
  resolveModelElevationBounds,
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

  // Verify thin DEM case (e.g. wide India map normalized to minReliefZ = 0, maxReliefZ = 0.012, elevation 0m..1000m):
  // Bottom/sea level maps to 0 m -> worldY = 0, and top Himalayan peak at 0.012 maps to full 1000 m -> worldY = 0.012.
  const bottomPoint = computeClickedMapPointInfo({
    worldX: 0,
    worldHorizontalZ: 0,
    worldVerticalY: 0,
    zScale: 1.0,
    baseDimensions: { x: 2.4, y: 2.4, z: 0.012 },
    minReliefZ: 0,
    maxReliefZ: 0.012,
    minElevationMeters: 0,
    maxElevationMeters: 1000,
  });
  assert.equal(bottomPoint.elevationMeters, 0);

  const topPoint = computeClickedMapPointInfo({
    worldX: 0,
    worldHorizontalZ: 0,
    worldVerticalY: 0.012,
    zScale: 1.0,
    baseDimensions: { x: 2.4, y: 2.4, z: 0.012 },
    minReliefZ: 0,
    maxReliefZ: 0.012,
    minElevationMeters: 0,
    maxElevationMeters: 1000,
  });
  assert.equal(topPoint.elevationMeters, 1000);

  const waterAt0 = computeWaterPlaneWorldY({
    waterLevelMeters: 0,
    minReliefZ: 0,
    maxReliefZ: 0.012,
    zScale: 1.0,
    minElevationMeters: 0,
    maxElevationMeters: 1000,
  });
  assert.equal(waterAt0, 0);

  const waterAt1000 = computeWaterPlaneWorldY({
    waterLevelMeters: 1000,
    minReliefZ: 0,
    maxReliefZ: 0.012,
    zScale: 1.0,
    minElevationMeters: 0,
    maxElevationMeters: 1000,
  });
  assert.equal(waterAt1000, 0.012);
});

test('resolveModelElevationBounds prefers explicit metadata, detects real-world meter DEMs, and defaults scene-unit maps to 0-1000m', () => {
  // 1. Explicit metadata takes highest priority (e.g. Haryana 180-2000m)
  const fromMeta = resolveModelElevationBounds({
    rawSize: { x: 100, y: 4, z: 100 },
    rawMinY: 0,
    rawMaxY: 4,
    metadataRange: { min: 180, max: 2000 },
  });
  assert.deepEqual(fromMeta, {
    minElevation: 180,
    maxElevation: 2000,
    source: 'metadata',
  });

  // 2. Real-world meter-scale India DEM (ocean at 0m, Himalayas at 8848m)
  const indiaMeters = resolveModelElevationBounds({
    rawSize: { x: 3200000, y: 8848, z: 3000000 },
    rawMinY: 0,
    rawMaxY: 8848,
    metadataRange: null,
  });
  assert.deepEqual(indiaMeters, {
    minElevation: 0,
    maxElevation: 8848,
    source: 'geometry-meters',
  });

  // 3. Real-world meter-scale Haryana DEM (180m to 1467m)
  const haryanaMeters = resolveModelElevationBounds({
    rawSize: { x: 350000, y: 1287, z: 380000 },
    rawMinY: 180,
    rawMaxY: 1467,
    metadataRange: null,
  });
  assert.deepEqual(haryanaMeters, {
    minElevation: 180,
    maxElevation: 1467,
    source: 'geometry-meters',
  });

  // 4. Normalized / scene-unit uploaded 3D map (e.g. Qgis2threejs 100-unit India map with no metadata) -> 0m to 1000m
  const sceneUnitIndia = resolveModelElevationBounds({
    rawSize: { x: 100, y: 2.5, z: 110 },
    rawMinY: 0,
    rawMaxY: 2.5,
    metadataRange: null,
  });
  assert.deepEqual(sceneUnitIndia, {
    minElevation: 0,
    maxElevation: 1000,
    source: 'default',
  });
});

test('parseQgisColorMapText parses QGIS Color Map format and redistributes colors across custom [180, 220] range', () => {
  assert.equal(DEFAULT_ELEVATION_COLOR_CONFIG.enabled, false);

  const parsed = parseQgisColorMapText(DEFAULT_QGIS_COLOR_MAP_TEXT);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.interpolation, 'INTERPOLATED');
  assert.equal(parsed.stops.length, 8);
  assert.equal(parsed.stops[0].elevation, 170);
  assert.equal(parsed.stops[7].elevation, 2000);

  // Redistribute all 8 colors into [180, 220] meters
  const customRangeConfig = {
    ...DEFAULT_ELEVATION_COLOR_CONFIG,
    enabled: true,
    minElevation: 180,
    maxElevation: 220,
    distributionMode: 'even' as const,
  };

  const redistributed = getRedistributedColorStops(customRangeConfig);
  assert.equal(redistributed.length, 8);
  assert.equal(redistributed[0].mappedElevation, 180);
  assert.equal(redistributed[7].mappedElevation, 220);

  // Verify distinct colors across 180m, 195m, 210m, 220m
  const c180 = evaluateCustomElevationColorRgb(180, customRangeConfig);
  const c195 = evaluateCustomElevationColorRgb(195, customRangeConfig);
  const c210 = evaluateCustomElevationColorRgb(210, customRangeConfig);
  const c220 = evaluateCustomElevationColorRgb(220, customRangeConfig);

  assert.deepEqual(c180, [0, 0, 0]);
  assert.notDeepEqual(c180, c195);
  assert.notDeepEqual(c195, c210);
  assert.deepEqual(c220, [1, 1, 1]);

  const validRange = validateElevationColorRange('180', '220', 180, 1467);
  assert.equal(validRange.valid, true);
  assert.equal(validRange.min, 180);
  assert.equal(validRange.max, 220);

  // Equal Min === Max is allowed (Min <= Max)
  const equalRange = validateElevationColorRange('220', '220', 180, 1467);
  assert.equal(equalRange.valid, true);

  // User sets Maximum input box to 200 -> slider domainMax and maxElevation reset to 200
  const setMax200 = applyElevationColorDomain(
    { minElevation: 180, maxElevation: 1467, domainMin: 180, domainMax: 1467 },
    180,
    200,
    'max'
  );
  assert.deepEqual(setMax200, {
    minElevation: 180,
    maxElevation: 200,
    domainMin: 180,
    domainMax: 200,
  });

  // User slides the Maximum slider down (left) to 190 -> maxElevation becomes 190, while domainMax stays 200 (input box does not change)
  const slideDownTo190 = clampElevationColorRange(
    setMax200.minElevation,
    190,
    setMax200.domainMin,
    setMax200.domainMax
  );
  assert.deepEqual(slideDownTo190, {
    minElevation: 180,
    maxElevation: 190,
    domainMin: 180,
    domainMax: 200,
  });

  // User slides the Maximum slider back right toward max (e.g. 198) -> maxElevation increases to 198 and colors update back
  const slideRightTo198 = clampElevationColorRange(
    slideDownTo190.minElevation,
    198,
    slideDownTo190.domainMin,
    slideDownTo190.domainMax
  );
  assert.deepEqual(slideRightTo198, {
    minElevation: 180,
    maxElevation: 198,
    domainMin: 180,
    domainMax: 200,
  });

  // Verify colors at 195m actually change when sliding down to 190m vs sliding right back to 198m
  const colorAt195WhenMax190 = evaluateCustomElevationColorRgb(195, {
    ...customRangeConfig,
    minElevation: slideDownTo190.minElevation,
    maxElevation: slideDownTo190.maxElevation,
  });
  const colorAt195WhenMax198 = evaluateCustomElevationColorRgb(195, {
    ...customRangeConfig,
    minElevation: slideRightTo198.minElevation,
    maxElevation: slideRightTo198.maxElevation,
  });
  assert.notDeepEqual(colorAt195WhenMax190, colorAt195WhenMax198);

  // User then enters a higher Maximum in the input box (e.g. 500) -> accepted without error and resets slider domainMax to 500
  const increaseAbove200 = validateElevationColorRange('180', '500', setMax200.domainMin, setMax200.domainMax);
  assert.equal(increaseAbove200.valid, true);
  assert.equal(increaseAbove200.error, null);
  const resetTo500 = applyElevationColorDomain(slideRightTo198, 180, 500, 'max');
  assert.deepEqual(resetTo500, {
    minElevation: 180,
    maxElevation: 500,
    domainMin: 180,
    domainMax: 500,
  });

  // User sets a new Minimum in the input box (either higher like 220 or lower like 150) -> accepted without error and resets slider domainMin
  const setMin150 = validateElevationColorRange('150', '500', resetTo500.domainMin, resetTo500.domainMax);
  assert.equal(setMin150.valid, true);
  const domainMin150 = applyElevationColorDomain(resetTo500, 150, 500, 'min');
  assert.deepEqual(domainMin150, {
    minElevation: 150,
    maxElevation: 500,
    domainMin: 150,
    domainMax: 500,
  });
});
