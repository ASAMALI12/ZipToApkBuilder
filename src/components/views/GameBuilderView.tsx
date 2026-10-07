import React, { useRef, useEffect, useState } from 'react';
import { Gamepad2, ArrowRight, RotateCcw, Play, Trophy, Sparkles, Volume2 } from 'lucide-react';

interface GameBuilderViewProps {
  onBackToHome: () => void;
}

export const GameBuilderView: React.FC<GameBuilderViewProps> = ({ onBackToHome }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Game state refs
  const stateRef = useRef({
    playerX: 160,
    playerY: 340,
    playerSpeed: 7,
    hazards: [] as Array<{ x: number; y: number; speed: number; size: number }>,
    score: 0,
    gameOver: false,
    gameStarted: false,
    keys: { left: false, right: false },
  });

  const startGame = () => {
    stateRef.current = {
      playerX: 160,
      playerY: 340,
      playerSpeed: 7,
      hazards: [],
      score: 0,
      gameOver: false,
      gameStarted: true,
      keys: { left: false, right: false },
    };
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') stateRef.current.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') stateRef.current.keys.right = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') stateRef.current.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') stateRef.current.keys.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameCount = 0;

    const loop = () => {
      const state = stateRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // Clear Canvas
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, width, height);

      // Starfield background
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 20; i++) {
        const sx = (i * 37 + frameCount * 0.5) % width;
        const sy = (i * 53 + frameCount * 1.5) % height;
        ctx.fillRect(sx, sy, 2, 2);
      }

      if (state.gameStarted && !state.gameOver) {
        frameCount++;

        // Update player movement
        if (state.keys.left && state.playerX > 15) state.playerX -= state.playerSpeed;
        if (state.keys.right && state.playerX < width - 35) state.playerX += state.playerSpeed;

        // Spawn hazards
        if (frameCount % 30 === 0) {
          state.hazards.push({
            x: Math.random() * (width - 30) + 10,
            y: -20,
            speed: Math.random() * 2 + 3 + Math.floor(state.score / 50),
            size: Math.random() * 12 + 16,
          });
        }

        // Update hazards
        for (let i = state.hazards.length - 1; i >= 0; i--) {
          const h = state.hazards[i];
          h.y += h.speed;

          // Collision check
          if (
            h.x < state.playerX + 22 &&
            h.x + h.size > state.playerX &&
            h.y < state.playerY + 22 &&
            h.y + h.size > state.playerY
          ) {
            state.gameOver = true;
            setGameOver(true);
            setHighScore((prev) => Math.max(prev, state.score));
          }

          // Offscreen check
          if (h.y > height) {
            state.hazards.splice(i, 1);
            state.score += 10;
            setScore(state.score);
          }
        }
      }

      // Draw hazards
      for (const h of state.hazards) {
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw Player
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(state.playerX + 12, state.playerY);
      ctx.lineTo(state.playerX + 24, state.playerY + 24);
      ctx.lineTo(state.playerX + 12, state.playerY + 18);
      ctx.lineTo(state.playerX, state.playerY + 24);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-4xl mx-auto w-full items-center">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
          <Gamepad2 className="w-4 h-4 text-cyan-400" />
          <span>استوديو إنشاء ولعب الألعاب</span>
        </div>
      </div>

      {/* Game Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col items-center backdrop-blur-xl">
        {/* Score Header */}
        <div className="w-full flex items-center justify-between mb-3 px-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>النقاط: {score}</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400">
            <Trophy className="w-4 h-4" />
            <span>أعلى نتيجة: {highScore}</span>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner">
          <canvas ref={canvasRef} width={340} height={380} className="block" />

          {/* Start Screen Overlay */}
          {!gameStarted && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4 text-center">
              <Gamepad2 className="w-12 h-12 text-cyan-400 mb-2 animate-bounce" />
              <h3 className="text-base font-bold text-white mb-1">لعبة النواة الفضائية</h3>
              <p className="text-xs text-slate-400 mb-4">
                تحكم بالسفينة وتجنب النيازك الحمراء باستخدام الأسهم أو أزرار اللمس
              </p>
              <button
                onClick={startGame}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
              >
                ابدأ اللعب الآن
              </button>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-rose-950/90 flex flex-col items-center justify-center p-4 text-center">
              <h3 className="text-lg font-bold text-rose-300 mb-1">انتهت اللعبة!</h3>
              <p className="text-xs text-slate-200 mb-4 font-mono">مجموع نقاطك: {score}</p>
              <button
                onClick={startGame}
                className="px-6 py-2.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Touch Controls */}
        <div className="flex items-center justify-between w-full mt-4 px-4 gap-4">
          <button
            onPointerDown={() => (stateRef.current.keys.left = true)}
            onPointerUp={() => (stateRef.current.keys.left = false)}
            className="flex-1 py-3 bg-slate-800 active:bg-cyan-500/30 text-white rounded-2xl text-sm font-bold border border-slate-700 select-none cursor-pointer"
          >
            ← يسار
          </button>
          <button
            onPointerDown={() => (stateRef.current.keys.right = true)}
            onPointerUp={() => (stateRef.current.keys.right = false)}
            className="flex-1 py-3 bg-slate-800 active:bg-cyan-500/30 text-white rounded-2xl text-sm font-bold border border-slate-700 select-none cursor-pointer"
          >
            يمين →
          </button>
        </div>
      </div>
    </div>
  );
};
