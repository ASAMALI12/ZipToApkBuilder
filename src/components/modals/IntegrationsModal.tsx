import React, { useState } from 'react';
import { GitHubConfig, SupabaseConfig } from '../../types/kernel';
import { StorageEngine } from '../../services/storageEngine';
import {
  Github,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({ isOpen, onClose }) => {
  const [gitHubConfig, setGitHubConfig] = useState<GitHubConfig>(StorageEngine.loadGitHubConfig());
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(StorageEngine.loadSupabaseConfig());

  const [isTestingGit, setIsTestingGit] = useState<boolean>(false);
  const [gitStatus, setGitStatus] = useState<string | null>(null);

  const [isTestingSupa, setIsTestingSupa] = useState<boolean>(false);
  const [supaStatus, setSupaStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestGitHub = async () => {
    if (!gitHubConfig.pat.trim()) {
      setGitStatus('Enter a Personal Access Token first.');
      return;
    }

    setIsTestingGit(true);
    setGitStatus(null);
    try {
      const res = await fetch('/api/github/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: gitHubConfig.pat.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = {
          ...gitHubConfig,
          username: data.username,
          isConnected: true,
        };
        setGitHubConfig(updated);
        StorageEngine.saveGitHubConfig(updated);
        setGitStatus(`Connected as @${data.username} (${data.publicRepos} public repos).`);
      } else {
        setGitStatus('Failed to validate token. Check permissions (repo, workflow).');
      }
    } catch (err: any) {
      setGitStatus(`Error connecting to GitHub: ${err.message}`);
    } finally {
      setIsTestingGit(false);
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupa(true);
    setSupaStatus(null);
    try {
      const res = await fetch('/api/supabase/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseUrl: supabaseConfig.url,
          supabaseKey: supabaseConfig.anonKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = { ...supabaseConfig, isConnected: true };
        setSupabaseConfig(updated);
        StorageEngine.saveSupabaseConfig(updated);
        setSupaStatus('Supabase Cloud connection established! Storage & PostgreSQL live.');
      } else {
        setSupaStatus('Supabase ping returned non-200. Check URL and Anon Key.');
      }
    } catch (err: any) {
      setSupaStatus(`Connection error: ${err.message}`);
    } finally {
      setIsTestingSupa(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Kernel Cloud Integrations</h3>
              <p className="text-xs text-slate-400 font-mono">
                Persistent Sync with GitHub &amp; Supabase Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section 6.1: GitHub API Bridge */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-white" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  GitHub API Bridge
                </span>
              </div>
              {gitHubConfig.isConnected && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3" />
                  Synced
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Enables autonomous clone, commit, push, and repository creation directly from the Kernel shell.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                  Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={gitHubConfig.pat}
                  onChange={(e) => setGitHubConfig({ ...gitHubConfig, pat: e.target.value })}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                  Target Repository Name
                </label>
                <input
                  type="text"
                  value={gitHubConfig.repoName}
                  onChange={(e) => setGitHubConfig({ ...gitHubConfig, repoName: e.target.value })}
                  placeholder="kernel-autonomous-workspace"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {gitStatus && (
                  <span className="text-xs font-mono text-cyan-400">{gitStatus}</span>
                )}
                <button
                  onClick={handleTestGitHub}
                  disabled={isTestingGit}
                  className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isTestingGit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Validate Token</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 6.2: Supabase Cloud Backend Structure */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  Supabase Cloud Backend
                </span>
              </div>
              {supabaseConfig.isConnected && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px] font-mono">
              <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block">Storage Buckets:</span>
                <span className="text-cyan-400">kernel-backups, project-files</span>
              </div>
              <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block">PostgreSQL Tables:</span>
                <span className="text-emerald-400">projects, kernel_memory</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                  Project URL
                </label>
                <input
                  type="text"
                  value={supabaseConfig.url}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, url: e.target.value })}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 mb-1 block">
                  Anon / Public API Key
                </label>
                <input
                  type="password"
                  value={supabaseConfig.anonKey}
                  onChange={(e) => setSupabaseConfig({ ...supabaseConfig, anonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {supaStatus && (
                  <span className="text-xs font-mono text-emerald-400">{supaStatus}</span>
                )}
                <button
                  onClick={handleTestSupabase}
                  disabled={isTestingSupa}
                  className="ml-auto px-4 py-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-mono transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isTestingSupa && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Test Connection &amp; Sync</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
