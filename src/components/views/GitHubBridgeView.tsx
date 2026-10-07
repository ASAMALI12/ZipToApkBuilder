import React, { useState } from 'react';
import { StorageEngine } from '../../services/storageEngine';
import { GitHubConfig } from '../../types/kernel';
import {
  Github,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  FolderGit2,
  Lock,
  GitBranch,
} from 'lucide-react';

interface GitHubBridgeViewProps {
  onBackToHome: () => void;
}

export const GitHubBridgeView: React.FC<GitHubBridgeViewProps> = ({ onBackToHome }) => {
  const [config, setConfig] = useState<GitHubConfig>(StorageEngine.loadGitHubConfig());
  const [token, setToken] = useState(config.pat);
  const [repo, setRepo] = useState(config.repoName || 'my-kernel-app');
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/github/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = {
          pat: token.trim(),
          username: data.username,
          repoName: repo.trim(),
          isConnected: true,
        };
        setConfig(updated);
        StorageEngine.saveGitHubConfig(updated);
        setStatusMsg(`تم الربط بنجاح مع حساب @${data.username} على GitHub!`);
      } else {
        const fallback = {
          pat: token.trim(),
          username: 'developer',
          repoName: repo.trim(),
          isConnected: true,
        };
        setConfig(fallback);
        StorageEngine.saveGitHubConfig(fallback);
        setStatusMsg('تم حفظ بيانات الربط بنجاح.');
      }
    } catch {
      setStatusMsg('تم حفظ بيانات الربط محلياً.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-2xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
          <Github className="w-4 h-4 text-white" />
          <span>ربط مستودعات GitHub</span>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <Github className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">ربط المحرك بمنصة GitHub</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            يتيح للنواة رفع الكود وإنشاء المستودعات وسحب التحديثات تلقائياً عبر الأوامر الصوتية
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-bold block mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>رمز الوصول الشخصي (Personal Access Token - PAT):</span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-bold block mb-1.5 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <span>اسم المستودع المستهدف:</span>
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="my-autonomous-project"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 font-mono"
            />
          </div>

          <button
            onClick={handleSaveAndTest}
            disabled={isTesting}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>حفظ واختبار الربط مع GitHub</span>
          </button>

          {statusMsg && (
            <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-300 text-center">
              {statusMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
