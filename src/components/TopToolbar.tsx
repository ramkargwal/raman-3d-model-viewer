import React, { useRef } from 'react';
import { FolderOpen, RotateCcw, RefreshCw, Camera, Box } from 'lucide-react';

export interface TopToolbarProps {
  onUploadFile: (file: File) => void;
  onCaptureScreenshot: () => void;
  onResetCamera: () => void;
  onResetModel: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = React.memo(({
  onUploadFile,
  onCaptureScreenshot,
  onResetCamera,
  onResetModel,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <Box className="w-5 h-5 text-sky-400 shrink-0" />
        <h1 className="text-sm font-bold tracking-tight text-slate-100 whitespace-nowrap">
          3D Model Viewer
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          onChange={handleFileChange}
          aria-label="Upload 3D Model File"
          data-testid="file-upload-input"
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-3 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <FolderOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Open 3D Model</span>
        </button>

        <button
          type="button"
          onClick={onCaptureScreenshot}
          data-testid="capture-screenshot-btn"
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium px-3 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>Capture PNG</span>
        </button>

        <button
          type="button"
          onClick={onResetCamera}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium px-3 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span>Reset Camera</span>
        </button>

        <button
          type="button"
          onClick={onResetModel}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium px-3 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span>Reset Model</span>
        </button>
      </div>
    </header>
  );
});
