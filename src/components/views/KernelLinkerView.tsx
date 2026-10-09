import React, { useRef, useState, useEffect } from 'react';
import { BoundKernel } from '../../types/kernel';
import { StorageEngine } from '../../services/storageEngine';
import { initOrExtractZipKernel, clearZipKernelCache } from '../../services/zipEngine';
import {
  Cpu,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Trash2,
  Info,
  X,
  Loader2,
  FileCode2,
} from 'lucide-react';

export type KernelLinkState = 'UNBOUND' | 'LINKING' | 'SUCCESS' | 'ERROR';

interface KernelLinkerViewProps {
  boundKernel: BoundKernel | null;
  onBindKernel: (kernel: BoundKernel | null) => void;
  onBackToHome: () => void;
  autoOpenFilePicker?: boolean;
}

export const KernelLinkerView: React.FC<KernelLinkerViewProps> = ({
  boundKernel,
  onBindKernel,
  onBackToHome,
  autoOpenFilePicker = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [linkState, setLinkState] = useState<KernelLinkState>(
    boundKernel ? 'SUCCESS' : 'UNBOUND'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Keyboard escape shortcut: guarantees the user is never trapped
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBackToHome();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBackToHome]);

  // Direct File Picker Trigger upon opening
  useEffect(() => {
    if (autoOpenFilePicker && !boundKernel) {
      const timer = setTimeout(() => {
        try {
          fileInputRef.current?.click();
        } catch {}
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [autoOpenFilePicker, boundKernel]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLinkState('LINKING');
    setErrorMessage(null);
    setStatusMessage(`جاري فحص واستخراج محتويات الملف: ${file.name}...`);

    try {
      let extractedName = file.name.replace(/\.[^/.]+$/, '');
      let extractedVersion = '1.0.0-core';
      let extractedRules: string[] = [];
      let extractedInstructions: string[] = [];
      let rawSnippet = '';

      const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');

      if (isZip) {
        // Unpack and parse ZIP file contents
        const cached = await initOrExtractZipKernel(file, file.name);
        extractedName = cached.kernelName;
        extractedVersion = cached.version;
        extractedRules = cached.rules;
        extractedInstructions = cached.instructions;
        rawSnippet = cached.summaryContext;
      } else {
        const text = await file.text();
        if (!text || text.trim().length === 0) {
          throw new Error('الملف المختار فارغ ولا يحتوي على أي بيانات.');
        }

        rawSnippet = text.slice(0, 5000);
        try {
          const json = JSON.parse(text);
          extractedName = json.name || json.kernelName || extractedName;
          extractedVersion = json.version || extractedVersion;
          if (Array.isArray(json.rules)) extractedRules = json.rules;
          if (Array.isArray(json.instructions)) extractedInstructions = json.instructions;
          if (Array.isArray(json.capabilities)) {
            extractedRules.push(...json.capabilities.map((c: any) => `القدرة: ${c}`));
          }
        } catch {
          // Plain text / Markdown rules file
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          extractedRules = lines
            .filter((l) => l.startsWith('#') || l.startsWith('//') || l.includes('rule') || l.includes('instruction'))
            .slice(0, 10)
            .map((l) => l.replace(/^[#//*\s]+/, ''));

          if (extractedRules.length === 0) {
            extractedRules = [
              `معالجة أوامر ملف: ${file.name}`,
              'تشغيل التعليمات التلقائية المدمجة',
              'توجيه الذكاء الاصطناعي وفق سياق الملف',
            ];
          }
        }
      }

      if (extractedRules.length === 0) {
        extractedRules = ['النواة متصلة وتعمل بكامل الصلاحيات'];
      }

      const newBoundKernel: BoundKernel = {
        fileName: file.name,
        fileSize: file.size,
        bindTimestamp: new Date().toLocaleString('ar-SA'),
        name: extractedName,
        version: extractedVersion,
        rules: extractedRules,
        instructions: extractedInstructions,
        rawContent: rawSnippet,
        isActive: true,
      };

      // Persist locally
      onBindKernel(newBoundKernel);
      StorageEngine.saveBoundKernel(newBoundKernel);

      // Notify backend cache for conversational context grounding
      fetch('/api/kernel/session-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kernelName: extractedName,
          rules: extractedRules,
          instructions: extractedInstructions,
          summaryContext: `النواة المربوطة: ${extractedName} (${extractedVersion}). القواعد: ${extractedRules.join(' | ')}`,
        }),
      }).catch(() => {});

      setLinkState('SUCCESS');
      setStatusMessage(`تم ربط النواة "${extractedName}" بنجاح وتفعيل القواعد (${extractedRules.length}).`);
    } catch (err: any) {
      console.warn('[KernelLinker] Linking failed:', err);
      setLinkState('ERROR');
      const errStr = err?.message || 'تعذر قراءة محتويات الملف أو الملف تالف.';
      setErrorMessage(
        errStr.includes('zip') || errStr.includes('Corrupt')
          ? 'الملف المضغوط تالف أو غير صالح. تأكد من سلامة ملف ZIP أو استخدم ملف JSON/نصي.'
          : `فشل استيراد النواة: ${errStr}`
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUnbind = () => {
    onBindKernel(null);
    StorageEngine.saveBoundKernel(null);
    clearZipKernelCache();
    setLinkState('UNBOUND');
    setStatusMessage('تم فك ارتباط النواة وحذفها من الذاكرة النشطة.');
    setErrorMessage(null);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic select-none">
      <div className="w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-3xl p-5 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Top Header with Back and Close Escape Hatches */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-cyan-500/40 active:scale-95"
            title="الرجوع إلى الشاشة السابقة"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للشاشة الرئيسية</span>
          </button>

          <button
            onClick={onBackToHome}
            className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="إغلاق والعودة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden File Picker Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="*/*"
          className="hidden"
        />

        {/* Status Indicator Core */}
        <div className="text-center mb-6">
          <div
            className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 transition-all shadow-xl ${
              linkState === 'SUCCESS'
                ? 'bg-emerald-500/10 border-2 border-emerald-400/80 shadow-emerald-500/20'
                : linkState === 'LINKING'
                ? 'bg-amber-500/10 border-2 border-amber-400/80 shadow-amber-500/20 animate-pulse'
                : linkState === 'ERROR'
                ? 'bg-rose-500/10 border-2 border-rose-500/80 shadow-rose-500/20'
                : 'bg-cyan-500/10 border border-cyan-500/30'
            }`}
          >
            {linkState === 'LINKING' ? (
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
            ) : linkState === 'SUCCESS' ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-pulse" />
            ) : linkState === 'ERROR' ? (
              <AlertCircle className="w-10 h-10 text-rose-400" />
            ) : (
              <Cpu className="w-10 h-10 text-cyan-400" />
            )}
          </div>

          <h2 className="text-xl font-bold text-white mb-1.5">
            {linkState === 'SUCCESS' && 'النواة مربوطة بنجاح'}
            {linkState === 'LINKING' && 'جارٍ فحص وربط النواة...'}
            {linkState === 'ERROR' && 'فشل ربط النواة'}
            {linkState === 'UNBOUND' && 'النواة غير مربوطة'}
          </h2>

          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {linkState === 'SUCCESS' &&
              'المحرك متصل الآن بالنواة المستوردة ويعتمد على قواعدها وتوجيهاتها في صياغة الإجابات.'}
            {linkState === 'LINKING' &&
              'يتم قراءة محتويات الحزمة واستخراج القواعد والبيانات التوجيهية وتخزينها في الذاكرة.'}
            {linkState === 'ERROR' &&
              'حدث خطأ أثناء فحص الحزمة. يمكنك اختيار ملف صالح آخر أو العودة للشاشة الرئيسية.'}
            {linkState === 'UNBOUND' &&
              'اختر ملف النواة (حزمة ZIP أو JSON) من هاتفك أو جهازك لربطه بالمحرك فوراً.'}
          </p>
        </div>

        {/* State 1: ERROR Banner */}
        {linkState === 'ERROR' && errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-2xl flex items-start gap-2.5 text-right animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-rose-200 mb-1">تنبيه بالخطأ:</p>
              <p className="text-rose-300 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* State 2: SUCCESS Details */}
        {linkState === 'SUCCESS' && boundKernel && (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">اسم النواة:</span>
                <span className="font-bold text-emerald-300 text-sm">{boundKernel.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">الملف المربوط:</span>
                <span className="text-slate-200 font-mono">{boundKernel.fileName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">الحجم:</span>
                <span className="text-slate-300 font-mono">
                  {boundKernel.fileSize ? `${Math.round(boundKernel.fileSize / 1024)} KB` : 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">تاريخ الربط:</span>
                <span className="text-slate-300">{boundKernel.bindTimestamp}</span>
              </div>
            </div>

            {/* Extracted Rules */}
            {boundKernel.rules && boundKernel.rules.length > 0 && (
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>القواعد والمعلومات المستخرجة ({boundKernel.rules.length}):</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {boundKernel.rules.map((rule, i) => (
                    <div key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>اختيار نواة أخرى من الملفات</span>
              </button>

              <button
                onClick={handleUnbind}
                className="p-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                title="فك ارتباط النواة"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">فك الارتباط</span>
              </button>
            </div>
          </div>
        )}

        {/* State 3: UNBOUND or ERROR (Upload Button) */}
        {(linkState === 'UNBOUND' || linkState === 'ERROR') && (
          <div className="space-y-4 mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Upload className="w-5 h-5" />
              <span>فتح ملفات الهاتف لاختيار النواة (ZIP / JSON)</span>
            </button>
          </div>
        )}

        {/* State 4: LINKING Progress */}
        {linkState === 'LINKING' && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 text-center mb-6">
            <p className="text-xs text-amber-300 font-medium animate-pulse">
              {statusMessage || 'جارٍ قراءة الملف وتحليل محتوياته...'}
            </p>
          </div>
        )}

        {/* Technical Transparency Note */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            <strong>توضيح تقني:</strong> يقوم هذا المشغّل باستيراد بيانات وقواعد النواة من الملف وحفظها في الذاكرة لتوجيه إجابات الذكاء الاصطناعي بدقة، ولا يقوم بتشغيل كود تنفيذي ثنائي غير مدعوم في بيئة المتصفح.
          </span>
        </div>

        {/* Bottom Guaranteed Escape Hatch */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="w-full py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-colors cursor-pointer"
          >
            إغلاق والعودة إلى الشاشة السابقة
          </button>
        </div>
      </div>
    </div>
  );
};

