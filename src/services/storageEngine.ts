import { ProjectFile, KernelMemoryLog, GitHubConfig, SupabaseConfig, BoundKernel } from '../types/kernel';

const STORAGE_KEYS = {
  PROJECT_FILES: 'kernel_project_files_v1',
  MEMORY_LOGS: 'kernel_memory_logs_v1',
  GITHUB_CONFIG: 'kernel_github_config_v1',
  SUPABASE_CONFIG: 'kernel_supabase_config_v1',
  ACTIVE_PROJECT: 'kernel_active_project_name',
  BOUND_KERNEL: 'kernel_bound_core_v1',
};

export interface InMemoryKernelState {
  kernelName: string;
  version: string;
  rules: string[];
  instructions: string[];
  summaryContext: string;
  isLoaded: boolean;
  timestamp: string;
}

// In-Memory state for the active session (prevents repeated ZIP decompression or storage reads)
let inMemoryKernelState: InMemoryKernelState | null = null;

// Default initial starter project files
export const DEFAULT_INITIAL_PROJECT_FILES: ProjectFile[] = [
  {
    name: 'App.tsx',
    path: 'src/App.tsx',
    content: `import React, { useState } from 'react';

export default function KernelApp() {
  const [powerLevel, setPowerLevel] = useState(9000);
  const [subsystems, setSubsystems] = useState([
    { name: 'VAD Barge-In Engine', latency: '42ms', status: 'Optimal' },
    { name: 'Anti-Pop Gain Ramp', latency: '30ms', status: 'Calibrated' },
    { name: 'Dialectal NLU', accuracy: '99.4%', status: 'Online' },
  ]);

  return (
    <div className="p-6 bg-slate-950 text-slate-100 rounded-xl border border-cyan-500/30">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-cyan-400">⚡ Autonomous Subsystem Hub</h1>
        <span className="px-3 py-1 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs rounded-full font-mono">
          Power: {powerLevel} GW
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {subsystems.map((sub, i) => (
          <div key={i} className="p-3 bg-slate-900/80 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400 font-mono">{sub.name}</div>
            <div className="text-lg font-bold text-white mt-1">{sub.latency || sub.accuracy}</div>
            <span className="text-[10px] text-emerald-400 font-mono uppercase">● {sub.status}</span>
          </div>
        ))}
      </div>
      <button 
        onClick={() => setPowerLevel(p => p + 100)}
        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
      >
        Overclock Kernel Engine
      </button>
    </div>
  );
}`,
  },
  {
    name: 'kernel-config.ts',
    path: 'src/kernel-config.ts',
    content: `export const KERNEL_CONFIG = {
  version: '3.4.0',
  mode: 'autonomous_duplex',
  bargeInThresholdMs: 150,
  antiPopRampMs: 30,
  audioSampleRate: 24000,
  vadSilenceDurationMs: 700,
  dialectsSupported: ['Gulf', 'Iraqi', 'Egyptian', 'Levantine', 'Standard', 'English'],
};`,
  },
];

export class StorageEngine {
  /**
   * Session Initialization: caches the extracted instructions & rules in memory
   * once at session start. Subsequent voice interactions pull from memory directly.
   */
  public static initSessionKernelContext(kernel: BoundKernel | null): InMemoryKernelState {
    if (!kernel) {
      inMemoryKernelState = {
        kernelName: 'Default Core',
        version: '3.4.0',
        rules: ['النواة الافتراضية جاهزة للعمل'],
        instructions: [],
        summaryContext: 'نواة النظام تعمل بالوضع الافتراضي.',
        isLoaded: false,
        timestamp: new Date().toISOString(),
      };
      return inMemoryKernelState;
    }

    const rules = kernel.rules || [];
    const instructions = kernel.instructions || [];
    const summary = `النواة: ${kernel.name} (${kernel.version}). التوجيهات: ${[...rules, ...instructions].slice(0, 5).join(' | ')}`;

    inMemoryKernelState = {
      kernelName: kernel.name,
      version: kernel.version,
      rules,
      instructions,
      summaryContext: summary,
      isLoaded: true,
      timestamp: new Date().toISOString(),
    };

    return inMemoryKernelState;
  }

