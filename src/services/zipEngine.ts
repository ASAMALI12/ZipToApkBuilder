import JSZip from 'jszip';
import { ProjectFile, KernelMemoryLog } from '../types/kernel';

export interface CachedKernelContext {
  kernelName: string;
  version: string;
  rules: string[];
  instructions: string[];
  summaryContext: string;
  filesCount: number;
  isLoaded: boolean;
  timestamp: string;
}

// In-Memory Kernel Cache: stores extracted instructions & rules once per session
let inMemoryZipKernelContext: CachedKernelContext | null = null;

/**
 * Extracts a local .zip file in-memory and returns indexed ProjectFiles
 */
export async function unpackZipFile(file: File | Blob | ArrayBuffer): Promise<ProjectFile[]> {
  const zip = new JSZip();
  let loadedZip: JSZip;

  if (file instanceof File || file instanceof Blob) {
    loadedZip = await zip.loadAsync(file);
  } else {
    loadedZip = await zip.loadAsync(file);
  }

  const files: ProjectFile[] = [];
  const entries = Object.keys(loadedZip.files);

  if (entries.length === 0) {
    throw new Error('الملف المضغوط فارغ ولا يحتوي على أي ملفات صالحة للنواة.');
  }

  for (const filename of entries) {
    const zipEntry = loadedZip.files[filename];
    if (zipEntry.dir) continue; // skip directory entries

    // Check if text or binary
    const isBinary = /\.(png|jpg|jpeg|gif|webp|ico|svg|wasm|bin|pdf|zip|tar|gz)$/i.test(filename);

    if (isBinary) {
      files.push({
        name: filename.split('/').pop() || filename,
        path: filename,
        content: '[Binary File Content]',
        isBinary: true,
      });
    } else {
      const text = await zipEntry.async('string');
      files.push({
        name: filename.split('/').pop() || filename,
        path: filename,
        content: text,
        size: text.length,
        isBinary: false,
      });
    }
  }

  return files;
}

/**
 * Session Initialization: Unpacks Kernel ZIP once, parses rules and instructions,
 * and caches them directly in-memory for zero-latency queries without re-reading.
 */
export async function initOrExtractZipKernel(
  fileOrBlob: File | Blob | ArrayBuffer,
  fileNameHint: string = 'kernel.zip'
): Promise<CachedKernelContext> {
  const files = await unpackZipFile(fileOrBlob);
  let kernelName = fileNameHint.replace(/\.[^/.]+$/, '') || 'QuantumKernel';
  let version = '3.4.0';
  const rules: string[] = [];
  const instructions: string[] = [];
  let summaryContext = '';

  // Look for manifest or configuration files inside the zip
  const manifestFile = files.find((f) => /manifest|kernel.*config|core.*config/i.test(f.path));
  if (manifestFile && !manifestFile.isBinary) {
    try {
      const parsed = JSON.parse(manifestFile.content);
      if (parsed.projectName) kernelName = parsed.projectName;
      if (parsed.kernelVersion) version = parsed.kernelVersion;
      if (Array.isArray(parsed.rules)) rules.push(...parsed.rules);
      if (Array.isArray(parsed.instructions)) instructions.push(...parsed.instructions);
    } catch {}
  }

  // Look for memory logs or rules text files
  const rulesFile = files.find((f) => /rule|memory|instruction|readme/i.test(f.path));
  if (rulesFile && !rulesFile.isBinary) {
    const lines = rulesFile.content.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines.slice(0, 20)) {
      const cleanLine = line.replace(/^[#\-*//\s]+/, '').trim();
      if (cleanLine.length > 3 && !rules.includes(cleanLine)) {
        rules.push(cleanLine);
      }
    }
  }

  if (rules.length === 0) {
    rules.push('نواة النظام متصلة وجاهزة لتنفيذ الأوامر الذكية.');
    rules.push('توجيه الأوامر الصوتية إلى مسارات العمل المحددة فوراً.');
  }

  summaryContext = `النواة المربوطة: ${kernelName} (الإصدار ${version}). القواعد والتوجيهات: ${rules.join(' | ')}`;

  inMemoryZipKernelContext = {
    kernelName,
    version,
    rules,
    instructions,
    summaryContext,
    filesCount: files.length,
    isLoaded: true,
    timestamp: new Date().toISOString(),
  };

  return inMemoryZipKernelContext;
}

/**
 * Returns in-memory cached kernel context without re-reading or re-unzipping
 */
export function getInMemoryZipKernelContext(): CachedKernelContext | null {
  return inMemoryZipKernelContext;
}

/**
 * Clears or resets in-memory kernel context
 */
export function clearZipKernelCache(): void {
  inMemoryZipKernelContext = null;
}

/**
 * Section 5.1: Full Kernel state export
 * Serializes memory context, instructions, and workspace state into a downloadable .zip package
 */
export async function exportKernelStateZip(options: {
  projectName: string;
  files: ProjectFile[];
  memoryLogs: KernelMemoryLog[];
  dynamicUISchema?: any;
}): Promise<Blob> {
  const zip = new JSZip();

  // 1. Add Kernel Manifest
  const manifest = {
    kernelVersion: '3.4.0-autonomous',
    exportTimestamp: new Date().toISOString(),
    projectName: options.projectName,
    totalFiles: options.files.length,
    totalMemoryItems: options.memoryLogs.length,
    audioArchitecture: {
      sampleRate: 24000,
      dspWebRTC: 'echoCancellation + noiseSuppression + autoGainControl',
      vadSilenceDuration: '600ms - 800ms',
    },
    schema: options.dynamicUISchema || null,
  };

  zip.file('kernel-manifest.json', JSON.stringify(manifest, null, 2));

  // 2. Add Memory Logs (Instruction History)
  zip.file(
    'kernel-memory.json',
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        instructionLogs: options.memoryLogs,
      },
      null,
      2
    )
  );

  // 3. Add Project Source Files
  const srcFolder = zip.folder('src');
  for (const f of options.files) {
    if (f.isBinary) continue;
    // Normalize path
    const cleanPath = f.path.startsWith('src/') ? f.path.substring(4) : f.path;
    srcFolder?.file(cleanPath, f.content);
  }

  // Generate downloadable Blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

/**
 * Helper to download any generated blob as a file in the browser
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
