import React, { useEffect, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { CallStatus } from '../../types/kernel';
import { Mic, MicOff, Volume2, Zap, Maximize2, Radio } from 'lucide-react';

interface FloatingVoiceOrbProps {
  onExpandToHome: () => void;
  activeWorkspaceName: string;
}

export const FloatingVoiceOrb: React.FC<FloatingVoiceOrbProps> = ({
  onExpandToHome,
  activeWorkspaceName,
}) => {
  const [callStatus, setCallStatus] = useState<CallStatus>(audioEngine.getStatus());
  const [energy, setEnergy] = useState<number>(0);

  useEffect(() => {
    const unsubStatus = audioEngine.subscribeStatus((st) => setCallStatus(st));
    const unsubEnergy = audioEngine.subscribeEnergy((mic, out) => {
      setEnergy(callStatus === 'SPEAKING' ? out : mic);
    });
    return () => {
      unsubStatus();
      unsubEnergy();
    };
  }, [callStatus]);

  const handleToggle = () => {
    if (callStatus === 'IDLE') {
      audioEngine.safeStartMicrophone().catch(console.error);
    } else {
      audioEngine.safeStopMicrophone();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 p-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl transition-all select-none">
      {/* Wave pulse status pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800">
        <span
          className={`w-2 h-2 rounded-full ${
            callStatus === 'LISTENING'
              ? 'bg-cyan-400 animate-pulse'
              : callStatus === 'SPEAKING'
              ? 'bg-purple-400 animate-ping'
              : callStatus === 'BARGE_IN'
              ? 'bg-rose-500 animate-bounce'
              : 'bg-slate-600'
          }`}
        />
        <div className="flex flex-col">
          <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider">
            {callStatus}
          </span>
          <span className="text-[9px] font-mono text-cyan-400">
            {callStatus !== 'IDLE' ? 'VAD Active' : 'Standby'}
          </span>
        </div>
      </div>

      {/* Mini frequency equalizer bars */}
      <div className="flex items-center gap-0.5 h-6 px-1">
        {[0.4, 0.8, 0.5, 0.9, 0.6].map((scale, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              callStatus === 'BARGE_IN'
                ? 'bg-rose-400'
                : callStatus === 'SPEAKING'
                ? 'bg-purple-400'
                : callStatus === 'LISTENING'
                ? 'bg-cyan-400'
                : 'bg-slate-700'
            }`}
            style={{
              height: `${Math.max(4, energy * 24 * scale + 4)}px`,
            }}
          />
        ))}
      </div>

      {/* Mic toggle button with anti-pop safe methods */}
      <button
        onClick={handleToggle}
        className={`p-2.5 rounded-xl transition-all cursor-pointer ${
          callStatus === 'LISTENING'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
            : callStatus === 'SPEAKING'
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
        title="Toggle Microphone"
      >
        {callStatus === 'IDLE' ? (
          <MicOff className="w-4 h-4" />
        ) : callStatus === 'SPEAKING' ? (
          <Volume2 className="w-4 h-4 animate-pulse" />
        ) : callStatus === 'BARGE_IN' ? (
          <Zap className="w-4 h-4 text-rose-400" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Expand / Minimize back to minimal home button */}
      <button
        onClick={onExpandToHome}
        className="p-2.5 bg-slate-800 hover:bg-cyan-950/50 text-slate-300 hover:text-cyan-300 rounded-xl border border-slate-700 hover:border-cyan-500/40 transition-colors cursor-pointer"
        title="Minimize Workspace to Home Launcher"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
};
