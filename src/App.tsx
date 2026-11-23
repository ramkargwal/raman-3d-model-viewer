import { useCallback, useEffect, useState } from 'react';
import { TopToolbar } from './components/TopToolbar';
import { Viewport3D } from './components/Viewport3D';
import { ControlPanel } from './components/ControlPanel';
import { StatusBar } from './components/StatusBar';
import {
  ColorDistributionMode,
  ColorMapInterpolationMode,
  DEFAULT_ELEVATION_COLOR_CONFIG,
  DEFAULT_QGIS_COLOR_MAP_ASSET_PATH,
  DEFAULT_QGIS_COLOR_MAP_FILE_NAME,
  DEFAULT_WATER_LEVEL_CONFIG,
  DEFAULT_Z_SCALE_CONFIG,
  ElevationColorConfig,
  MapClickPointInfo,
  WaterLevelConfig,
  ZScaleConfig,
  applyCustomWaterLevel,
  applyCustomZScale,
  applyElevationColorDomain,
  clampElevationColorRange,
  clampZScale,
  parseQgisColorMapText,
  validateModelFileName,
} from './utils/viewerLogic';
import { DEFAULT_MODEL_FILE_NAME } from './utils/proceduralModels';

export default function App() {
  const [zScaleConfig, setZScaleConfig] = useState<ZScaleConfig>({
    ...DEFAULT_Z_SCALE_CONFIG,
  });

  const [waterConfig, setWaterConfig] = useState<WaterLevelConfig>({
    ...DEFAULT_WATER_LEVEL_CONFIG,
  });

  const [colorConfig, setColorConfig] = useState<ElevationColorConfig>({
    ...DEFAULT_ELEVATION_COLOR_CONFIG,
  });

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string>(DEFAULT_MODEL_FILE_NAME);
  const [loadingStatus, setLoadingStatus] = useState<'Ready' | 'Loading' | 'Error'>('Ready');
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [clickedPoint, setClickedPoint] = useState<MapClickPointInfo | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<MapClickPointInfo | null>(null);

  const [resetCameraTrigger, setResetCameraTrigger] = useState<number>(0);
  const [resetModelTrigger, setResetModelTrigger] = useState<number>(0);
  const [captureTrigger, setCaptureTrigger] = useState<number>(0);

  // Load attached QGIS color map file from public/assets/aistudio/haryana_color_48a943d1.txt
  useEffect(() => {
    let active = true;
    fetch(DEFAULT_QGIS_COLOR_MAP_ASSET_PATH)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('Not found'))))
      .then((text) => {
        if (!active) return;
        const parsed = parseQgisColorMapText(text);
        if (parsed.valid) {
          setColorConfig((prev) => ({
            ...prev,
            stops: parsed.stops,
            interpolation: parsed.interpolation,
          }));
        }
      })
      .catch(() => {
        // Fallback already populated in DEFAULT_ELEVATION_COLOR_CONFIG
      });
    return () => {
      active = false;
    };
  }, []);

  const handleZScaleChange = useCallback((newScale: number) => {
    setZScaleConfig((prev) => ({
      ...prev,
      scale: clampZScale(newScale, prev.min, prev.max),
    }));
  }, []);

  const handleCustomZScaleInput = useCallback((rawCustomScale: string | number) => {
    setZScaleConfig((prev) => {
      const res = applyCustomZScale(prev, rawCustomScale);
      return res.valid ? res.config : prev;
    });
  }, []);

  const handleZRangeChange = useCallback((newMin: number, newMax: number) => {
    setZScaleConfig((prev) => ({
      ...prev,
      min: newMin,
      max: newMax,
      scale: clampZScale(prev.scale, newMin, newMax),
    }));
  }, []);

  const handleResetZScale = useCallback(() => {
    setZScaleConfig((prev) => ({
      ...prev,
      min: Math.min(prev.min, DEFAULT_Z_SCALE_CONFIG.scale),
      max: Math.max(prev.max, DEFAULT_Z_SCALE_CONFIG.scale),
      scale: DEFAULT_Z_SCALE_CONFIG.scale,
    }));
  }, []);

  // Water Level handlers
  const handleToggleWater = useCallback((enabled: boolean) => {
    setWaterConfig((prev) => ({ ...prev, enabled }));
  }, []);

  const handleWaterLevelChange = useCallback((meters: number) => {
    setWaterConfig((prev) => ({
      ...prev,
      level: clampZScale(meters, prev.min, prev.max),
    }));
  }, []);

  const handleCustomWaterLevelInput = useCallback((rawLevel: string | number) => {
    setWaterConfig((prev) => {
      const res = applyCustomWaterLevel(prev, rawLevel);
      return res.valid ? res.config : prev;
    });
  }, []);

  const handleWaterRangeChange = useCallback((newMin: number, newMax: number) => {
    setWaterConfig((prev) => ({
      ...prev,
      min: newMin,
      max: newMax,
      level: clampZScale(prev.level, newMin, newMax),
    }));
  }, []);

  const handleWaterStepChange = useCallback((newStep: number) => {
    setWaterConfig((prev) => ({
      ...prev,
      step: newStep,
    }));
  }, []);

  // Custom Elevation Color handlers
  const handleToggleCustomColor = useCallback((enabled: boolean) => {
    setColorConfig((prev) => ({ ...prev, enabled }));
  }, []);

  const handleColorRangeChange = useCallback((newMin: number, newMax: number) => {
    setColorConfig((prev) => {
      const clamped = clampElevationColorRange(
        newMin,
        newMax,
        prev.domainMin,
        prev.domainMax
      );
      return {
        ...prev,
        minElevation: clamped.minElevation,
        maxElevation: clamped.maxElevation,
      };
    });
  }, []);

  const handleColorDomainChange = useCallback(
    (
      newDomainMin: number,
      newDomainMax: number,
      changedBound: 'min' | 'max' | 'both' = 'both'
    ) => {
      setColorConfig((prev) => {
        const updated = applyElevationColorDomain(
          prev,
          newDomainMin,
          newDomainMax,
          changedBound
        );
        return {
          ...prev,
          minElevation: updated.minElevation,
          maxElevation: updated.maxElevation,
          domainMin: updated.domainMin,
          domainMax: updated.domainMax,
        };
      });
    },
    []
  );

  const handleModelElevationBoundsChange = useCallback(
    (modelMin: number, modelMax: number) => {
      setColorConfig((prev) => ({
        ...prev,
        modelMinElevation: modelMin,
        modelMaxElevation: modelMax,
        domainMin: modelMin,
        domainMax: modelMax,
        minElevation: modelMin,
        maxElevation: modelMax,
      }));

      setWaterConfig((prev) => {
        const span = Math.max(1, modelMax - modelMin);
        const isDefaultHaryana =
          modelMin === DEFAULT_WATER_LEVEL_CONFIG.min &&
          modelMax === DEFAULT_WATER_LEVEL_CONFIG.max;
        const nextStep = isDefaultHaryana
          ? DEFAULT_WATER_LEVEL_CONFIG.step
          : span <= 50
            ? 1
            : span <= 2500
              ? 5
              : 10;
        const nextLevel = isDefaultHaryana
          ? DEFAULT_WATER_LEVEL_CONFIG.level
          : Math.round(modelMin + span * 0.1);
        return {
          ...prev,
          min: modelMin,
          max: modelMax,
          level: nextLevel,
          step: nextStep,
        };
      });
    },
    []
  );

  const handleColorDistributionModeChange = useCallback(
    (mode: ColorDistributionMode) => {
      setColorConfig((prev) => ({
        ...prev,
        distributionMode: mode,
      }));
    },
    []
  );

  const handleColorInterpolationChange = useCallback(
    (mode: ColorMapInterpolationMode) => {
      setColorConfig((prev) => ({
        ...prev,
        interpolation: mode,
      }));
    },
    []
  );

  const handleUploadColorMapFile = useCallback((file: File) => {
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseQgisColorMapText(text);
      if (!parsed.valid) {
        setErrorMessage(
          parsed.error ||
            'Failed to parse QGIS Color Map file. Ensure it contains valid elevation,R,G,B lines.'
        );
        return;
      }
      setColorConfig((prev) => {
        const origMin = prev.modelMinElevation ?? DEFAULT_ELEVATION_COLOR_CONFIG.domainMin;
        const origMax = prev.modelMaxElevation ?? DEFAULT_ELEVATION_COLOR_CONFIG.domainMax;
        return {
          ...prev,
          enabled: true,
          stops: parsed.stops,
          interpolation: parsed.interpolation,
          domainMin: origMin,
          domainMax: origMax,
          minElevation: origMin,
          maxElevation: origMax,
          fileName: file.name || DEFAULT_QGIS_COLOR_MAP_FILE_NAME,
        };
      });
    };
    reader.onerror = () => {
      setErrorMessage(`Unable to read color map file "${file.name}".`);
    };
    reader.readAsText(file);
  }, []);

  const handleResetColorConfig = useCallback(() => {
    setColorConfig((prev) => {
      const origMin = prev.modelMinElevation ?? DEFAULT_ELEVATION_COLOR_CONFIG.domainMin;
      const origMax = prev.modelMaxElevation ?? DEFAULT_ELEVATION_COLOR_CONFIG.domainMax;
      return {
        ...prev,
        domainMin: origMin,
        domainMax: origMax,
        minElevation: origMin,
        maxElevation: origMax,
      };
    });
  }, []);

  const handleUploadFile = useCallback((file: File) => {
    setErrorMessage(null);
    const check = validateModelFileName(file.name);
    if (!check.valid) {
      setLoadingStatus('Error');
      setLoadingProgress(null);
      setErrorMessage(
        check.error || 'Unsupported file format. Please choose a .glb or .gltf file.'
      );
      return;
    }
    setClickedPoint(null);
    setHoveredPoint(null);
    setUploadedFile(file);
  }, []);

  const handleCaptureScreenshot = useCallback(() => {
    setCaptureTrigger((prev) => prev + 1);
  }, []);

  const handleResetCamera = useCallback(() => {
    setResetCameraTrigger((prev) => prev + 1);
  }, []);

  const handleResetModel = useCallback(() => {
    setErrorMessage(null);
    setClickedPoint(null);
    setHoveredPoint(null);
    setWaterConfig({ ...DEFAULT_WATER_LEVEL_CONFIG });
    setZScaleConfig({ ...DEFAULT_Z_SCALE_CONFIG });
    setColorConfig({ ...DEFAULT_ELEVATION_COLOR_CONFIG });
    setUploadedFile(null);
    setResetModelTrigger((prev) => prev + 1);
    setResetCameraTrigger((prev) => prev + 1);
  }, []);

  const handleLoadStart = useCallback((fileName: string) => {
    setLoadingStatus('Loading');
    setLoadingProgress(15);
    setLoadedFileName(fileName);
  }, []);

  const handleLoadProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  const handleLoadSuccess = useCallback((fileName: string) => {
    setLoadedFileName(fileName);
    setLoadingStatus('Ready');
    setLoadingProgress(null);
  }, []);

  const handleLoadError = useCallback((errMsg: string) => {
    setLoadingStatus('Error');
    setLoadingProgress(null);
    setErrorMessage(errMsg);
  }, []);

  const handleDismissError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const handleClearClickedPoint = useCallback(() => {
    setClickedPoint(null);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <TopToolbar
        onUploadFile={handleUploadFile}
        onCaptureScreenshot={handleCaptureScreenshot}
        onResetCamera={handleResetCamera}
        onResetModel={handleResetModel}
      />

      <main className="relative flex-1 min-h-0 overflow-hidden">
        <Viewport3D
          zScale={zScaleConfig.scale}
          waterConfig={waterConfig}
          colorConfig={colorConfig}
          uploadedFile={uploadedFile}
          resetCameraTrigger={resetCameraTrigger}
          resetModelTrigger={resetModelTrigger}
          captureTrigger={captureTrigger}
          loadedFileName={loadedFileName}
          clickedPoint={clickedPoint}
          onSelectMapPoint={setClickedPoint}
          onHoverMapPoint={setHoveredPoint}
          onFileDrop={handleUploadFile}
          onLoadStart={handleLoadStart}
          onLoadProgress={handleLoadProgress}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          onModelElevationBoundsChange={handleModelElevationBoundsChange}
          loadingProgress={loadingProgress}
          errorMessage={errorMessage}
          onDismissError={handleDismissError}
        />

        <ControlPanel
          zScaleConfig={zScaleConfig}
          waterConfig={waterConfig}
          colorConfig={colorConfig}
          clickedPoint={clickedPoint}
          hoveredPoint={hoveredPoint}
          onZScaleChange={handleZScaleChange}
          onCustomZScaleInput={handleCustomZScaleInput}
          onZRangeChange={handleZRangeChange}
          onResetZScale={handleResetZScale}
          onToggleWater={handleToggleWater}
          onWaterLevelChange={handleWaterLevelChange}
          onCustomWaterLevelInput={handleCustomWaterLevelInput}
          onWaterRangeChange={handleWaterRangeChange}
          onWaterStepChange={handleWaterStepChange}
          onToggleCustomColor={handleToggleCustomColor}
          onColorRangeChange={handleColorRangeChange}
          onColorDomainChange={handleColorDomainChange}
          onColorDistributionModeChange={handleColorDistributionModeChange}
          onColorInterpolationChange={handleColorInterpolationChange}
          onUploadColorMapFile={handleUploadColorMapFile}
          onResetColorConfig={handleResetColorConfig}
          onClearClickedPoint={handleClearClickedPoint}
        />
      </main>

      <StatusBar
        fileName={loadedFileName}
        loadingStatus={loadingStatus}
      />
    </div>
  );
}
