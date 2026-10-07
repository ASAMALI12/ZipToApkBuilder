import React, { useState } from 'react';
import { ProjectFile } from '../../types/kernel';
import {
  Play,
  RotateCcw,
  Code2,
  Eye,
  Sparkles,
  Download,
  Copy,
  Check,
  Cpu,
  Layers,
  MonitorPlay,
} from 'lucide-react';

interface AppBuilderWorkspaceProps {
  files: ProjectFile[];
  onUpdateFile: (updatedFile: ProjectFile) => void;
  onVoiceCommandSubmit?: (cmd: string) => void;
}

export const AppBuilderWorkspace: React.FC<AppBuilderWorkspaceProps> = ({
  files,
  onUpdateFile,
  onVoiceCommandSubmit,
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'split' | 'code' | 'preview'>('split');
  const [copied, setCopied] = useState<boolean>(false);
  const [voiceInput, setVoiceInput] = useState<string>('');
  const [previewKey, setPreviewKey] = useState<number>(1);

  // App sandbox dynamic state
  const [demoMetric, setDemoMetric] = useState<number>(142);
  const [sandboxLogs, setSandboxLogs] = useState<string[]>([
    '[INIT] Virtual DOM Mounted.',
    '[VAD] Barge-In threshold synced at 150ms.',
    '[STATUS] Component lifecycle healthy.',
  ]);

  const currentFile = files[selectedFileIndex] || files[0];

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentFile) return;
    onUpdateFile({
      ...currentFile,
      content: e.target.value,
    });
  };

  const handleCopyCode = () => {
    if (currentFile) {
      navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleQuickPreset = (presetName: string) => {
    if (onVoiceCommandSubmit) {
      onVoiceCommandSubmit(`Modify app to add: ${presetName}`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Workspace Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>App Builder Canvas</span>
          </div>

          {/* File Tabs */}
          <div className="flex items-center gap-1 ml-2 overflow-x-auto">
            {files.map((file, idx) => (
              <button
                key={file.path}
                onClick={() => setSelectedFileIndex(idx)}
                className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                  selectedFileIndex === idx
                    ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>

        {/* View Layout Controls & Voice Prompt */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'code' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 inline mr-1" />
              Code
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'split' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'preview' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5 inline mr-1" />
              Preview
            </button>
          </div>

          <button
            onClick={() => setPreviewKey((k) => k + 1)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Reload Preview"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyCode}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Voice Prompt Action Drawer */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border-b border-slate-800/80">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
          type="text"
          value={voiceInput}
          onChange={(e) => setVoiceInput(e.target.value)}
          placeholder="Voice command or edit instruction (e.g. 'أضف زر التصدير ومؤشر الطاقة', 'Make background dark gradient')"
          className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 font-arabic"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && voiceInput.trim()) {
              if (onVoiceCommandSubmit) onVoiceCommandSubmit(voiceInput.trim());
              setVoiceInput('');
            }
          }}
        />
        <div className="flex items-center gap-1 shrink-0">
          {['Dark Theme', 'Analytics Badge', 'Energy Slider'].map((preset) => (
            <button
              key={preset}
              onClick={() => handleQuickPreset(preset)}
              className="px-2 py-1 bg-slate-800/80 hover:bg-cyan-950/40 text-[11px] text-slate-300 hover:text-cyan-300 rounded border border-slate-700/80 transition-colors cursor-pointer"
            >
              + {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Body: Split View / Code / Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* Code Editor Panel */}
        {(activeTab === 'split' || activeTab === 'code') && (
          <div
            className={`flex flex-col border-r border-slate-800 ${
              activeTab === 'split' ? 'w-1/2' : 'w-full'
            }`}
          >
            <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{currentFile?.path || 'Untitled'}</span>
              <span>TypeScript React</span>
            </div>
            <textarea
              value={currentFile?.content || ''}
              onChange={handleCodeChange}
              spellCheck={false}
              className="flex-1 w-full p-4 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-0 selection:bg-cyan-500/30 overflow-auto"
            />
          </div>
        )}

        {/* Live Interactive Sandbox Preview */}
        {(activeTab === 'split' || activeTab === 'preview') && (
          <div
            key={previewKey}
            className={`flex flex-col bg-slate-900/40 overflow-auto ${
              activeTab === 'split' ? 'w-1/2' : 'w-full'
            }`}
          >
            <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <MonitorPlay className="w-3.5 h-3.5 text-emerald-400" />
                Live Execution Runtime
              </span>
              <span className="text-emerald-400 font-bold">● Running</span>
            </div>

            {/* Simulated Live Rendered Component Sandbox */}
            <div className="flex-1 p-6 flex flex-col items-center justify-start gap-6">
              <div className="w-full max-w-xl bg-slate-950 rounded-2xl border border-cyan-500/30 p-6 shadow-2xl shadow-cyan-950/20">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Quantum Subsystem Hub</h2>
                      <p className="text-xs text-slate-400 font-mono">Kernel v3.4 Dynamic Sandbox</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs rounded-full font-mono">
                    Core: {demoMetric} TFLOPS
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">VAD Barge-In</span>
                    <p className="text-lg font-bold text-cyan-400 font-mono mt-0.5">38ms</p>
                    <span className="text-[9px] text-emerald-400 uppercase font-mono">● Sub-150ms</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">Anti-Pop Ramp</span>
                    <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">30ms</p>
                    <span className="text-[9px] text-purple-400 uppercase font-mono">● Exp Ramping</span>
                  </div>
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">NLU Confidence</span>
                    <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">99.8%</p>
                    <span className="text-[9px] text-emerald-400 uppercase font-mono">● Dialect Ready</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setDemoMetric((m) => m + 25);
                      setSandboxLogs((prev) => [
                        `[USER_ACTION] Accelerated quantum cycles (+25). TFLOPS: ${demoMetric + 25}`,
                        ...prev.slice(0, 4),
                      ]);
                    }}
                    className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Overclock Subsystem
                  </button>

                  <button
                    onClick={() => setDemoMetric(142)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Execution Console Terminal */}
              <div className="w-full max-w-xl bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[10px] mb-2 border-b border-slate-800/80 pb-1">
                  <span>SANDBOX LOGS</span>
                  <span>Interactive Runtime</span>
                </div>
                <div className="space-y-1">
                  {sandboxLogs.map((log, i) => (
                    <div key={i} className="text-cyan-400/90 text-[11px]">
                      &gt; {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
