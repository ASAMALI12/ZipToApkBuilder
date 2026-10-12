import React, { useState, useEffect } from 'react';
import {
  Server,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  X,
  Key,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  getBackendUrl,
  setBackendUrl,
  getClientGeminiKey,
  setClientGeminiKey,
  testBackendConnection,
  DEFAULT_CLOUD_BACKEND,
  BackendStatus,
  isNativeEnvironment,
} from '../../services/apiConfig';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange?: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  onConnectionChange,
}) => {
  const [serverUrlInput, setServerUrlInput] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<BackendStatus | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setServerUrlInput(getBackendUrl() || DEFAULT_CLOUD_BACKEND);
      setApiKeyInput(getClientGeminiKey());
      runTest();
    }
  }, [isOpen]);

  const runTest = async (overrideUrl?: string) => {
    setIsTesting(true);
    setSaveNotice(null);
    try {
      const result = await testBackendConnection(overrideUrl !== undefined ? overrideUrl : serverUrlInput);
      setTestResult(result);
    } catch {
      setTestResult({
        isConfigured: true,
        isReachable: false,
        latencyMs: 0,
        url: serverUrlInput,
        hasApiKey: false,
        error: 'تعذر إجراء الفحص',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setBackendUrl(serverUrlInput);
    setClientGeminiKey(apiKeyInput);
    setSaveNotice('تم حفظ الإعدادات بنجاح في الهاتف/المتصفح.');
    runTest(serverUrlInput);
    if (onConnectionChange) onConnectionChange();
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleResetToDefault = () => {
    setServerUrlInput(DEFAULT_CLOUD_BACKEND);
    setBackendUrl(DEFAULT_CLOUD_BACKEND);
    setSaveNotice('تمت استعادة خادم النواة السحابي الافتراضي.');
    runTest(DEFAULT_CLOUD_BACKEND);
    if (onConnectionChange) onConnectionChange();
    setTimeout(() => setSaveNotice(null), 3000);
  };

  if (!isOpen) return null;

  const isNative = isNativeEnvironment();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md font-arabic select-none">
      <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">إعدادات اتصال الخادم والـ APK</h2>
              <p className="text-xs text-slate-400">
                {isNative ? 'تشغيل التطبيق بصيغة APK على هاتف أندرويد' : 'بيئة الويب / التطبيق السحابي'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Status Card */}
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
            testResult?.isReachable
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testResult?.isReachable ? (
              <Wifi className="w-5 h-5 text-emerald-400 animate-pulse" />
            ) : (
              <WifiOff className="w-5 h-5 text-rose-400" />
            )}
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>{testResult?.isReachable ? 'متصل بنجاح بالخادم' : 'الخادم غير متصل'}</span>
                {testResult?.isReachable && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    {testResult.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {testResult?.isReachable
                  ? testResult.hasApiKey
                    ? 'المحرك جاهز: مفتاح Gemini API مفعل ويعمل بكفاءة عالية.'
                    : 'الخادم متصل، ولكن يتطلب مفتاح API في البيئة.'
                  : testResult?.error || 'تعذر الاتصال بعنوان الخادم الحالي.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => runTest()}
            disabled={isTesting}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'فحص...' : 'إعادة الفحص'}</span>
          </button>
        </div>

        {/* Server URL Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>عنوان خادم النواة (Backend Server URL):</span>
            </span>
            <button
              onClick={handleResetToDefault}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>الافتراضي</span>
            </button>
          </label>
          <input
            type="text"
            value={serverUrlInput}
            onChange={(e) => setServerUrlInput(e.target.value)}
            placeholder="https://ais-dev-...run.app"
            dir="ltr"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs font-mono text-cyan-200 outline-none transition-colors"
          />
          <p className="text-[11px] text-slate-400">
            يستخدمه تطبيق الـ APK على الهاتف لإرسال واستقبال الأوامر الصوتية وتحليل النصوص عبر الخادم السحابي.
          </p>
        </div>

        {/* Optional Gemini API Key for Standalone / Offline APK */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>مفتاح Gemini API المباشر (اختياري للـ APK المستقل):</span>
          </label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            dir="ltr"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl text-xs font-mono text-amber-200 outline-none transition-colors"
          />
          <p className="text-[11px] text-slate-400">
            إذا تم إدخاله، يمكن لتطبيق الهاتف العمل بشكل مباشر حتى إذا كان الخادم السحابي غير متصل أو في وضع الاستعداد.
          </p>
        </div>

        {/* APK Notice */}
        <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-2 text-xs text-blue-200">
          <Smartphone className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <strong>نصيحة لتشغيل APK الهاتف:</strong> عند تثبيت الـ APK على الهاتف، يتصل التطبيق تلقائياً بالخادم السحابي أعلاه دون أي إعداد يدوي. تم تفعيل تصريح الميكروفون وتجاوز قيود الاتصال بنجاح.
          </div>
        </div>

        {/* Notification */}
        {saveNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveNotice}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات وتطبيقها</span>
          </button>
        </div>
      </div>
    </div>
  );
};
