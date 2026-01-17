
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { AppState, SavedModel } from '../types';
import { Box, Code2, Play, Pause, Info, Loader2, Zap, Sparkles, Cpu, Timer, Database, Activity } from 'lucide-react';

interface UIOverlayProps {
  voxelCount: number;
  appState: AppState;
  currentBaseModel: string;
  customBuilds: SavedModel[];
  customRebuilds: SavedModel[];
  isAutoRotate: boolean;
  isInfoVisible: boolean;
  isGenerating: boolean;
  isAutopilot: boolean;
  cycleSpeed: number;
  onCycleSpeedChange: (speed: number) => void;
  onToggleAutopilot: () => void;
  onDismantle: () => void;
  onRebuild: (type: 'Eagle' | 'Cat' | 'Rabbit' | 'Twins') => void;
  onNewScene: (type: 'Eagle') => void;
  onSelectCustomBuild: (model: SavedModel) => void;
  onSelectCustomRebuild: (model: SavedModel) => void;
  onPromptCreate: () => void;
  onPromptMorph: () => void;
  onShowJson: () => void;
  onImportJson: () => void;
  onToggleRotation: () => void;
  onToggleInfo: () => void;
}

const LOADING_MESSAGES = [
    "Gemini is envisioning new forms...",
    "Drafting retro-futurism artifacts...",
    "Sculpting ancient myths...",
    "Rendering pixelated dioptamas...",
    "Simulating neon energy cores...",
    "Assembling synthwave classics...",
    "Weaving micro-oasis biomes...",
    "Forging legendary relics..."
];

const SCAN_LOGS = [
    "LOG: Initializing Latent Space Search...",
    "DATA: Quantizing high-dimensional voxels...",
    "PROC: Optimizing topology for gallery depth...",
    "AI: Dreaming neon-emissive patterns...",
    "SYS: Syncing architectural constraints...",
    "CORE: Expanding neural art buffer...",
    "REF: Pulling from mythology database...",
];

