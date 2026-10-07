import JSZip from 'jszip';
import { ProjectFile, KernelMemoryLog } from '../types/kernel';

/**
 * Extracts a local .zip file in-memory and returns indexed ProjectFiles
 */
export async function unpackZipFile(file: File): Promise<ProjectFile[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  const files: ProjectFile[] = [];

  const entries = Object.keys(loadedZip.files);

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
      antiPopRamping: '30ms exponential',
      vadBargeInTarget: '<150ms',
      dspWebRTC: 'echoCancellation + noiseSuppression + autoGainControl',
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
