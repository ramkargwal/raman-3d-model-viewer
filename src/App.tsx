import { useCallback, useState } from 'react';
import { TopToolbar } from './components/TopToolbar';
import { Viewport3D } from './components/Viewport3D';
import { ControlPanel } from './components/ControlPanel';
import { StatusBar } from './components/StatusBar';
import {
  DEFAULT_WATER_LEVEL_CONFIG,
  DEFAULT_Z_SCALE_CONFIG,
  MapClickPointInfo,
  WaterLevelConfig,
  ZScaleConfig,
  applyCustomWaterLevel,
  applyCustomZScale,
  clampZScale,
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
          loadingProgress={loadingProgress}
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
        />

        <ControlPanel
          zScaleConfig={zScaleConfig}
          waterConfig={waterConfig}
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
          onClearClickedPoint={() => setClickedPoint(null)}
        />
      </main>

      <StatusBar
        fileName={loadedFileName}
        loadingStatus={loadingStatus}
      />
    </div>
  );
}
