import React, { useRef, useState, useEffect } from 'react';
import { BoundKernel } from '../../types/kernel';
import { StorageEngine } from '../../services/storageEngine';
import { initOrExtractZipKernel } from '../../services/zipEngine';
import {
  Cpu,
  Upload,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Shield,
  Trash2,
  Sparkles,
  Info,
} from 'lucide-react';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);

  useEffect(() => {
    // If opened via voice "دعنا نربط النواة", immediately trigger file picker
    if (autoOpenFilePicker && !boundKernel) {
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoOpenFilePicker, boundKernel]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setExtractMessage('جاري قراءة واستخراج بيانات النواة من الملف...');

    try {
      let extractedName = file.name.replace(/\.[^/.]+$/, '');
      let extractedVersion = '1.0.0-core';
      let extractedRules: string[] = [];
      let extractedInstructions: string[] = [];
      let rawSnippet = '';

      const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');

      if (isZip) {
        // Read and extract ZIP file ONCE in-memory for session initialization
        const cached = await initOrExtractZipKernel(file, file.name);
        extractedName = cached.kernelName;
        extractedVersion = cached.version;
        extractedRules = cached.rules;
        extractedInstructions = cached.instructions;
        rawSnippet = cached.summaryContext;
      } else {
        const text = await file.text();
        rawSnippet = text.slice(0, 5000);
        try {
          // Try parsing if JSON
          const json = JSON.parse(text);
          extractedName = json.name || json.kernelName || extractedName;
          extractedVersion = json.version || extractedVersion;
          if (Array.isArray(json.rules)) extractedRules = json.rules;
          if (Array.isArray(json.instructions)) extractedInstructions = json.instructions;
          if (Array.isArray(json.capabilities)) {
            extractedRules.push(...json.capabilities.map((c: any) => `القدرة: ${c}`));
          }
        } catch {
          // Text/code file: extract rules line by line or comments
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          extractedRules = lines
            .filter((l) => l.startsWith('#') || l.startsWith('//') || l.includes('rule') || l.includes('instruction'))
            .slice(0, 10)
            .map((l) => l.replace(/^[#//*\s]+/, ''));

          if (extractedRules.length === 0) {
            extractedRules = [
              `معالجة أوامر ملف: ${file.name}`,
              'تشغيل التعليمات التلقائية المدمجة',
              'دعم الميكروفون والصوت المباشر',
            ];
          }
        }
      }

      const newBoundKernel: BoundKernel = {
        fileName: file.name,
        fileSize: file.size,
        bindTimestamp: new Date().toLocaleString('ar-SA'),
        name: extractedName,
        version: extractedVersion,
        rules: extractedRules.length > 0 ? extractedRules : ['النواة متصلة وتعمل بكامل الصلاحيات'],
        instructions: extractedInstructions,
        rawContent: rawSnippet,
        isActive: true,
      };

      onBindKernel(newBoundKernel);
      StorageEngine.saveBoundKernel(newBoundKernel);

      // Notify server to cache context in-memory once (eliminates passing zip repeatedly)
      fetch('/api/kernel/session-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kernelName: extractedName,
          rules: extractedRules,
          instructions: extractedInstructions,
          summaryContext: `النواة: ${extractedName} (${extractedVersion}). القواعد: ${extractedRules.join(' | ')}`,
        }),
      }).catch(() => {});

      setExtractMessage(`تم بنجاح فك ضغط وحفظ سياق النواة في الذاكرة: ${extractedName} (${file.name})!`);
    } catch (err: any) {
      setExtractMessage(`خطأ في قراءة الملف: ${err.message}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUnbind = () => {
    onBindKernel(null);
    StorageEngine.saveBoundKernel(null);
    setExtractMessage('تم فك ارتباط النواة.');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic">
      <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Top Back Button */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للشاشة الرئيسية</span>
          </button>
          <span className="text-xs font-mono text-slate-500">Kernel Binder</span>
        </div>

        {/* Hidden File Picker */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="*/*"
          className="hidden"
        />

        {/* Kernel Status Core */}
        <div className="text-center mb-6">
          <div
            className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 transition-all ${
              boundKernel
                ? 'bg-emerald-500/10 border-2 border-emerald-400/80 shadow-lg shadow-emerald-500/20'
                : 'bg-cyan-500/10 border border-cyan-500/30'
            }`}
          >
            <Cpu
              className={`w-10 h-10 ${
                boundKernel ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'
              }`}
            />
          </div>

          <h2 className="text-xl font-bold text-white mb-1">
            {boundKernel ? 'النواة مربوطة ونشطة' : 'ربط واختيار النواة'}
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {boundKernel
              ? 'المحرك الآن مرتبط بالنواة المستوردة ويتلقى أوامره ومعلوماته منها مباشرة.'
              : 'اختر ملف النواة من هاتفك أو جهازك لربطه بالمحرك والاعتماد عليه في توجيه الذكاء الاصطناعي.'}
          </p>
        </div>

        {/* Bound Kernel Details */}
        {boundKernel ? (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">اسم النواة:</span>
                <span className="text-sm font-bold text-emerald-300">{boundKernel.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">الملف المربوط:</span>
                <span className="text-slate-200 font-mono">{boundKernel.fileName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">وقت الربط:</span>
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
                      <span className="text-cyan-500">•</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>اختيار نواة أخرى من الهاتف</span>
              </button>

              <button
                onClick={handleUnbind}
                className="p-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 rounded-xl text-xs transition-colors cursor-pointer"
                title="فك الارتباط"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-5 h-5" />
              <span>فتح ملفات الهاتف لاختيار النواة</span>
            </button>
          </div>
        )}

        {/* Status Message */}
        {extractMessage && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-300 text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{extractMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
