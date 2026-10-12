import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Zap,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Wifi,
  ShieldCheck,
  Radio,
  Share2,
  X,
  Database,
  ArrowRightLeft,
  Server,
} from 'lucide-react';
import { MultiKernelBridgePipeline, MultiBridgeReport } from '../../services/multiBridgePipeline';
import { BoundKernel } from '../../types/kernel';

interface BridgesInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  boundKernel: BoundKernel | null;
}

export const BridgesInspectorModal: React.FC<BridgesInspectorModalProps> = ({
  isOpen,
  onClose,
  boundKernel,
}) => {
  const [report, setReport] = useState<MultiBridgeReport>(() =>
    MultiKernelBridgePipeline.getBridgesStatus()
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshReport = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setReport(MultiKernelBridgePipeline.getBridgesStatus());
      setIsRefreshing(false);
    }, 300);
  };

  useEffect(() => {
    if (isOpen) {
      refreshReport();
      const interval = setInterval(refreshReport, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md font-arabic select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>جسور الربط مع النواة (Kernel Bridges)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                  {report.activeBridges} / {report.totalBridges} جسور نشطة
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                التطبيق مجرد جسر شفاف وفائق السعة — النواة هي العقل والمستودع المستقل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshReport}
              className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="تحديث حالة الجسور"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High-Capacity Philosophy Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-950 to-blue-950/60 border border-cyan-500/30 flex items-center gap-3">
          <Zap className="w-5 h-5 text-cyan-400 shrink-0" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-cyan-300 font-bold block mb-0.5">معمارية التدفق الحر (High-Capacity Highway):</strong>
            تم تصميم هذه الجسور لتتحمل تدفق مليارات المعلومات دون الحاجة لتحديث أو تعديل التطبيق في المستقبل. التطبيق يبقى خفيفاً وشفافاً، والنواة هي القوة المستمرة في التطور.
          </div>
        </div>

        {/* Active Kernel Info */}
        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>النواة المتصلة بالجسور:</span>
            <strong className="text-white font-mono">{boundKernel?.name || 'نواة الذكاء الذاتية'}</strong>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>جاهزة وتتلقى الأوامر الصوتية والكتابية</span>
          </span>
        </div>

        {/* Channels List */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>قنوات وجسور الربط المتوازية:</span>
            <span className="text-[11px] text-cyan-400 font-mono">سعة كاملة بدون اختناق</span>
          </h3>

          {report.channels.map((ch, idx) => (
            <div
              key={ch.id}
              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs font-mono font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-xs font-bold text-white">{ch.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700">
                    استجابة {ch.latencyMs}ms
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{ch.status === 'OPTIMAL' ? 'مثالي' : 'نشط'}</span>
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed pr-8">
                {ch.description}
              </p>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900 pr-8 flex-wrap gap-1">
                <span className="text-cyan-400/90">{ch.capacity}</span>
                <span>الحزم المنقولة: {ch.packetsTransferred} حزمة</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            كافة الجسور تعمل ببروتوكولات التوازي والتوجيه الفوري
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer shadow-md"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
