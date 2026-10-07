import React, { useState } from 'react';
import { DynamicUISchema, DynamicUIComponent } from '../../types/kernel';
import {
  Sparkles,
  Terminal,
  Code,
  Activity,
  Layers,
  Table,
  Play,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Radio,
} from 'lucide-react';

interface ZeroShotGenerativeUIProps {
  schema: DynamicUISchema;
  onRegenerateUI?: (prompt: string) => void;
  onVoiceAction?: (actionId: string) => void;
}

export const ZeroShotGenerativeUI: React.FC<ZeroShotGenerativeUIProps> = ({
  schema,
  onRegenerateUI,
  onVoiceAction,
}) => {
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [componentCodes, setComponentCodes] = useState<Record<string, string>>({});
  const [terminalOutputs, setTerminalOutputs] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handlePromptSubmit = () => {
    if (!userPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    if (onRegenerateUI) {
      onRegenerateUI(userPrompt.trim());
    }
    setTimeout(() => setIsGenerating(false), 800);
  };

  const renderComponent = (comp: DynamicUIComponent, idx: number) => {
    const key = comp.id || `comp_${idx}`;

    switch (comp.type) {
      case 'code_editor':
        return (
          <div key={key} className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-xl">
            <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-cyan-300">
              <div className="flex items-center gap-2">
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                <span>{comp.title || 'Dynamic Code Module'}</span>
              </div>
              <span className="text-[10px] text-slate-500 uppercase">{comp.language || 'csharp'}</span>
            </div>
            <textarea
              defaultValue={comp.initialCode || '// Zero-Shot Generated Architecture'}
              onChange={(e) =>
                setComponentCodes((prev) => ({ ...prev, [key]: e.target.value }))
              }
              className="flex-1 p-4 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed resize-none focus:outline-none"
              rows={12}
            />
          </div>
        );

      case 'terminal_preview':
        return (
          <div key={key} className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-xl">
            <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-purple-300">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span>{comp.title || 'Runtime Execution Terminal'}</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">● LIVE</span>
            </div>
            <div className="flex-1 p-4 font-mono text-xs text-purple-200/90 whitespace-pre-wrap leading-relaxed overflow-auto">
              {comp.defaultOutput || '[RUNTIME] Zero-Shot subsystem mounted.\n[READY] Listening for voice commands.'}
            </div>
          </div>
        );

      case 'voice_status_indicator':
        return (
          <div key={key} className="bg-slate-900/80 p-4 rounded-2xl border border-cyan-500/30 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
              <div>
                <h4 className="text-xs font-bold text-white font-mono">{comp.label || 'Voice Control Link'}</h4>
                <p className="text-[11px] text-slate-400">Zero-Shot Duplex Tunnel Active</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-full text-xs font-mono">
              {comp.status || 'ACTIVE'}
            </span>
          </div>
        );

      case 'metrics_gauge':
        return (
          <div key={key} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between shadow-lg">
            <span className="text-[11px] font-mono text-slate-400">{comp.title || 'Telemetry Metric'}</span>
            <div className="my-2">
              <span className="text-2xl font-bold font-mono text-cyan-400">{comp.value || '99.98%'}</span>
              <span className="text-xs text-slate-500 font-mono ml-1">{comp.metric || ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
              <Activity className="w-3 h-3" />
              <span>{comp.status || 'Optimal Nominal'}</span>
            </div>
          </div>
        );

      case 'key_value_stats':
        return (
          <div key={key} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-lg">
            <h4 className="text-xs font-mono text-slate-400 mb-3">System Specifications</h4>
            <div className="space-y-2">
              {comp.items?.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-slate-900 pb-1.5">
                  <span className="text-slate-400 font-mono">{item.key}</span>
                  <span className="text-white font-mono font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'data_table':
        return (
          <div key={key} className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center gap-2 text-xs font-mono text-slate-200">
              <Table className="w-3.5 h-3.5 text-cyan-400" />
              <span>{comp.title || 'Relational Schema Records'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                  <tr>
                    {comp.columns?.map((col, i) => (
                      <th key={i} className="px-4 py-2">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {comp.rows?.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/30">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-4 py-2.5">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'action_bar':
        return (
          <div key={key} className="flex flex-wrap items-center gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 shadow-lg">
            {comp.actions?.map((act) => (
              <button
                key={act.id}
                onClick={() => onVoiceAction && onVoiceAction(act.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  act.variant === 'primary'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20'
                    : act.variant === 'danger'
                    ? 'bg-rose-950 text-rose-300 border border-rose-500/40 hover:bg-rose-900'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Dynamic Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Shot Generative UI</span>
          </div>
          <h2 className="text-xs font-bold text-white font-mono">{schema.workspaceTitle}</h2>
        </div>

        {/* Morph Prompt Bar */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Morph UI schema (e.g. 'Add database table', 'Make it Windows app')"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50 font-arabic"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePromptSubmit();
            }}
          />
          <button
            onClick={handlePromptSubmit}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Morph</span>
          </button>
        </div>
      </div>

      {/* Render Components Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div
          className={`grid gap-5 ${
            schema.layout === 'split_view'
              ? 'grid-cols-1 lg:grid-cols-2'
              : schema.layout === 'grid_3_col'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 max-w-4xl mx-auto'
          }`}
        >
          {schema.components.map((comp, idx) => renderComponent(comp, idx))}
        </div>
      </div>
    </div>
  );
};
