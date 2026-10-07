import React, { useEffect, useRef, useState } from 'react';
import { audioEngine, AudioCallMode } from '../../services/audioEngine';
import { CallStatus, BoundKernel } from '../../types/kernel';
import {
  Mic,
  MicOff,
  Volume2,
  Zap,
  Sparkles,
  Cpu,
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  FolderOpen,
  PhoneOff,
} from 'lucide-react';

interface CentralCallOrbProps {
  onQuickIntent: (phrase: string) => void;
  currentTranscript?: string;
  isInterimTranscript?: boolean;
  boundKernel: BoundKernel | null;
}

export const CentralCallOrb: React.FC<CentralCallOrbProps> = ({
  onQuickIntent,
  currentTranscript,
  isInterimTranscript,
  boundKernel,
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());
  const [micEnergy, setMicEnergy] = useState<number>(0);
  const [outputEnergy, setOutputEnergy] = useState<number>(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [callMode, setCallMode] = useState<AudioCallMode>(audioEngine.getCallMode());
  const [sensitivity, setSensitivity] = useState<'HIGH' | 'NORMAL' | 'NOISE_ISOLATION'>(
    audioEngine.getSensitivity()
  );
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const unsubStatus = audioEngine.subscribeStatus((st) => setCallStatus(st));
    const unsubEnergy = audioEngine.subscribeEnergy((mic, out) => {
      setMicEnergy(mic);
      setOutputEnergy(out);
    });
    const unsubError = audioEngine.subscribeError((err) => setPermissionError(err));

    return () => {
      unsubStatus();
      unsubEnergy();
      unsubError();
    };
  }, []);

  // Frequency wave animation loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderWave = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isSpeaking = callStatus === 'SPEAKING';
      const isListening = callStatus === 'LISTENING';
      const isBargeIn = callStatus === 'BARGE_IN';

      const activeEnergy = isSpeaking ? outputEnergy : micEnergy;
      const bars = 48;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = 100;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2;
        const wave = Math.sin(Date.now() * 0.005 + i * 0.4) * 0.5 + 0.5;
        const barHeight = Math.max(3, wave * (activeEnergy * 60 + (isListening ? 16 : 4)));

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';

        if (isBargeIn) {
          ctx.strokeStyle = '#f43f5e';
        } else if (isSpeaking) {
          ctx.strokeStyle = '#a855f7';
        } else if (isListening) {
          ctx.strokeStyle = activeEnergy > 0.05 ? '#06b6d4' : '#0891b2';
        } else {
          ctx.strokeStyle = '#1e293b';
        }

        ctx.stroke();
      }

      animId = requestAnimationFrame(renderWave);
    };

    animId = requestAnimationFrame(renderWave);
    return () => cancelAnimationFrame(animId);
  }, [callStatus, micEnergy, outputEnergy]);

  const handleToggleCall = async () => {
    setPermissionError(null);
    if (callStatus === 'IDLE') {
      try {
        await audioEngine.safeStartMicrophone();
      } catch {
        setPermissionError('يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.');
      }
    } else if (callStatus === 'LISTENING') {
      // In TAP_TO_TALK or if user taps while listening, commit speech immediately!
      await audioEngine.commitCurrentUtterance();
    }
  };

  const handleEndCall = () => {
    audioEngine.safeStopMicrophone();
  };

  const handleModeChange = (mode: AudioCallMode) => {
    setCallMode(mode);
    audioEngine.setCallMode(mode);
  };

  const handleSensitivityChange = (level: 'HIGH' | 'NORMAL' | 'NOISE_ISOLATION') => {
    setSensitivity(level);
    audioEngine.setSensitivity(level);
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-between min-h-[88vh] px-4 py-6 select-none font-arabic">
      {/* Top Kernel Status Bar (Minimalist) */}
      <div className="w-full max-w-md flex items-center justify-between pt-2 z-20">
        <button
          onClick={() => onQuickIntent('دعنا نربط النوات')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs transition-all cursor-pointer ${
            boundKernel
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300 shadow-sm'
              : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="ربط ملف النواة من الهاتف"
        >
          <Cpu className={`w-3.5 h-3.5 ${boundKernel ? 'text-emerald-400' : 'text-cyan-400'}`} />
          {boundKernel ? (
            <span className="truncate max-w-[200px]">
              النواة: <strong>{boundKernel.name}</strong>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>ربط النواة</span>
              <FolderOpen className="w-3 h-3 text-cyan-400" />
            </span>
          )}
        </button>

        {/* Audio Mode / Filter Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-full border transition-all cursor-pointer ${
            showSettings
              ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="إعدادات اللاقط وعزل الضوضاء"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Audio Settings Dropdown */}
      {showSettings && (
        <div className="w-full max-w-sm bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 my-2 z-30 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-200 text-right">
          <div>
            <span className="text-xs text-slate-400 block mb-1.5">نمط المكالمة:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleModeChange('CONTINUOUS')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all cursor-pointer ${
                  callMode === 'CONTINUOUS'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                مكالمة مستمرة
              </button>
              <button
                onClick={() => handleModeChange('TAP_TO_TALK')}
                className={`py-1.5 px-2 text-xs rounded-xl border transition-all cursor-pointer ${
                  callMode === 'TAP_TO_TALK'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                اضغط للتحدث (للهاتف)
              </button>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1.5">عزل الضوضاء وحساسية المايك:</span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleSensitivityChange('HIGH')}
                className={`py-1 text-[11px] rounded-lg border transition-all cursor-pointer ${
                  sensitivity === 'HIGH'
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                لاقط حساس جداً
              </button>
              <button
                onClick={() => handleSensitivityChange('NORMAL')}
                className={`py-1 text-[11px] rounded-lg border transition-all cursor-pointer ${
                  sensitivity === 'NORMAL'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                متوازن
              </button>
              <button
                onClick={() => handleSensitivityChange('NOISE_ISOLATION')}
                className={`py-1 text-[11px] rounded-lg border transition-all cursor-pointer ${
                  sensitivity === 'NOISE_ISOLATION'
                    ? 'bg-purple-950 border-purple-500 text-purple-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                عزل الأصوات الخارجية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Ambient Glow */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          callStatus === 'LISTENING'
            ? 'bg-cyan-500/15 scale-125'
            : callStatus === 'SPEAKING'
            ? 'bg-purple-500/20 scale-125'
            : callStatus === 'BARGE_IN'
            ? 'bg-rose-500/25 scale-125'
            : 'bg-slate-800/10 scale-90'
        }`}
      />

      {/* Main Central Voice Call Button (Only element on screen) */}
      <div className="relative flex flex-col items-center justify-center my-auto z-10">
        <div className="relative flex items-center justify-center w-72 h-72">
          {/* Audio Canvas Rings */}
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            className="absolute inset-0 pointer-events-none z-10"
          />

          {/* Central Call Button */}
          <button
            onClick={handleToggleCall}
            className={`relative z-20 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer group focus:outline-none ${
              callStatus === 'LISTENING'
                ? 'bg-gradient-to-b from-cyan-950 via-slate-900 to-slate-950 border-2 border-cyan-400 shadow-cyan-500/40 scale-105'
                : callStatus === 'SPEAKING'
                ? 'bg-gradient-to-b from-purple-950 via-slate-900 to-slate-950 border-2 border-purple-400 shadow-purple-500/40 scale-105'
                : callStatus === 'BARGE_IN'
                ? 'bg-gradient-to-b from-rose-950 via-slate-900 to-slate-950 border-2 border-rose-400 shadow-rose-500/50 scale-110'
                : 'bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 hover:border-cyan-500/60 shadow-slate-950 hover:scale-102'
            }`}
            title="بدء أو إنهاء المكالمة الصوتية مع النواة"
          >
            <div className="relative mb-2">
              {callStatus === 'IDLE' ? (
                <MicOff className="w-12 h-12 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              ) : callStatus === 'SPEAKING' ? (
                <Volume2 className="w-12 h-12 text-purple-400 animate-pulse" />
              ) : callStatus === 'BARGE_IN' ? (
                <Zap className="w-12 h-12 text-rose-400 animate-bounce" />
              ) : (
                <Mic className="w-12 h-12 text-cyan-400 animate-pulse" />
              )}
            </div>

            <span className="text-xs font-bold tracking-wider transition-colors">
              {callStatus === 'IDLE' && (
                <span className="text-slate-300 group-hover:text-white">بدء المكالمة</span>
              )}
              {callStatus === 'STARTING' && <span className="text-yellow-400">تشغيل المايك...</span>}
              {callStatus === 'LISTENING' && (
                <span className="text-cyan-300">
                  {callMode === 'TAP_TO_TALK' ? 'اضغط للإرسال' : 'أنا أستمع إليك'}
                </span>
              )}
              {callStatus === 'THINKING' && (
                <span className="text-amber-300 animate-pulse">جاري الفهم...</span>
              )}
              {callStatus === 'SPEAKING' && <span className="text-purple-300">النواة تتحدث...</span>}
              {callStatus === 'BARGE_IN' && <span className="text-rose-400">مقاطعة الصوت!</span>}
              {callStatus === 'STOPPING' && <span className="text-yellow-400">إيقاف المايك...</span>}
            </span>

            {/* Live Audio Energy Indicator */}
            {callStatus === 'LISTENING' && (
              <span className="text-[10px] text-cyan-400 font-mono mt-1">
                {micEnergy > 0.04
                  ? `يلتقط صوتك: ${Math.round(micEnergy * 100)}%`
                  : 'تحدث بصوتك الآن...'}
              </span>
            )}
          </button>
        </div>

        {/* End Call Button when call is active */}
        {callStatus !== 'IDLE' && (
          <button
            onClick={handleEndCall}
            className="mt-3 px-4 py-1.5 rounded-full bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 z-20"
            title="إنهاء المكالمة وإغلاق المايك"
          >
            <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
            <span>إنهاء المكالمة</span>
          </button>
        )}

        {/* Live Speech Recognition Transcript Pill */}
        <div className="w-full max-w-md min-h-[44px] px-5 py-2 my-2 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-lg flex items-center justify-center text-center">
          {currentTranscript ? (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <p className="text-sm font-bold text-slate-100 leading-relaxed">
                "{currentTranscript}"
                {isInterimTranscript && <span className="text-cyan-400"> ...</span>}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-medium">
              {callStatus === 'IDLE'
                ? 'اضغط على زر المكالمة وابدأ بالتحدث مباشرة'
                : 'تحدث الآن: "ابني تطبيق اندرويد"، "اريد انشاء صوره"، "اريد انشاء لعبه"، "اربط النواة"'}
            </p>
          )}
        </div>

        {/* Permission Error Message */}
        {permissionError && (
          <div className="mt-2 px-4 py-2 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{permissionError}</span>
          </div>
        )}
      </div>

      {/* Bottom Area: Clean Quick Command Chips (For easy testing / noisy environments) */}
      <div className="w-full max-w-lg flex flex-col items-center space-y-2 pb-2 z-10">
        <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
          {[
            'ابني تطبيق اندرويد او ايفون',
            'اريد انشاء صوره',
            'اريد انشاء لعبه',
            'افتح صفحه انشاء فديو اوصوت',
            'اربط بالكيت هب',
            'اربط بالسوبابيس',
            'دعنا نربط النوات',
            'لنبدا تعليم النوات',
          ].map((cmd, idx) => (
            <button
              key={idx}
              onClick={() => onQuickIntent(cmd)}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-cyan-950/60 border border-slate-800/80 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-200 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