  public static getInMemoryKernelContext(): InMemoryKernelState | null {
    if (!inMemoryKernelState) {
      const bound = StorageEngine.loadBoundKernel();
      return StorageEngine.initSessionKernelContext(bound);
    }
    return inMemoryKernelState;
  }

  public static setInMemoryKernelContext(state: InMemoryKernelState | null): void {
    inMemoryKernelState = state;
  }

  public static loadFiles(): ProjectFile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECT_FILES);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[StorageEngine] Error loading files:', e);
    }
    return DEFAULT_INITIAL_PROJECT_FILES;
  }

  public static saveFiles(files: ProjectFile[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECT_FILES, JSON.stringify(files));
    } catch (e) {
      console.error('[StorageEngine] Error saving files:', e);
    }
  }

  public static loadMemoryLogs(): KernelMemoryLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMORY_LOGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('[StorageEngine] Error loading memory logs:', e);
    }
    return [
      {
        id: 'mem_init',
        timestamp: new Date().toLocaleTimeString(),
        utterance: 'النواة متصلة وجاهزة للعمل',
        intent: 'INTENT_GENERAL_QUERY',
        response: 'تم تشغيل نواة الصوت المستقلة بنجاح.',
        workspace: 'home',
      },
    ];
  }

  public static appendMemoryLog(log: KernelMemoryLog): void {
    try {
      const current = this.loadMemoryLogs();
      const updated = [log, ...current].slice(0, 100); // keep last 100
      localStorage.setItem(STORAGE_KEYS.MEMORY_LOGS, JSON.stringify(updated));
    } catch (e) {
      console.error('[StorageEngine] Error saving memory log:', e);
    }
  }

  public static loadGitHubConfig(): GitHubConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GITHUB_CONFIG);
      if (data) return JSON.parse(data);
    } catch {}
    return {
      pat: '',
      username: '',
      repoName: 'kernel-autonomous-workspace',
      isConnected: false,
    };
  }

  public static saveGitHubConfig(config: GitHubConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GITHUB_CONFIG, JSON.stringify(config));
    } catch {}
  }

  public static loadSupabaseConfig(): SupabaseConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
      if (data) return JSON.parse(data);
    } catch {}
    return {
      url: 'https://kernel-autonomous.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      isConnected: false,
      buckets: {
        kernelBackups: 'kernel-backups',
        projectFiles: 'project-files',
      },
      tables: {
        projects: 'projects',
        kernelMemory: 'kernel_memory',
      },
    };
  }

  public static saveSupabaseConfig(config: SupabaseConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(config));
    } catch {}
  }

  public static loadBoundKernel(): BoundKernel | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOUND_KERNEL);
      if (data) return JSON.parse(data);
    } catch {}
    return null;
  }

  public static saveBoundKernel(kernel: BoundKernel | null): void {
    try {
      if (kernel) {
        localStorage.setItem(STORAGE_KEYS.BOUND_KERNEL, JSON.stringify(kernel));
        StorageEngine.initSessionKernelContext(kernel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.BOUND_KERNEL);
        StorageEngine.initSessionKernelContext(null);
      }
    } catch {}
  }

  public static loadLearnedKnowledge(): string {
    try {
      return localStorage.getItem('kernel_learned_knowledge_v1') || '';
    } catch {
      return '';
    }
  }

  public static async saveLearnedKnowledge(text: string): Promise<void> {
    try {
      localStorage.setItem('kernel_learned_knowledge_v1', text);
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const existing = StorageEngine.loadBoundKernel();
      const updatedKernel: BoundKernel = {
        name: existing?.name || 'النواة المتعلمة',
        fileName: existing?.fileName || 'learned_kernel.json',
        fileSize: existing?.fileSize || text.length,
        bindTimestamp: new Date().toISOString(),
        version: existing?.version || '3.5.0-learned',
        rules: lines.slice(0, 15),
        instructions: lines,
        rawContent: text,
        isActive: true,
      };

      StorageEngine.saveBoundKernel(updatedKernel);

      // Sync immediately to server session memory
      try {
        await fetch('/api/kernel/session-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summaryContext: `التعليمات والمعرفة التي تعلمتها النواة:\n${text}`,
            rules: lines.slice(0, 15),
            instructions: lines,
            kernelName: updatedKernel.name,
          }),
        });
      } catch {}
    } catch {}
  }
}
