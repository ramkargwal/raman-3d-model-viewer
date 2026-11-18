import React, { useEffect, useRef, useState } from 'react';
import {
  MapClickPointInfo,
  WaterLevelConfig,
  ZScaleConfig,
  roundScale,
  validateWaterRange,
  validateWaterStep,
  validateZRange,
} from '../utils/viewerLogic';
import {
  Sliders,
  RotateCcw,
  AlertTriangle,
  MapPin,
  Droplets,
  X,
} from 'lucide-react';

export interface ControlPanelProps {
  zScaleConfig: ZScaleConfig;
  waterConfig: WaterLevelConfig;
  clickedPoint: MapClickPointInfo | null;
  hoveredPoint: MapClickPointInfo | null;
  onZScaleChange: (newScale: number) => void;
  onCustomZScaleInput: (rawCustomScale: string | number) => void;
  onZRangeChange: (newMin: number, newMax: number) => void;
  onResetZScale: () => void;
  onToggleWater: (enabled: boolean) => void;
  onWaterLevelChange: (meters: number) => void;
  onCustomWaterLevelInput: (rawLevel: string | number) => void;
  onWaterRangeChange: (newMin: number, newMax: number) => void;
  onWaterStepChange: (newStep: number) => void;
  onClearClickedPoint: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  zScaleConfig,
  waterConfig,
  clickedPoint,
  hoveredPoint,
  onZScaleChange,
  onCustomZScaleInput,
  onZRangeChange,
  onResetZScale,
  onToggleWater,
  onWaterLevelChange,
  onCustomWaterLevelInput,
  onWaterRangeChange,
  onWaterStepChange,
  onClearClickedPoint,
}) => {
  // Z-Axis Scale inputs
  const [minInput, setMinInput] = useState<string>(String(zScaleConfig.min));
  const [maxInput, setMaxInput] = useState<string>(String(zScaleConfig.max));
  const [scaleInput, setScaleInput] = useState<string>(String(zScaleConfig.scale));
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [scaleError, setScaleError] = useState<string | null>(null);

  const isScaleFocusedRef = useRef<boolean>(false);
  const isMinFocusedRef = useRef<boolean>(false);
  const isMaxFocusedRef = useRef<boolean>(false);

  // Water Level inputs
  const [waterMinInput, setWaterMinInput] = useState<string>(String(waterConfig.min));
  const [waterMaxInput, setWaterMaxInput] = useState<string>(String(waterConfig.max));
  const [waterStepInput, setWaterStepInput] = useState<string>(String(waterConfig.step));
  const [waterLevelInput, setWaterLevelInput] = useState<string>(
    String(waterConfig.level)
  );
  const [waterRangeError, setWaterRangeError] = useState<string | null>(null);
  const [waterLevelError, setWaterLevelError] = useState<string | null>(null);

  const isWaterLevelFocusedRef = useRef<boolean>(false);
  const isWaterMinFocusedRef = useRef<boolean>(false);
  const isWaterMaxFocusedRef = useRef<boolean>(false);
  const isWaterStepFocusedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isMinFocusedRef.current) {
      setMinInput(String(zScaleConfig.min));
    }
    if (!isMaxFocusedRef.current) {
      setMaxInput(String(zScaleConfig.max));
    }
    setRangeError(null);
  }, [zScaleConfig.min, zScaleConfig.max]);

  useEffect(() => {
    if (!isScaleFocusedRef.current) {
      setScaleInput(String(zScaleConfig.scale));
      setScaleError(null);
    }
  }, [zScaleConfig.scale]);

  useEffect(() => {
    if (!isWaterMinFocusedRef.current) {
      setWaterMinInput(String(waterConfig.min));
    }
    if (!isWaterMaxFocusedRef.current) {
      setWaterMaxInput(String(waterConfig.max));
    }
    setWaterRangeError(null);
  }, [waterConfig.min, waterConfig.max]);

  useEffect(() => {
    if (!isWaterStepFocusedRef.current) {
      setWaterStepInput(String(waterConfig.step));
    }
  }, [waterConfig.step]);

  useEffect(() => {
    if (!isWaterLevelFocusedRef.current) {
      setWaterLevelInput(String(waterConfig.level));
      setWaterLevelError(null);
    }
  }, [waterConfig.level]);

  const handleMinOrMaxChange = (nextMinRaw: string, nextMaxRaw: string) => {
    setMinInput(nextMinRaw);
    setMaxInput(nextMaxRaw);

    const validation = validateZRange(nextMinRaw, nextMaxRaw);
    if (!validation.valid) {
      setRangeError(validation.error);
      return;
    }

    setRangeError(null);
    onZRangeChange(validation.min, validation.max);
  };

  const handleCustomScaleChange = (raw: string) => {
    setScaleInput(raw);
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '.' || trimmed === '0.' || trimmed === '-') {
      setScaleError(null);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setScaleError('Enter a value greater than 0.');
      return;
    }

    setScaleError(null);
    onCustomZScaleInput(parsed);
  };

  const commitCustomScale = () => {
    const trimmed = scaleInput.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed) || parsed <= 0) {
      setScaleInput(String(zScaleConfig.scale));
      setScaleError(null);
      return;
    }
    const safeVal = roundScale(Math.min(parsed, 100));
    onCustomZScaleInput(safeVal);
    setScaleInput(String(safeVal));
    setScaleError(null);
  };

  // Water Level handlers
  const handleWaterMinOrMaxChange = (nextMinRaw: string, nextMaxRaw: string) => {
    setWaterMinInput(nextMinRaw);
    setWaterMaxInput(nextMaxRaw);

    const validation = validateWaterRange(nextMinRaw, nextMaxRaw);
    if (!validation.valid) {
      setWaterRangeError(validation.error);
      return;
    }

    setWaterRangeError(null);
    onWaterRangeChange(validation.min, validation.max);
  };

  const handleWaterStepInputChange = (rawStep: string) => {
    setWaterStepInput(rawStep);
    const trimmed = rawStep.trim();
    if (trimmed === '' || trimmed === '.' || trimmed === '0.') {
      setWaterRangeError(null);
      return;
    }

    const validation = validateWaterStep(trimmed);
    if (!validation.valid) {
      setWaterRangeError(validation.error);
      return;
    }

    setWaterRangeError(null);
    onWaterStepChange(validation.step);
  };

  const handleCustomWaterLevelChange = (raw: string) => {
    setWaterLevelInput(raw);
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '.' || trimmed === '-') {
      setWaterLevelError(null);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setWaterLevelError('Enter a water level 0 or greater.');
      return;
    }

    setWaterLevelError(null);
    onCustomWaterLevelInput(parsed);
  };

  const commitCustomWaterLevel = () => {
    const trimmed = waterLevelInput.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed) || parsed < 0) {
      setWaterLevelInput(String(waterConfig.level));
      setWaterLevelError(null);
      return;
    }
    const safeVal = roundScale(Math.min(parsed, 10000));
    onCustomWaterLevelInput(safeVal);
    setWaterLevelInput(String(safeVal));
    setWaterLevelError(null);
  };

  const activePoint = clickedPoint ?? hoveredPoint;

  return (
    <aside
      aria-label="Elevation Control Card"
      className="absolute top-3.5 right-3.5 z-10 w-72 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-2xl overflow-hidden"
    >
      {/* SECTION 1: Z-Axis Scale Control */}
      <section className="p-3.5 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <h2 className="text-xs font-semibold text-slate-100">
              Z-Axis Scale
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              isScaleFocusedRef.current = false;
              onResetZScale();
              setScaleInput('1');
            }}
            className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-sky-400" />
            <span>Reset</span>
          </button>
        </div>

        {/* Scale Input + Slider */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="current-z-scale-input"
              className="text-xs font-medium text-slate-300"
            >
              Scale Value
            </label>
            <input
              id="current-z-scale-input"
              type="text"
              inputMode="decimal"
              value={scaleInput}
              onFocus={() => {
                isScaleFocusedRef.current = true;
              }}
              onChange={(e) => handleCustomScaleChange(e.target.value)}
              onBlur={() => {
                isScaleFocusedRef.current = false;
                commitCustomScale();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  isScaleFocusedRef.current = false;
                  commitCustomScale();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="Current Z-Axis Scale"
              data-testid="z-scale-number-input"
              className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-right text-xs font-semibold font-mono-tabular text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {scaleError && (
            <div role="alert" className="text-[11px] text-rose-400">
              {scaleError}
            </div>
          )}

          <input
            id="z-scale-slider"
            type="range"
            min={zScaleConfig.min}
            max={zScaleConfig.max}
            step={zScaleConfig.step}
            value={zScaleConfig.scale}
            onChange={(e) => {
              isScaleFocusedRef.current = false;
              const val = roundScale(Number(e.target.value));
              onZScaleChange(val);
              setScaleInput(String(val));
            }}
            aria-label="Z-Axis Exaggeration Slider"
            data-testid="z-scale-slider"
            className="w-full studio-slider"
          />
        </div>

        {/* Editable Min & Max Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              htmlFor="min-z-scale-input"
              className="block text-[10px] font-medium text-slate-400 mb-1"
            >
              Min
            </label>
            <input
              id="min-z-scale-input"
              type="text"
              inputMode="decimal"
              value={minInput}
              onFocus={() => {
                isMinFocusedRef.current = true;
              }}
              onChange={(e) => handleMinOrMaxChange(e.target.value, maxInput)}
              onBlur={() => {
                isMinFocusedRef.current = false;
                if (rangeError) {
                  setMinInput(String(zScaleConfig.min));
                  setMaxInput(String(zScaleConfig.max));
                  setRangeError(null);
                }
              }}
              aria-label="Minimum Z-Scale Value"
              data-testid="min-z-scale-input"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label
              htmlFor="max-z-scale-input"
              className="block text-[10px] font-medium text-slate-400 mb-1"
            >
              Max
            </label>
            <input
              id="max-z-scale-input"
              type="text"
              inputMode="decimal"
              value={maxInput}
              onFocus={() => {
                isMaxFocusedRef.current = true;
              }}
              onChange={(e) => handleMinOrMaxChange(minInput, e.target.value)}
              onBlur={() => {
                isMaxFocusedRef.current = false;
                if (rangeError) {
                  setMinInput(String(zScaleConfig.min));
                  setMaxInput(String(zScaleConfig.max));
                  setRangeError(null);
                }
              }}
              aria-label="Maximum Z-Scale Value"
              data-testid="max-z-scale-input"
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        </div>

        {rangeError && (
          <div
            role="alert"
            data-testid="z-range-error"
            className="flex items-start gap-1.5 rounded-lg bg-rose-950/80 border border-rose-800 p-2 text-[11px] text-rose-200"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>{rangeError}</span>
          </div>
        )}
      </section>

      {/* SECTION 2: Collapsible Water Level / Flood Simulation Control */}
      <section className="p-3.5 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={waterConfig.enabled}
              onChange={(e) => onToggleWater(e.target.checked)}
              aria-label="Enable Water Level Simulation"
              data-testid="water-level-checkbox"
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-sky-400 cursor-pointer"
            />
            <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-100">
              Water Level
            </span>
          </label>

          {!waterConfig.enabled && (
            <span
              data-testid="water-level-display"
              className="text-xs font-mono-tabular font-medium text-slate-500"
            >
              Off
            </span>
          )}
        </div>

        {/* Only show Water Level input, slider, and Min/Max when checkbox is checked */}
        {waterConfig.enabled && (
          <div data-testid="water-level-controls" className="space-y-2.5 pt-0.5">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="current-water-level-input"
                className="text-xs font-medium text-slate-300"
              >
                Level (m)
              </label>
              <input
                id="current-water-level-input"
                type="text"
                inputMode="decimal"
                value={waterLevelInput}
                onFocus={() => {
                  isWaterLevelFocusedRef.current = true;
                }}
                onChange={(e) => handleCustomWaterLevelChange(e.target.value)}
                onBlur={() => {
                  isWaterLevelFocusedRef.current = false;
                  commitCustomWaterLevel();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    isWaterLevelFocusedRef.current = false;
                    commitCustomWaterLevel();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                aria-label="Current Water Level Value"
                data-testid="water-level-number-input"
                className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-right text-xs font-semibold font-mono-tabular text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            {waterLevelError && (
              <div role="alert" className="text-[11px] text-rose-400">
                {waterLevelError}
              </div>
            )}

            <input
              type="range"
              min={waterConfig.min}
              max={waterConfig.max}
              step={Math.min(
                waterConfig.step,
                Math.max(0.001, roundScale(waterConfig.max - waterConfig.min))
              )}
              value={waterConfig.level}
              onChange={(e) => {
                isWaterLevelFocusedRef.current = false;
                const val = roundScale(Number(e.target.value));
                onWaterLevelChange(val);
                setWaterLevelInput(String(val));
              }}
              aria-label="Water Level Slider"
              data-testid="water-level-slider"
              className="w-full studio-slider"
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label
                  htmlFor="min-water-level-input"
                  className="block text-[10px] font-medium text-slate-400 mb-1"
                >
                  Min
                </label>
                <input
                  id="min-water-level-input"
                  type="text"
                  inputMode="decimal"
                  value={waterMinInput}
                  onFocus={() => {
                    isWaterMinFocusedRef.current = true;
                  }}
                  onChange={(e) =>
                    handleWaterMinOrMaxChange(e.target.value, waterMaxInput)
                  }
                  onBlur={() => {
                    isWaterMinFocusedRef.current = false;
                    if (waterRangeError) {
                      setWaterMinInput(String(waterConfig.min));
                      setWaterMaxInput(String(waterConfig.max));
                      setWaterRangeError(null);
                    }
                  }}
                  aria-label="Minimum Water Level"
                  data-testid="min-water-input"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label
                  htmlFor="max-water-level-input"
                  className="block text-[10px] font-medium text-slate-400 mb-1"
                >
                  Max
                </label>
                <input
                  id="max-water-level-input"
                  type="text"
                  inputMode="decimal"
                  value={waterMaxInput}
                  onFocus={() => {
                    isWaterMaxFocusedRef.current = true;
                  }}
                  onChange={(e) =>
                    handleWaterMinOrMaxChange(waterMinInput, e.target.value)
                  }
                  onBlur={() => {
                    isWaterMaxFocusedRef.current = false;
                    if (waterRangeError) {
                      setWaterMinInput(String(waterConfig.min));
                      setWaterMaxInput(String(waterConfig.max));
                      setWaterRangeError(null);
                    }
                  }}
                  aria-label="Maximum Water Level"
                  data-testid="max-water-input"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label
                  htmlFor="step-water-level-input"
                  className="block text-[10px] font-medium text-slate-400 mb-1"
                >
                  Step
                </label>
                <input
                  id="step-water-level-input"
                  type="text"
                  inputMode="decimal"
                  value={waterStepInput}
                  onFocus={() => {
                    isWaterStepFocusedRef.current = true;
                  }}
                  onChange={(e) => handleWaterStepInputChange(e.target.value)}
                  onBlur={() => {
                    isWaterStepFocusedRef.current = false;
                    const check = validateWaterStep(waterStepInput);
                    if (!check.valid) {
                      setWaterStepInput(String(waterConfig.step));
                      setWaterRangeError(null);
                    } else {
                      setWaterStepInput(String(check.step));
                    }
                  }}
                  aria-label="Water Level Slider Step"
                  data-testid="step-water-input"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            </div>

            {waterRangeError && (
              <div
                role="alert"
                data-testid="water-range-error"
                className="flex items-start gap-1.5 rounded-lg bg-rose-950/80 border border-rose-800 p-2 text-[11px] text-rose-200"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{waterRangeError}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 3: Information (Live Hover + Clicked Point Lock) */}
      <section className="p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <MapPin
              className={`w-3.5 h-3.5 shrink-0 ${
                clickedPoint ? 'text-amber-400' : 'text-sky-400'
              }`}
            />
            <h2 className="text-xs font-semibold text-slate-100">
              Information
            </h2>
            {activePoint && (
              <span className="text-[10px] font-medium text-slate-400">
                ({clickedPoint ? 'Pinned' : 'Hover'})
              </span>
            )}
          </div>

          {clickedPoint && (
            <button
              type="button"
              onClick={onClearClickedPoint}
              aria-label="Clear selected map point"
              data-testid="clear-point-btn"
              className="flex items-center gap-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-2.5 h-2.5" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {activePoint ? (
          <div
            data-testid="panel-clicked-point-card"
            className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Geo Coord</span>
              <span
                data-testid="clicked-point-coordinates"
                className="font-mono-tabular font-semibold text-slate-100"
              >
                {activePoint.coordinateLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/70">
              <span className="text-[11px] text-slate-400">X, Y Coord</span>
              <span
                data-testid="clicked-point-xy"
                className="font-mono-tabular font-medium text-sky-300"
              >
                {activePoint.xyLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/70">
              <span className="text-[11px] text-slate-400">Elevation</span>
              <span
                data-testid="clicked-point-elevation-asl"
                className="font-mono-tabular font-bold text-amber-300"
              >
                {activePoint.elevationMeters.toLocaleString()} m
              </span>
            </div>
          </div>
        ) : (
          <p
            data-testid="panel-clicked-point-empty"
            className="text-[11px] text-slate-400 leading-relaxed"
          >
            Hover or click on map to view Geo Coordinate, X/Y Coordinate, and Elevation.
          </p>
        )}
      </section>
    </aside>
  );
};
