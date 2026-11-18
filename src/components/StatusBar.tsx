import React from 'react';

export interface StatusBarProps {
  fileName: string;
  loadingStatus: 'Ready' | 'Loading' | 'Error';
}

export const StatusBar: React.FC<StatusBarProps> = ({
  fileName,
  loadingStatus,
}) => {
  return (
    <footer
      aria-label="Viewer Status Bar"
      className="flex items-center justify-between gap-4 px-5 py-1.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 shrink-0"
    >
      <span>
        File:{' '}
        <strong
          data-testid="status-filename"
          className="font-mono-tabular font-medium text-slate-200"
        >
          {fileName}
        </strong>
      </span>

      <span>
        Status:{' '}
        <strong
          data-testid="status-loading"
          className={`font-medium ${
            loadingStatus === 'Error'
              ? 'text-rose-400'
              : loadingStatus === 'Loading'
              ? 'text-amber-300'
              : 'text-emerald-400'
          }`}
        >
          {loadingStatus}
        </strong>
      </span>
    </footer>
  );
};
