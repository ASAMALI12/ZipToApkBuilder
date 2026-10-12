import { BoundKernel } from '../types/kernel';
import { StorageEngine } from './storageEngine';
import { initOrExtractZipKernel } from './zipEngine';
import { getApiUrl } from './apiConfig';

/**
 * KernelBridge: Clean, transparent linking bridge between the user device and the smart Kernel.
 * Binds ZIP, JSON, or text rule files and ensures seamless persistence across sessions.
 */
export class KernelBridge {
  public static async bindKernelFile(file: File): Promise<BoundKernel> {
    if (!file || file.size === 0) {
      throw new Error('الملف المختار فارغ. يرجى اختيار ملف نواة صالح.');
    }

    let extractedName = file.name.replace(/\.[^/.]+$/, '') || 'QuantumKernel';
    let extractedVersion = '1.0.0-core';
    let extractedRules: string[] = [];
    let extractedInstructions: string[] = [];
    let rawSnippet = '';

    const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');

    if (isZip) {
      const cached = await initOrExtractZipKernel(file, file.name);
      extractedName = cached.kernelName;
      extractedVersion = cached.version;
      extractedRules = cached.rules;
      extractedInstructions = cached.instructions;
      rawSnippet = cached.summaryContext;
    } else {
      const text = await file.text();
      if (!text || text.trim().length === 0) {
        throw new Error('الملف فارغ ولا يحتوي على نصوص برمجية للنواة.');
      }
      rawSnippet = text.slice(0, 5000);

      try {
        const json = JSON.parse(text);
        extractedName = json.name || json.kernelName || extractedName;
        extractedVersion = json.version || extractedVersion;
        if (Array.isArray(json.rules)) extractedRules = json.rules;
        if (Array.isArray(json.instructions)) extractedInstructions = json.instructions;
        if (Array.isArray(json.capabilities)) {
          extractedRules.push(...json.capabilities.map((c: any) => `القدرة: ${c}`));
        }
      } catch {
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        extractedRules = lines
          .filter((l) => l.startsWith('#') || l.startsWith('//') || l.includes('rule') || l.includes('instruction'))
          .slice(0, 20)
          .map((l) => l.replace(/^[#//*\s]+/, ''));

        if (extractedRules.length === 0) {
          extractedRules = [
            `معالجة أوامر ملف: ${file.name}`,
            'تشغيل التعليمات التلقائية المدمجة',
          ];
        }
      }
    }

    if (extractedRules.length === 0) {
      extractedRules = ['النواة متصلة وتعمل بكامل الصلاحيات والمعلومات المخزنة'];
    }

    const bound: BoundKernel = {
      fileName: file.name,
      fileSize: file.size,
      bindTimestamp: new Date().toLocaleTimeString('ar-SA'),
      name: extractedName,
      version: extractedVersion,
      rules: extractedRules,
      instructions: extractedInstructions,
      rawContent: rawSnippet,
      isActive: true,
    };

    // Save to persistent browser storage
    StorageEngine.saveBoundKernel(bound);

    // Sync context directly with server memory
    try {
      await fetch(getApiUrl('/api/kernel/session-init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kernelName: extractedName,
          rules: extractedRules,
          instructions: extractedInstructions,
          summaryContext: `النواة المربوطة: ${extractedName} (${extractedVersion}). القواعد: ${extractedRules.join(' | ')}`,
        }),
      });
    } catch (e) {
      console.warn('[KernelBridge] Background session sync notice:', e);
    }

    return bound;
  }
}
