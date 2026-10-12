import { ProjectFile, KernelMemoryLog, BoundKernel } from '../types/kernel';

const STORAGE_KEYS = {
  BOUND_KERNEL: 'kernel_bound_core_v1',
  LEARNED_KNOWLEDGE: 'kernel_learned_knowledge_v1',
};

export interface InMemoryKernelState {
  kernelName: string;
  version: string;
  rules: string[];
  instructions: string[];
  summaryContext: string;
  isLoaded: boolean;
  timestamp: string;
}

let inMemoryKernelState: InMemoryKernelState | null = null;

export class StorageEngine {
  public static initSessionKernelContext(kernel: BoundKernel | null): InMemoryKernelState {
    if (!kernel) {
      inMemoryKernelState = {
        kernelName: 'نواة الذكاء الذاتية',
        version: '4.2.0',
        rules: ['النواة الافتراضية متصلة وجاهزة لتلقي الأسئلة والأوامر'],
        instructions: ['أنت النواة الذكية، صوت وعقل ومستودع المعرفة.'],
        summaryContext: 'نواة النظام تعمل بالوضع الافتراضي.',
        isLoaded: false,
        timestamp: new Date().toISOString(),
      };
      return inMemoryKernelState;
    }

    const rules = kernel.rules || [];
    const instructions = kernel.instructions || [];
    const summary = `النواة: ${kernel.name} (${kernel.version}). القواعد: ${rules.slice(0, 10).join(' | ')}`;

    inMemoryKernelState = {
      kernelName: kernel.name,
      version: kernel.version,
      rules,
      instructions,
      summaryContext: summary,
      isLoaded: true,
      timestamp: new Date().toISOString(),
    };

    return inMemoryKernelState;
  }

  public static getInMemoryKernelContext(): InMemoryKernelState | null {
    if (!inMemoryKernelState) {
      const bound = StorageEngine.loadBoundKernel();
      return StorageEngine.initSessionKernelContext(bound);
    }
    return inMemoryKernelState;
  }

  public static setInMemoryKernelContext(state: InMemoryKernelState | null): void {
    inMemoryKernelState = state;
  }

  public static getDefaultKernel(): BoundKernel {
    return {
      fileName: 'autonomous_core_kernel.json',
      fileSize: 4096,
      bindTimestamp: new Date().toISOString(),
      name: 'نواة الذكاء الذاتية',
      version: '4.2.0-core',
      rules: [
        'الإجابة على كافة الأسئلة والمحادثات بدقة وسرعة من خلال النواة',
        'الاستماع المستمر للمستخدم والتفاعل الصوتي والدردشة الكتابية',
        'تخزين وتطوير معلومات النواة دون الحاجة لتغيير التطبيق',
      ],
      instructions: [
        'أنت النواة الذكية المستقلة التي تدير كل شيء.',
        'تحدث دائماً بصفة النواة الذكية بأسلوب مباشر ومفيد.',
      ],
      rawContent: 'نواة الذكاء الذاتية - العقل المستقل الشامل',
      isActive: true,
    };
  }

  public static loadBoundKernel(): BoundKernel {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOUND_KERNEL);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.name) return parsed;
      }
    } catch {}
    const defaultKernel = StorageEngine.getDefaultKernel();
    StorageEngine.saveBoundKernel(defaultKernel);
    return defaultKernel;
  }

  public static saveBoundKernel(kernel: BoundKernel | null): void {
    try {
      if (kernel) {
        localStorage.setItem(STORAGE_KEYS.BOUND_KERNEL, JSON.stringify(kernel));
        StorageEngine.initSessionKernelContext(kernel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.BOUND_KERNEL);
        StorageEngine.initSessionKernelContext(null);
      }
    } catch {}
  }

  public static loadLearnedKnowledge(): string {
    try {
      return localStorage.getItem(STORAGE_KEYS.LEARNED_KNOWLEDGE) || '';
    } catch {
      return '';
    }
  }

  public static async saveLearnedKnowledge(text: string): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.LEARNED_KNOWLEDGE, text);
    } catch {}
  }
}
