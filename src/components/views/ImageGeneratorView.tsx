import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface ImageGeneratorViewProps {
  onBackToHome: () => void;
}

export const ImageGeneratorView: React.FC<ImageGeneratorViewProps> = ({ onBackToHome }) => {
  const [prompt, setPrompt] = useState('شاشة مستقبلية مضيئة للذكاء الاصطناعي مع دوائر نيون زرقاء');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);

    try {
      const res = await fetch('/api/media/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          setCurrentImage(data.imageUrl);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `kernel_image_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

        <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
          <ImageIcon className="w-4 h-4 text-purple-400" />
          <span>استوديو توليد وتصميم الصور</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Controls */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-bold block mb-2">
              اكتب وصف الصورة أو تحدث بالمايك:
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="صف الصورة التي تريد توليدها بدقة..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5 font-mono">أبعاد الصورة:</label>
            <div className="flex items-center gap-2">
              {['1:1', '16:9', '9:16', '4:3'].map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono cursor-pointer transition-colors ${
                    aspectRatio === r
                      ? 'bg-purple-500 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-2xl shadow-xl shadow-purple-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري توليد الصورة...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>توليد الصورة الآن</span>
              </>
            )}
          </button>
        </div>

        {/* Preview Canvas */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-4 flex flex-col items-center justify-center">
          {currentImage ? (
            <div className="w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col items-center">
              <img src={currentImage} alt="Generated" className="w-full max-h-80 object-contain rounded-xl" />
              <div className="w-full p-3 flex items-center justify-between border-t border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono">نسبة العرض: {aspectRatio}</span>
                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل الصورة</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs">
              لم يتم توليد صورة بعد. اضغط على "توليد الصورة الآن".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
