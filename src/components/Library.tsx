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
    <div className="library-container">
      <header className="library-header">
        <div className="scan-input-group">
          <Folder size={20} />
          <input 
            type="text" 
            placeholder="Enter root path to scan (e.g. D:\Galgames)" 
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
          />
          <button 
            className="primary-btn" 
            onClick={startScan}
            disabled={isScanning || !scanPath}
          >
            {isScanning ? 'Scanning...' : 'Scan Local Library'}
          </button>
        </div>
      </header>

      <div className="folders-list">
        {localFolders.length === 0 && !isScanning && (
          <div className="empty-state">
            <Database size={48} />
            <p>No local games found yet. Enter a path and click Scan.</p>
          </div>
        )}

        {localFolders.map((folder, idx) => (
          <div key={idx} className="folder-item">
            <div className="folder-icon">
              <Folder size={24} />
            </div>
            <div className="folder-info">
              <span className="folder-name">{folder.folderName}</span>
              <span className="folder-path">{folder.path}</span>
            </div>
            <div className="folder-status">
              {folder.tg_id ? (
                <div className="status-badge linked">
                  <CheckCircle2 size={14} />
                  <span>Linked: {folder.tg_id}</span>
                </div>
              ) : (
                <div className="status-badge unlinked">
                  <AlertCircle size={14} />
                  <span>Missing ID</span>
                </div>
              )}
            </div>
            <button className="secondary-btn">Manage</button>
          </div>
        ))}
      </div>

      <style>{`
        .library-container { display: flex; flex-direction: column; gap: 24px; padding: 8px; }
        .library-header { background-color: var(--md-sys-color-surface-variant); padding: 24px; border-radius: var(--radius-lg); }
        .scan-input-group { display: flex; align-items: center; gap: 16px; }
        .scan-input-group input { flex: 1; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--md-sys-color-outline); background: var(--md-sys-color-surface); font-family: var(--font-body); }
        .primary-btn { padding: 12px 24px; background-color: var(--md-sys-color-primary); color: white; border: none; border-radius: var(--radius-xl); cursor: pointer; font-weight: 600; }
        .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .folders-list { display: flex; flex-direction: column; gap: 12px; }
        .folder-item { display: flex; align-items: center; gap: 16px; padding: 16px; background-color: var(--md-sys-color-surface); border: 1px solid var(--md-sys-color-surface-variant); border-radius: var(--radius-md); transition: all 0.2s ease; }
        .folder-item:hover { background-color: var(--md-sys-color-secondary-container); transform: translateX(4px); }
        .folder-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .folder-name { font-weight: 600; font-size: 15px; }
        .folder-path { font-size: 12px; color: var(--md-sys-color-on-surface-variant); }
        .status-badge { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--radius-xl); font-size: 12px; font-weight: 500; }
        .status-badge.linked { background-color: #dcfce7; color: #166534; }
        .status-badge.unlinked { background-color: #fee2e2; color: #b91c1c; }
        .secondary-btn { padding: 6px 12px; background: transparent; border: 1px solid var(--md-sys-color-outline); border-radius: var(--radius-md); cursor: pointer; font-size: 13px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px; color: var(--md-sys-color-on-surface-variant); gap: 16px; opacity: 0.6; }
      `}</style>
    </div>
  );
};
