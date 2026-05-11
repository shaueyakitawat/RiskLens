import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, Sparkles, TrendingUp, Info, AlertTriangle, FileText } from 'lucide-react';
import { api, ExplainResponse } from '../utils/api';

interface RiskExplanationModalProps {
  isOpen: boolean;
  riskTitle: string;
  context: string;
  onClose: () => void;
}

export const RiskExplanationModal: React.FC<RiskExplanationModalProps> = ({
  isOpen,
  riskTitle,
  context,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && riskTitle && context) {
      setLoading(true);
      setError(null);
      api.explainRisk(riskTitle, context)
        .then((data) => {
          if ((data as any).error) {
            setError((data as any).error);
          } else {
            setExplanation(data);
          }
        })
        .catch((err) => {
          logger.error(err);
          setError('Failed to fetch detailed risk explanation.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, riskTitle, context]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:w-[500px] h-full glass-panel border-l border-glass shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-glass flex items-center justify-between bg-black/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-purple" />
            <h3 className="font-semibold text-white tracking-tight">AI Risk Analysis</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-black/10 select-text">
          <div>
            <span className="text-[10px] text-brand-purple uppercase font-bold tracking-wider">Analyzing Entity Risk</span>
            <h2 className="text-xl font-bold text-white leading-snug mt-1">{riskTitle}</h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400 italic">Synthesizing impact model & probability vectors...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-slate-300 text-sm flex gap-2">
              <AlertTriangle className="w-5 h-5 text-brand-neon-rose flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : explanation ? (
            <div className="space-y-6">
              {/* Likelihood & Severity Badge */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/5 border border-glass rounded-xl">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Probability</div>
                  <div className="text-sm font-semibold text-brand-neon-cyan mt-0.5">{explanation.probability}</div>
                </div>
                <div className="p-3 bg-white/5 border border-glass rounded-xl">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Trend Analysis</div>
                  <div className="text-sm font-semibold text-brand-neon-purple mt-0.5">{explanation.trend}</div>
                </div>
              </div>

              {/* Business Importance */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-brand-blue" />
                  <span>Why This Matters</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-sans pl-5 border-l border-brand-blue/30">
                  {explanation.importance}
                </p>
              </div>

              {/* Financial & Operational Impact */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-brand-neon-rose" />
                  <span>Business Impact</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-sans pl-5 border-l border-brand-neon-rose/30">
                  {explanation.impact}
                </p>
              </div>

              {/* Supporting Quote */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <FileText className="w-4 h-4 text-brand-neon-emerald" />
                  <span>Disclosed Evidence</span>
                </div>
                <blockquote className="text-xs italic text-slate-400 leading-relaxed bg-black/40 border border-glass p-3 rounded-xl">
                  "{explanation.evidence}"
                </blockquote>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-slate-500 py-10">Select a risk factor to analyze.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Simple logger implementation to satisfy typescript if not imported
const logger = {
  error: (msg: any) => console.error(msg),
};
