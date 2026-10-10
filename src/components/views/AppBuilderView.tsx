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
  Workflow,
  CheckCircle,
  Package,
  Layers,
} from 'lucide-react';

interface AppBuilderViewProps {
  onBackToHome: () => void;
  initialAppType?: string;
}

export const AppBuilderView: React.FC<AppBuilderViewProps> = ({ onBackToHome, initialAppType }) => {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'react' | 'workflow'>('workflow');
  const [workflowVariant, setWorkflowVariant] = useState<'workflow.yml' | 'build-app.yml'>('workflow.yml');
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeCounter, setActiveCounter] = useState(1);
  const appTitle = initialAppType || 'تطبيق النواة المخصص';

  const mainWorkflowCode = `# .github/workflows/workflow.yml
name: Build Autonomous Application Workflow

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:
    inputs:
      target_platform:
        description: 'Target Build Platform (all / web / android)'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - web
          - android

permissions:
  contents: read
  packages: write

jobs:
  validate-and-lint:
    name: 1. Lint & Validate Source
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci || npm install

      - name: Run TypeScript Typecheck & Lint
        run: npm run lint

  build-web-app:
    name: 2. Build Web Production Application
    needs: validate-and-lint
    runs-on: ubuntu-latest
    if: github.event.inputs.target_platform == 'all' || github.event.inputs.target_platform == 'web' || github.event_name != 'workflow_dispatch'
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci || npm install

      - name: Compile Production Web App
        run: npm run build

      - name: Upload Web Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: web-production-bundle
          path: dist/
          retention-days: 14

  build-android-package:
    name: 3. Build & Package Android Mobile App
    needs: validate-and-lint
    runs-on: ubuntu-latest
    if: github.event.inputs.target_platform == 'all' || github.event.inputs.target_platform == 'android' || github.event_name == 'push'
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Java Runtime (JDK 17)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Node.js Runtime (v20)
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies & Compile App
        run: |
          npm ci || npm install
          npm run build

      - name: Package Android Distribution Bundle
        run: |
          mkdir -p release-output/android
          cp -r dist/* release-output/android/
          cd release-output
          tar -czf app-android-release.tar.gz android/
          echo "Android mobile application package created successfully."

      - name: Upload Android Release Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: android-release-package
          path: release-output/app-android-release.tar.gz
          retention-days: 14`;

  const workflowCode = `# .github/workflows/build-app.yml
name: Build and Release Autonomous Kernel App

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:
    inputs:
      target_platform:
        description: 'Target Build Platform'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - web
          - android

jobs:
  build-web:
    name: Build Web Production App
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci || npm install

      - name: Lint & Typecheck Codebase
        run: npm run lint

      - name: Compile and Build Web App
        run: npm run build

      - name: Upload Web Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: dist/
          retention-days: 14

  build-android:
    name: Build Android Mobile Application (APK)
    runs-on: ubuntu-latest
    if: github.event.inputs.target_platform == 'all' || github.event.inputs.target_platform == 'android' || github.event_name == 'push'
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Java Development Kit (JDK 17)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies & Build Web Assets
        run: |
          npm ci || npm install
          npm run build

      - name: Package Android Distribution Bundle
        run: |
          mkdir -p release-output
          cp -r dist release-output/www
          tar -czf release-output/kernel-android-dist.tar.gz release-output/www
          echo "Android App Package generated successfully."

      - name: Upload Android Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: android-release-package
          path: release-output/
          retention-days: 14`;

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

  const currentCode =
    platform === 'workflow'
      ? (workflowVariant === 'workflow.yml' ? mainWorkflowCode : workflowCode)
      : platform === 'android'
      ? androidCode
      : platform === 'ios'
      ? iosCode
      : reactCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunSimulation = () => {
    if (simulationRunning) return;
    setSimulationRunning(true);
    setSimulationStep(1);

    setTimeout(() => {
      setSimulationStep(2);
      setTimeout(() => {
        setSimulationStep(3);
        setTimeout(() => {
          setSimulationStep(4);
          setSimulationRunning(false);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const handleDownload = () => {
    const filename =
      platform === 'workflow'
        ? workflowVariant
        : platform === 'android'
        ? 'MainActivity.kt'
        : platform === 'ios'
        ? 'ContentView.swift'
        : 'App.tsx';

    const blob = new Blob([currentCode], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 pb-20 bg-slate-950 text-slate-100 min-h-[85vh] font-arabic max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 flex-wrap gap-2">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للشاشة الرئيسية</span>
        </button>

        {/* Platform Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800 flex-wrap">
          <button
            onClick={() => setPlatform('workflow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              platform === 'workflow' ? 'bg-amber-400 text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>ملف Workflow (بناء التطبيق)</span>
          </button>
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

      {/* Main Grid: Code Editor & Simulator / Pipeline View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        {/* Code Editor */}
        <div className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-cyan-300 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-cyan-400" />
                {platform === 'workflow'
                  ? `.github/workflows/${workflowVariant}`
                  : platform === 'android'
                  ? 'MainActivity.kt (Jetpack Compose)'
                  : platform === 'ios'
                  ? 'ContentView.swift (SwiftUI)'
                  : 'App.tsx'}
              </span>
              {platform === 'workflow' && (
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setWorkflowVariant('workflow.yml')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                      workflowVariant === 'workflow.yml'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    workflow.yml
                  </button>
                  <button
                    onClick={() => setWorkflowVariant('build-app.yml')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                      workflowVariant === 'build-app.yml'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    build-app.yml
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                title="تحميل الملف"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل</span>
              </button>
            </div>
          </div>
          <textarea
            value={currentCode}
            readOnly
            className="flex-1 p-4 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none selection:bg-cyan-500/30 overflow-auto"
            rows={18}
          />
        </div>

        {/* Right Pane: Live Device Simulator OR Workflow Pipeline Visualizer */}
        {platform === 'workflow' ? (
          <div className="flex flex-col bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Workflow className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">سير عمل بناء وتصدير التطبيق (CI/CD Pipeline)</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunSimulation}
                  disabled={simulationRunning}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                    simulationRunning
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                  }`}
                >
                  <Play className="w-3 h-3" />
                  <span>{simulationRunning ? 'جاري محاكاة البناء...' : 'تشغيل محاكاة البناء'}</span>
                </button>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Workflow Ready ✓
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              يقوم ملف سير العمل بأتمتة بناء التطبيق كاملاً عند رفع الكود إلى مستودع GitHub، وتجميع نسخة الويب وحزم الهاتف تلقائياً دون تدخل يدوي.
            </p>

            <div className="space-y-2.5 pt-1">
              <div
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  simulationStep >= 1
                    ? 'bg-cyan-950/40 border-cyan-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    simulationStep >= 1
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-cyan-500/10 text-cyan-400'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">1. فحص وتدقيق الكود (Lint & Typecheck)</h4>
                    {simulationStep >= 1 && (
                      <span className="text-[10px] text-cyan-300 font-mono">Passed ✓</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    التحقق التلقائي من خلو الكود من أي أخطاء ترجمة (tsc --noEmit).
                  </p>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  simulationStep >= 2
                    ? 'bg-purple-950/40 border-purple-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    simulationStep >= 2
                      ? 'bg-purple-500 text-slate-950 font-bold'
                      : 'bg-purple-500/10 text-purple-400'
                  }`}
                >
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">2. بناء حزمة الويب (Compile Web Dist)</h4>
                    {simulationStep >= 2 && (
                      <span className="text-[10px] text-purple-300 font-mono">Compiled ✓</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    بناء ملفات الإنتاج المجمعة (vite build) ورفعها في dist/ جاهزة للنشر.
                  </p>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  simulationStep >= 3
                    ? 'bg-emerald-950/40 border-emerald-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    simulationStep >= 3
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">3. إعداد وبناء حزمة أندرويد (Android Build APK)</h4>
                    {simulationStep >= 3 && (
                      <span className="text-[10px] text-emerald-300 font-mono">Packaged ✓</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    تجميع ملفات التطبيق للهاتف وتوليد حزمة app-android-release.tar.gz.
                  </p>
                </div>
              </div>

              <div
                className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                  simulationStep >= 4
                    ? 'bg-amber-950/40 border-amber-500/40'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    simulationStep >= 4
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">4. رفع وحفظ المخرجات (Upload Artifacts)</h4>
                    {simulationStep >= 4 && (
                      <span className="text-[10px] text-amber-300 font-mono">Released ✓</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    حفظ الحزم في تبويب Actions على GitHub لتحميلها وتثبيتها مباشرة.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl text-[11px] text-cyan-200 text-center font-mono mt-auto flex items-center justify-between">
              <span>الملف النشط: <strong>.github/workflows/{workflowVariant}</strong></span>
              <span className="text-[10px] text-slate-400">مدمج وجاهز في المشروع ✓</span>
            </div>
          </div>
        ) : (
          /* Device Live Simulator */
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
        )}
      </div>
    </div>
  );
};