export const UIOverlay: React.FC<UIOverlayProps> = ({
  voxelCount,
  appState,
  currentBaseModel,
  isAutoRotate,
  isInfoVisible,
  isGenerating,
  isAutopilot,
  cycleSpeed,
  onCycleSpeedChange,
  onShowJson,
  onToggleRotation,
  onToggleInfo
}) => {
  const isStable = appState === AppState.STABLE;
  const isDismantling = appState === AppState.DISMANTLING;
  const isRebuilding = appState === AppState.REBUILDING;
  
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    if (isGenerating) {
        const interval = setInterval(() => {
            setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
            setLogIndex((prev) => (prev + 1) % SCAN_LOGS.length);
        }, 1200);
        return () => clearInterval(interval);
    }
  }, [isGenerating]);

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none select-none">
      
      {/* --- Top Bar --- */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="pointer-events-auto flex flex-col gap-2">
            <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/80 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700">
                <div className="bg-sky-500 p-2 rounded-xl animate-pulse">
                    <Cpu size={20} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">Autonomous Mode</span>
                    <span className="text-sm font-extrabold truncate max-w-[140px] text-sky-100">{currentBaseModel}</span>
                </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/60 backdrop-blur-sm shadow-sm rounded-xl border border-slate-700 text-slate-400 font-bold w-fit">
                <div className="bg-sky-900/50 p-1.5 rounded-lg text-sky-400">
                    <Box size={16} strokeWidth={3} />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase tracking-wider opacity-60">Blocks</span>
                    <span className="text-lg text-slate-100 font-extrabold font-mono">{voxelCount}</span>
                </div>
            </div>

            <div className="flex flex-col gap-1 px-4 py-3 bg-slate-800/80 backdrop-blur-md shadow-sm rounded-xl border border-slate-700 w-fit pointer-events-auto">
                <div className="flex items-center justify-between gap-4 mb-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Timer size={14} strokeWidth={2.5} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Display For</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-900/40 px-1.5 py-0.5 rounded">
                        {cycleSpeed}s
                    </span>
                </div>
                <input 
                    type="range"
                    min="3"
                    max="60"
                    step="1"
                    value={cycleSpeed}
                    onChange={(e) => onCycleSpeedChange(parseInt(e.target.value))}
                    className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
                />
            </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
            <TactileButton
                onClick={onToggleInfo}
                color={isInfoVisible ? 'indigo' : 'slate'}
                icon={<Info size={18} strokeWidth={2.5} />}
                label="Info"
                compact
            />
            <TactileButton
                onClick={onToggleRotation}
                color={isAutoRotate ? 'sky' : 'slate'}
                icon={isAutoRotate ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                label="Camera"
                compact
            />
            <TactileButton
                onClick={onShowJson}
                color="slate"
                icon={<Code2 size={18} strokeWidth={2.5} />}
                label="JSON"
                compact
            />
        </div>
      </div>

      {/* --- CINEMATIC GENERATION HUD --- */}
      {isGenerating && (
          <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center animate-in fade-in duration-700">
              {/* Scanline Effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-500/5 to-transparent h-20 w-full animate-scanline opacity-40 shadow-[0_0_80px_rgba(14,165,233,0.1)]" />
              
              {/* HUD Corners */}
              <div className="absolute inset-10 border-2 border-sky-500/20 rounded-[40px] pointer-events-none">
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-sky-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-sky-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-sky-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-sky-400 rounded-br-lg" />
              </div>

              {/* Central Loading Unit */}
              <div className="flex flex-col items-center gap-6 bg-slate-950/80 backdrop-blur-2xl p-12 rounded-[50px] border border-sky-500/30 shadow-[0_0_100px_rgba(14,165,233,0.2)]">
                  <div className="relative">
                      <div className="absolute inset-0 bg-sky-500/20 blur-2xl animate-pulse rounded-full" />
                      <div className="bg-sky-500/10 p-6 rounded-full border border-sky-400/50">
                          <Activity size={48} className="text-sky-400 animate-pulse" />
                      </div>
                  </div>
                  
                  <div className="text-center">
                      <h2 className="text-2xl font-black text-white uppercase tracking-[0.3em] mb-2 drop-shadow-lg">
                        AI Synchronizing
                      </h2>
                      <p className="text-sky-400 font-bold text-xs uppercase tracking-widest animate-pulse">
                        {LOADING_MESSAGES[loadingMsgIndex]}
                      </p>
                  </div>

                  {/* Micro Progress Bar */}
                  <div className="w-64 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 animate-progress" />
                  </div>
              </div>

              {/* Data Feed (Bottom Left) */}
              <div className="absolute bottom-20 left-16 flex flex-col gap-1 font-mono text-[10px] text-sky-500/60 uppercase tracking-tighter">
                  <span className="flex items-center gap-2">
                    <Database size={12} /> {SCAN_LOGS[logIndex]}
                  </span>
                  <span className="opacity-40">{SCAN_LOGS[(logIndex + 1) % SCAN_LOGS.length]}</span>
                  <span className="opacity-20">{SCAN_LOGS[(logIndex + 2) % SCAN_LOGS.length]}</span>
              </div>
          </div>
      )}

      {/* --- Phase Indicator --- */}
      {!isGenerating && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity duration-300">
             <div className="px-6 py-3 bg-slate-900/60 backdrop-blur-md rounded-full border-2 border-slate-700/50 shadow-xl flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isStable ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${isStable ? 'text-emerald-400' : 'text-slate-500'}`}>Gallery</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isDismantling ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${isDismantling ? 'text-rose-400' : 'text-slate-500'}`}>Dismantling</span>
                </div>
                <div className="w-px h-4 bg-slate-700" />
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isRebuilding ? 'bg-sky-400 animate-pulse' : 'bg-slate-700'}`} />
                    <span className={`text-xs font-black uppercase tracking-widest ${isRebuilding ? 'text-sky-400' : 'text-slate-500'}`}>Building</span>
                </div>
             </div>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Endless AI Voxel Engine</p>
          </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(1000%); }
        }
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-scanline {
          animation: scanline 4s linear infinite;
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}} />

    </div>
  );
};

interface TactileButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  color: 'slate' | 'rose' | 'sky' | 'emerald' | 'amber' | 'indigo';
  compact?: boolean;
}

const TactileButton: React.FC<TactileButtonProps> = ({ onClick, disabled, icon, label, color, compact }) => {
  const colorStyles = {
    slate:   'bg-slate-800 text-slate-400 shadow-slate-950 hover:bg-slate-700',
    rose:    'bg-rose-600 text-white shadow-rose-900 hover:bg-rose-500',
    sky:     'bg-sky-600 text-white shadow-sky-900 hover:bg-sky-500',
    emerald: 'bg-emerald-600 text-white shadow-emerald-900 hover:bg-emerald-500',
    amber:   'bg-amber-500 text-amber-950 shadow-amber-800 hover:bg-amber-400',
    indigo:  'bg-indigo-600 text-white shadow-indigo-900 hover:bg-indigo-500',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        group relative flex items-center justify-center gap-2 rounded-xl font-bold text-sm transition-all duration-100
        border-b-[4px] active:border-b-0 active:translate-y-[4px]
        ${compact ? 'p-2.5' : 'px-4 py-3'}
        ${disabled 
          ? 'bg-slate-800 text-slate-600 border-slate-900 cursor-not-allowed shadow-none opacity-50' 
          : `${colorStyles[color]} border-black/40 shadow-lg`}
      `}
    >
      {icon}
      {!compact && <span>{label}</span>}
    </button>
  );
};
