import React from 'react';
import { Sparkles, ArrowRight, ShieldAlert, GitBranch, Network, Search } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
  onGoToUpload: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart, onGoToUpload }) => {
  return (
    <div className="relative min-h-[92vh] flex flex-col justify-center items-center px-4 overflow-hidden">
      {/* Background glowing meshes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-purple/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-blue/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"></div>

      <div className="relative z-10 max-w-4xl text-center space-y-8 animate-fade-in select-none">
        {/* Floating badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-glass rounded-full text-xs font-medium text-brand-neon-purple shadow-glow-purple/10">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Generation Risk Intelligence</span>
        </div>

        {/* Hero title */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white font-sans leading-[1.15]">
            Understand Corporate Risk <br />
            <span className="bg-gradient-to-r from-brand-purple via-violet-400 to-brand-blue bg-clip-text text-transparent">
              Through AI Reasoning
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
            An advanced Temporal Risk Intelligence platform powered by LangChain and Qdrant. Parse financial reports, earnings calls, and news to track risk vectors over time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={onStart}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-glow-purple/20 hover:scale-[1.02]"
          >
            <span>Start Exploring</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={onGoToUpload}
            className="w-full sm:w-auto px-8 py-3.5 bg-white/5 border border-glass hover:bg-white/10 hover:border-brand-purple/40 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <span>Upload Documents</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-16 max-w-5xl mx-auto text-left">
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-neon-purple">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Risk Intelligence</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auto-classify findings across 12 sectors, generating granular business warnings.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-neon-cyan">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Temporal Evolution</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Chronologically align annual disclosures to see how company liabilities mutate over time.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-neon-purple">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Risk Knowledge Graph</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Interact with a live node network linking companies, threat types, and direct disclosures.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-neon-cyan">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">Explainable RAG</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              All generated answers map directly to precise page and line citations with matching source highlights.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
