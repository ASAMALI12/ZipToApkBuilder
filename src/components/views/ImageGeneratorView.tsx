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
  initialPrompt?: string;
}

export const ImageGeneratorView: React.FC<ImageGeneratorViewProps> = ({ onBackToHome, initialPrompt }) => {
  const [prompt, setPrompt] = useState(
    initialPrompt || 'شاشة مستقبلية مضيئة للذكاء الاصطناعي مع دوائر نيون زرقاء'
  );
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(() => {
    // Elegant Cyberpunk Vector Initial Canvas
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <radialGradient id="g" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#090d16" stop-opacity="0.1"/>
        </radialGradient>
      </defs>
      <rect width="600" height="600" fill="#030712"/>
      <circle cx="300" cy="300" r="180" fill="url(#g)"/>
      <circle cx="300" cy="300" r="230" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6,8" opacity="0.4"/>
      <path d="M150 300 L450 300 M300 150 L300 450" stroke="#00f5d4" stroke-width="1.5" opacity="0.5"/>
      <text x="300" y="295" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">THE KERNEL SYNTH STUDIO</text>
      <text x="300" y="325" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="12">جاهز لتوليد التصاميم والصور الذكية</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  });

  const handleGenerate = async (customText?: string) => {
    const textToUse = (customText || prompt).trim();
    if (!textToUse || isGenerating) return;
    setIsGenerating(true);
    setGenerationNotice(null);

    try {
      const res = await fetch('/api/media/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textToUse, aspectRatio }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.imageUrl) {
          setCurrentImage(data.imageUrl);
          if (data.notice) {
            setGenerationNotice(data.notice);
          }
        }
      }
    } catch (err) {
      console.warn('[ImageGenerator] Generate notice:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setPrompt(initialPrompt.trim());
      handleGenerate(initialPrompt.trim());
    }
  }, [initialPrompt]);

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
            onClick={() => handleGenerate()}
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
              <img
                src={currentImage}
                alt="Generated"
                referrerPolicy="no-referrer"
                className="w-full max-h-80 object-contain rounded-xl"
              />
              {generationNotice && (
                <div className="w-full px-3 py-2 bg-purple-950/40 border-t border-purple-500/30 text-[11px] text-purple-200 text-center">
                  {generationNotice}
                </div>
              )}
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
