import React from 'react';
import { WorkspaceType } from '../../types/kernel';
import {
  Terminal,
  Cpu,
  Layers,
  Database,
  Github,
  Radio,
  HelpCircle,
  Settings,
  Sparkles,
  Maximize2,
  FolderGit2,
} from 'lucide-react';

interface KernelHeaderProps {
  activeWorkspace: WorkspaceType;
  onNavigate: (ws: WorkspaceType) => void;
  onOpenIntegrations: () => void;
  onOpenDialectGuide: () => void;
  isCallActive: boolean;
  bargeInLatencyMs: number;
}

export const KernelHeader: React.FC<KernelHeaderProps> = ({
  activeWorkspace,
  onNavigate,
  onOpenIntegrations,
  onOpenDialectGuide,
  isCallActive,
  bargeInLatencyMs,
}) => {
  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between z-40 select-none">
      {/* Left: Brand & Kernel Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Terminal className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-mono font-bold tracking-wider text-white flex items-center gap-1.5">
              THE KERNEL
              <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950 text-cyan-400 border border-cyan-500/30 rounded font-normal">
                v3.4.0
              </span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Autonomous AI Shell</span>
          </div>
        </button>

        {/* DSP & Audio Pipeline Indicators */}
        <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/60 rounded border border-slate-800/60 text-[10px] font-mono text-slate-400">
            <Radio className={`w-3 h-3 ${isCallActive ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <span>AEC/NS/AGC</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/60 rounded border border-slate-800/60 text-[10px] font-mono text-slate-400">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span>Barge-in:</span>
            <span className="text-cyan-400 font-bold">{bargeInLatencyMs}ms</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-900/60 rounded border border-slate-800/60 text-[10px] font-mono text-slate-400">
            <span className="text-emerald-400">30ms</span>
            <span>Anti-Pop</span>
          </div>
        </div>
      </div>

      {/* Center: Workspace Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800">
        {[
          { id: 'home', label: 'Launcher', icon: Sparkles },
          { id: 'app_builder', label: 'App Builder', icon: Layers },
          { id: 'media_generator', label: 'Media Studio', icon: Radio },
          { id: 'code_chat', label: 'Kernel Chat', icon: Terminal },
          { id: 'file_explorer', label: 'ZIP & Files', icon: FolderGit2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeWorkspace === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id as WorkspaceType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Modals and Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDialectGuide}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
          title="Dialect & Voice Commands Guide"
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline font-arabic">دليل الأوامر</span>
        </button>

        <button
          onClick={onOpenIntegrations}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
          title="GitHub & Supabase Integrations"
        >
          <Settings className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Cloud Bridges</span>
        </button>
      </div>
    </header>
  );
};
