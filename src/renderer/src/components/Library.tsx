import React, { useState } from 'react';
import { Folder, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LocalFolder } from '../types/electron';

export const Library: React.FC = () => {
  const [scanPath, setScanPath] = useState('');
  const [localFolders, setLocalFolders] = useState<LocalFolder[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const startScan = async () => {
    if (!scanPath) return;
    setIsScanning(true);
    try {
      const results = await window.api.scanLocalLibrary([scanPath]);
      setLocalFolders(results);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      <header className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Folder size={22} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Enter root path to scan (e.g. D:\Galgames)" 
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            className="flex-1 p-3.5 rounded-2xl border border-slate-200 bg-white text-slate-800 font-bold focus:ring-4 focus:ring-primary/10 border-none shadow-inner outline-none transition-all placeholder:text-slate-400"
          />
          <button 
            className="px-8 py-3.5 bg-primary text-on-primary border-none rounded-2xl cursor-pointer font-black transition-all hover:bg-primary/95 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20" 
            onClick={startScan}
            disabled={isScanning || !scanPath}
          >
            {isScanning ? 'Scanning...' : 'Scan Local Library'}
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {localFolders.length === 0 && !isScanning && (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-4 opacity-70">
            <Database size={64} strokeWidth={1.5} />
            <p className="font-bold text-lg">No local games found yet. Enter a path and click Scan.</p>
          </div>
        )}

        {localFolders.map((folder, idx) => (
          <div key={idx} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-2xl transition-all hover:border-primary/30 hover:shadow-md hover:translate-x-1 group shadow-xs">
            <div className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
              <Folder size={24} />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="font-black text-slate-900 text-base">{folder.folderName}</span>
              <span className="text-xs font-bold text-slate-400 truncate max-w-[400px]">{folder.path}</span>
            </div>
            <div className="flex items-center">
              {folder.tg_id ? (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-full text-xs font-black shadow-xs">
                  <CheckCircle2 size={14} />
                  <span>Linked: {folder.tg_id}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-xs font-black shadow-xs">
                  <AlertCircle size={14} />
                  <span>Missing ID</span>
                </div>
              )}
            </div>
            <button className="ml-4 px-5 py-2 bg-white border-2 border-slate-100 rounded-xl cursor-pointer font-bold text-sm text-slate-600 transition-all hover:border-primary hover:text-primary active:scale-95">Manage</button>
          </div>
        ))}
      </div>
    </div>
  );
};
