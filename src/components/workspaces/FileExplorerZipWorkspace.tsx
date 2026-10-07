import React, { useRef, useState } from 'react';
import { ProjectFile, KernelMemoryLog, CodeInspectionResult } from '../../types/kernel';
import { unpackZipFile, exportKernelStateZip, triggerFileDownload } from '../../services/zipEngine';
import { inspectAndRepairFiles } from '../../services/codeLinter';
import {
  FolderArchive,
  Upload,
  Download,
  FileCode,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Wand2,
  RefreshCw,
  FolderTree,
  File,
  Code,
} from 'lucide-react';

interface FileExplorerZipWorkspaceProps {
  files: ProjectFile[];
  onImportFiles: (importedFiles: ProjectFile[]) => void;
  memoryLogs: KernelMemoryLog[];
  onApplyPatches: (patches: any[]) => void;
}

export const FileExplorerZipWorkspace: React.FC<FileExplorerZipWorkspaceProps> = ({
  files,
  onImportFiles,
  memoryLogs,
  onApplyPatches,
}) => {
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(files[0] || null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<CodeInspectionResult | null>(null);
  const [patchApplied, setPatchApplied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      if (file.name.endsWith('.zip')) {
        const extracted = await unpackZipFile(file);
        if (extracted.length > 0) {
          onImportFiles(extracted);
          setSelectedFile(extracted[0]);
          // Run inspection automatically on new zip
          runASTInspection(extracted);
        }
      } else {
        // Single text file
        const text = await file.text();
        const newFile: ProjectFile = {
          name: file.name,
          path: file.name,
          content: text,
          size: text.length,
          isBinary: false,
        };
        const updated = [newFile, ...files];
        onImportFiles(updated);
        setSelectedFile(newFile);
      }
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runASTInspection = async (targetFiles: ProjectFile[] = files) => {
    setIsInspecting(true);
    setPatchApplied(false);
    try {
      const result = await inspectAndRepairFiles(targetFiles);
      setInspectionResult(result);
    } catch (err) {
      console.error('Inspection error:', err);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleApplyPatches = () => {
    if (!inspectionResult || inspectionResult.patches.length === 0) return;
    onApplyPatches(inspectionResult.patches);
    setPatchApplied(true);
  };

  const handleExportZip = async () => {
    const blob = await exportKernelStateZip({
      projectName: 'kernel-export-package',
      files,
      memoryLogs,
    });
    triggerFileDownload(blob, `kernel_state_archive_${Date.now()}.zip`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Zip Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-300">
            <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
            <span>ZIP Engine &amp; AST Auto-Repair</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {files.length} indexed files in VFS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".zip,.ts,.tsx,.js,.jsx,.json,.txt"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExtracting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExtracting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>Import .ZIP Archive</span>
          </button>

          <button
            onClick={() => runASTInspection()}
            disabled={isInspecting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run AST Linter</span>
          </button>

          <button
            onClick={handleExportZip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer shadow-md shadow-amber-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Kernel .ZIP</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: File Tree Explorer */}
        <div className="w-72 border-r border-slate-800 bg-slate-900/40 p-3 overflow-y-auto">
          <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-amber-400" />
            <span>Project File Tree</span>
          </div>

          <div className="space-y-1">
            {files.map((file) => (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                  selectedFile?.path === file.path
                    ? 'bg-amber-950/50 text-amber-300 border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{file.path}</span>
                </div>
                {file.size && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    {Math.round(file.size / 1024)}k
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center: File Viewer / Code */}
        <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950">
          <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{selectedFile?.path || 'No file selected'}</span>
            <span>{selectedFile?.isBinary ? 'Binary Data' : 'UTF-8 Source'}</span>
          </div>

          <div className="flex-1 p-4 font-mono text-xs text-slate-200 overflow-auto whitespace-pre leading-relaxed select-text bg-slate-950">
            {selectedFile?.content || '// Select a file from the explorer tree.'}
          </div>
        </div>

        {/* Right: AST Auto-Inspection & Repair Diagnostics */}
        <div className="w-88 bg-slate-900/30 p-4 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                AST Quality &amp; Auto-Fix
              </span>
              {inspectionResult && (
                <span className="text-xs font-mono px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded">
                  Score: {inspectionResult.overallHealthScore}%
                </span>
              )}
            </div>

            {inspectionResult ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-arabic">
                  {inspectionResult.summary}
                </div>

                {/* Detected Issues */}
                {inspectionResult.issuesFound.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      Detected Anomalies ({inspectionResult.issuesFound.length}):
                    </span>
                    {inspectionResult.issuesFound.map((issue, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-rose-950/20 border border-rose-500/30 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[11px] mb-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{issue.file} {issue.line ? `(L${issue.line})` : ''}</span>
                        </div>
                        <p className="text-slate-300 text-[11px] mb-1">{issue.description}</p>
                        <p className="text-emerald-400 text-[10px] font-mono font-arabic">
                          الإصلاح: {issue.fixSuggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Patch Ready Action */}
                {inspectionResult.patches.length > 0 && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/30">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-mono text-xs mb-1">
                      <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Auto-Fix Patch Available</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">
                      {inspectionResult.patches[0].explanation}
                    </p>
                    <button
                      onClick={handleApplyPatches}
                      disabled={patchApplied}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        patchApplied
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md shadow-cyan-500/20 hover:from-cyan-400'
                      }`}
                    >
                      {patchApplied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Patches Applied to Codebase</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Apply AST Auto-Fix Patch</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
                <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Click "Run AST Linter" or upload a .ZIP to initiate syntax parsing and auto-fix.
                </p>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 font-mono border-t border-slate-800 pt-3 mt-4">
            Continuous In-Memory Codebase Indexing &amp; Auto-Repair
          </div>
        </div>
      </div>
    </div>
  );
};
