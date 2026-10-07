import React, { useState } from 'react';
import {
  Video,
  Volume2,
  ArrowRight,
  Play,
  Sparkles,
  Download,
  Film,
  Music,
} from 'lucide-react';

interface MediaStudioViewProps {
  onBackToHome: () => void;
}

export const MediaStudioView: React.FC<MediaStudioViewProps> = ({ onBackToHome }) => {
  const [tab, setTab] = useState<'video' | 'audio'>('video');
  const [prompt, setPrompt] = useState('مقطع فيديو سينمائي لدوران كوكب رقمي محاط بحلقات نيون');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVoiceText, setGeneratedVoiceText] = useState('مرحباً بك في المحرك الصوتي الذكي.');

  const handleGenerateMedia = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 1800);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-4xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setTab('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
              tab === 'video' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>إنشاء فيديو</span>
          </button>
          <button
            onClick={() => setTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
              tab === 'audio' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>إنشاء صوت</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div>
          <label className="text-xs text-slate-300 font-bold block mb-2">
            {tab === 'video' ? 'وصف سيناريو الفيديو المطلوب:' : 'النص المطلوب تحويله إلى صوت نقي:'}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500/50 resize-none"
          />
        </div>

        <button
          onClick={handleGenerateMedia}
          disabled={isGenerating}
          className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isGenerating ? 'جاري المعالجة التوليدية...' : tab === 'video' ? 'إنشاء مقطع الفيديو' : 'توليد الصوت الآن'}</span>
        </button>

        {/* Studio Preview Output */}
        <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center">
          {tab === 'video' ? (
            <div className="space-y-3">
              <Film className="w-12 h-12 text-cyan-400 mx-auto animate-pulse" />
              <h4 className="text-sm font-bold text-white">استوديو إنتاج الفيديو</h4>
              <p className="text-xs text-slate-400 max-w-md">
                معاينة الإطارات المتسلسلة للفيديو التوليدي بدقة 1080p بمعدل 30 إطار/ثانية
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Music className="w-12 h-12 text-purple-400 mx-auto animate-pulse" />
              <h4 className="text-sm font-bold text-white">استوديو التوليد الصوتي</h4>
              <p className="text-xs text-slate-400 max-w-md">
                محرك صوتي عالي النقاء 24kHz بدون تشويش أو فرقعة
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
