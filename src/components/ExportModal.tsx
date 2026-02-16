import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { ExportFormat } from '../hooks/useCanvas';
import type { CanvasObject, GridSize } from '../types';
import { renderObjectsToGrid, gridToString, calculateGridSize } from '../utils/boxDrawing';

interface ExportModalProps {
  objects: CanvasObject[];
  gridSize: GridSize;
  onClose: () => void;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  text: 'Plain Text',
  markdown: 'Markdown',
  html: 'HTML',
  github: 'GitHub',
};

const FORMATS: ExportFormat[] = ['text', 'markdown', 'html', 'github'];

const ExportModal: React.FC<ExportModalProps> = ({ objects, gridSize, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>('text');
  const [copied, setCopied] = useState(false);

  // Compute tight-fit content based on format
  const content = useMemo(() => {
    const fittedSize = calculateGridSize(objects, gridSize);
    const fittedGrid = renderObjectsToGrid(objects, fittedSize);
    const raw = gridToString(fittedGrid).replace(/\n+$/, '');

    switch (format) {
      case 'markdown':
        return '```\n' + raw + '\n```';
      case 'html': {
        const escaped = raw
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<pre style="font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.5;">${escaped}</pre>`;
      }
      case 'github':
        return [
          '<details>',
          '<summary>Wireframe</summary>',
          '',
          '```',
          raw,
          '```',
          '',
          '</details>',
        ].join('\n');
      case 'text':
      default:
        return raw;
    }
  }, [objects, gridSize, format]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    const ext = format === 'html' ? '.html' : format === 'markdown' ? '.md' : '.txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wireframe${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, format]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-label="Export dialog"
      aria-modal="true"
    >
      <div
        className="flex flex-col w-[640px] max-h-[80vh] bg-surface border border-border rounded-lg"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Export</h2>
          <button
            className="text-text-dim hover:text-text text-sm"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex gap-1 border-b border-border px-4 py-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${format === f
                  ? 'bg-accent text-bg'
                  : 'text-text-dim hover:text-text hover:bg-surface-hover'
                }`}
              onClick={() => setFormat(f)}
              type="button"
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Content preview */}
        <div className="flex-1 overflow-auto p-4">
          <textarea
            value={content}
            readOnly
            className="w-full min-h-[300px] bg-bg border border-border text-text p-3 font-mono text-xs resize-y outline-none focus:border-accent"
            rows={20}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-3 border-t border-border justify-end">
          <button
            className={`px-4 py-2 rounded text-xs transition-colors ${copied
                ? 'bg-green-600 text-white'
                : 'bg-accent text-bg hover:bg-accent/90'
              }`}
            onClick={handleCopy}
            type="button"
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            className="px-4 py-2 bg-accent text-bg rounded text-xs hover:bg-accent/90 transition-colors"
            onClick={handleDownload}
            type="button"
          >
            Download
          </button>
          <button
            className="px-4 py-2 bg-surface-hover text-text rounded text-xs hover:bg-border transition-colors"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
