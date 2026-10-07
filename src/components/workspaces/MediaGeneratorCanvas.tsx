import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Ratio,
  Maximize2,
  RefreshCw,
  Sliders,
  Layers,
  Check,
} from 'lucide-react';

interface GeneratedMediaItem {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: string;
  timestamp: string;
}

export const MediaGeneratorCanvas: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('Holographic quantum AI core in a cyberpunk terminal with glowing cyan and purple telemetry rings');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [gallery, setGallery] = useState<GeneratedMediaItem[]>([
    {
      id: 'default_1',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      prompt: 'Neon cybernetic neural core with holographic volumetric pulse',
      aspectRatio: '1:1',
      timestamp: 'Just now',
    },
    {
      id: 'default_2',
      url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
      prompt: 'High tech server rack matrix with liquid cooling glow',
      aspectRatio: '16:9',
      timestamp: '5 min ago',
    },
  ]);
  const [selectedMedia, setSelectedMedia] = useState<GeneratedMediaItem | null>(gallery[0]);

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
          const newItem: GeneratedMediaItem = {
            id: `media_${Date.now()}`,
            url: data.imageUrl,
            prompt: prompt.trim(),
            aspectRatio,
            timestamp: new Date().toLocaleTimeString(),
          };
          setGallery((prev) => [newItem, ...prev]);
          setSelectedMedia(newItem);
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (item: GeneratedMediaItem) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `kernel_synth_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Media Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-950/60 border border-purple-500/30 rounded-lg text-xs font-mono text-purple-300">
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Media Studio Canvas</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Gemini Vision Synthesizer</span>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 px-1">Ratio:</span>
          {['1:1', '16:9', '9:16', '4:3'].map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={`px-2 py-0.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                aspectRatio === ratio
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Prompt Controls & Presets */}
        <div className="w-96 border-r border-slate-800 p-4 flex flex-col justify-between bg-slate-900/30 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-slate-400 mb-1.5 block">
                Visual Synthesis Prompt (Voice or Text)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Describe your desired UI asset, futuristic visual, or diagram..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 resize-none font-arabic"
              />
            </div>

            {/* Quick Prompt Presets */}
            <div>
              <span className="text-[11px] font-mono text-slate-400 mb-2 block">
                Synthetic Presets:
              </span>
              <div className="space-y-1.5">
                {[
                  'سويلي صورة شاشة سايبربانك مع عدادات طاقة',
                  'Futuristic holographic AI engine core',
                  'Minimalist dark SaaS dashboard wireframe',
                  '3D dynamic audio frequency waveform landscape',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(preset)}
                    className="w-full text-left p-2 rounded-lg bg-slate-950/80 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-500/30 text-[11px] text-slate-300 hover:text-purple-200 transition-colors cursor-pointer font-arabic"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synthesizing Canvas...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Synthesize Visual Asset</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Preview & History Gallery */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-slate-950">
          {selectedMedia ? (
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="relative group max-w-2xl max-h-[500px] rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl bg-slate-900">
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.prompt}
                  className="w-full h-full object-contain max-h-[460px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                  <p className="text-xs text-white font-arabic line-clamp-2">{selectedMedia.prompt}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800">
                    <span className="text-[10px] font-mono text-purple-400">
                      Ratio: {selectedMedia.aspectRatio} | {selectedMedia.timestamp}
                    </span>
                    <button
                      onClick={() => handleDownload(selectedMedia)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Save PNG
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-mono">
              Select or generate a visual asset to preview
            </div>
          )}

          {/* Asset Gallery Strip */}
          <div className="mt-auto pt-4 border-t border-slate-800">
            <span className="text-xs font-mono text-slate-400 mb-2 block">
              Asset Gallery ({gallery.length})
            </span>
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {gallery.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedMedia(item)}
                  className={`w-24 h-24 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    selectedMedia?.id === item.id
                      ? 'border-purple-400 scale-105 shadow-lg shadow-purple-500/20'
                      : 'border-slate-800 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
