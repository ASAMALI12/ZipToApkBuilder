import React, { useState } from 'react';
import {
  Smartphone,
  Apple,
  Globe,
  ArrowRight,
  Code2,
  Play,
  Copy,
  Check,
  Download,
  Sparkles,
} from 'lucide-react';

interface AppBuilderViewProps {
  onBackToHome: () => void;
}

export const AppBuilderView: React.FC<AppBuilderViewProps> = ({ onBackToHome }) => {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'react'>('android');
  const [copied, setCopied] = useState(false);
  const [activeCounter, setActiveCounter] = useState(1);

  const androidCode = `package com.kernel.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            KernelAndroidApp()
        }
    }
}

@Composable
fun KernelAndroidApp() {
    var count by remember { mutableStateOf(1) }
    
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("⚡ تطبيق أندرويد بنواة الذكاء", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = { count++ }) {
            Text("الضغطات: \$count")
        }
    }
}`;

  const iosCode = `import SwiftUI

@main
struct KernelApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @State private var count = 1
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "cpu.fill")
                .font(.system(size: 60))
                .foregroundColor(.cyan)
            Text("تطبيق آيفون مخصص")
                .font(.title)
                .bold()
            Button(action: { count += 1 }) {
                Text("عداد النواة: \\(count)")
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
        }
        .padding()
    }
}`;

  const reactCode = `import React, { useState } from 'react';

export default function MobileWebApp() {
  const [count, setCount] = useState(1);
  return (
    <div className="p-6 bg-slate-950 text-white rounded-2xl border border-cyan-500/30">
      <h2 className="text-lg font-bold text-cyan-400">تطبيق ويب ذكي</h2>
      <button 
        onClick={() => setCount(c => c + 1)}
        className="mt-4 px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-xl"
      >
        النقرات: {count}
      </button>
    </div>
  );
}`;

  const currentCode = platform === 'android' ? androidCode : platform === 'ios' ? iosCode : reactCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-20 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>

        {/* Platform Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setPlatform('android')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              platform === 'android' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>أندرويد (Android)</span>
          </button>
          <button
            onClick={() => setPlatform('ios')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              platform === 'ios' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>آيفون (iOS)</span>
          </button>
          <button
            onClick={() => setPlatform('react')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              platform === 'react' ? 'bg-purple-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>React Web</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Code Editor & Device Simulator */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        {/* Code Editor */}
        <div className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
            <span className="font-mono text-cyan-300 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              {platform === 'android' ? 'MainActivity.kt (Jetpack Compose)' : platform === 'ios' ? 'ContentView.swift (SwiftUI)' : 'App.tsx'}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
            </button>
          </div>
          <textarea
            value={currentCode}
            readOnly
            className="flex-1 p-4 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none selection:bg-cyan-500/30 overflow-auto"
            rows={18}
          />
        </div>

        {/* Device Live Simulator */}
        <div className="flex flex-col items-center justify-center bg-slate-900/40 border border-slate-800 rounded-3xl p-6">
          <div className="w-72 h-[480px] bg-slate-950 rounded-[40px] border-4 border-slate-700 p-4 shadow-2xl flex flex-col justify-between relative overflow-hidden">
            {/* Phone Notch */}
            <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-4" />

            {/* Simulated UI */}
            <div className="flex-1 flex flex-col items-center justify-center text-center p-3 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-cyan-400 animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-white">
                {platform === 'android' ? 'تطبيق أندرويد مباشر' : platform === 'ios' ? 'تطبيق آيفون مباشر' : 'تطبيق الويب'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                معاينة حية لواجهة المستخدم المبرمجة بالذكاء الاصطناعي
              </p>

              <button
                onClick={() => setActiveCounter((c) => c + 1)}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
              >
                النقرات التفاعلية: {activeCounter}
              </button>
            </div>

            {/* Phone Bottom Bar */}
            <div className="w-20 h-1 bg-slate-600 rounded-full mx-auto mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
};
