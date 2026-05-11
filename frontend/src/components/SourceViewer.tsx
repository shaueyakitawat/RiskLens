import React from 'react';
import { X, FileText, Calendar, Layers, CheckCircle } from 'lucide-react';
import { Citation } from '../utils/api';

interface SourceViewerProps {
  citation: Citation | null;
  onClose: () => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] z-50 glass-panel border-l border-glass shadow-2xl flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-glass flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-blue" />
          <h3 className="font-semibold text-white tracking-tight">Source Document Details</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Meta details list */}
      <div className="p-5 flex flex-col gap-4 border-b border-glass bg-background/40">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-brand-purple" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Document Year</div>
              <div className="font-semibold">{citation.year} ({citation.quarter})</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Layers className="w-4 h-4 text-brand-blue" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Page Number</div>
              <div className="font-semibold">Page {citation.page_number}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Source Filename</div>
          <div className="text-xs bg-black/40 border border-glass p-2 rounded text-slate-300 truncate font-mono select-all">
            {citation.source}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">Detected Categories</div>
          <div className="flex flex-wrap gap-1">
            {citation.categories && citation.categories.length > 0 ? (
              citation.categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple rounded-full"
                >
                  {cat}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">No category tags</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 text-xs text-brand-neon-emerald">
          <CheckCircle className="w-4 h-4" />
          <span>Similarity Relevance Score: {(citation.score * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Paragraph body */}
      <div className="flex-1 p-5 overflow-y-auto bg-black/10">
        <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">Retrieved Paragraph Context</div>
        <div className="text-sm text-slate-300 leading-relaxed bg-[#0b0817] p-4 rounded-xl border border-glass shadow-inner whitespace-pre-wrap select-text font-sans">
          {citation.snippet}
        </div>
      </div>
    </div>
  );
};
