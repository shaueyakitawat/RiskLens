import React, { useState, useEffect } from 'react';
import { Columns, ArrowRight, ShieldAlert, Sparkles, Scale } from 'lucide-react';
import { api, ComparisonResponse } from '../utils/api';

export const ComparePage: React.FC = () => {
  const [companies, setCompanies] = useState<string[]>([]);
  const [companyA, setCompanyA] = useState('');
  const [companyB, setCompanyB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCompanies()
      .then((data) => {
        setCompanies(data);
        if (data.length > 1) {
          setCompanyA(data[0]);
          setCompanyB(data[1]);
        } else if (data.length > 0) {
          setCompanyA(data[0]);
          setCompanyB(data[0]);
        }
      })
      .catch((err) => console.error('Error fetching companies:', err));
  }, []);

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyA || !companyB) return;
    if (companyA === companyB) {
      setError('Please select two different companies to compare.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    api.compareCompanies(companyA, companyB)
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResult(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Comparison generation failed. Please check your LLM provider api key.');
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Compare Companies</h2>
        <p className="text-sm text-slate-400">
          Contrast risk matrices side-by-side. The AI will isolate shared and unique liabilities, and compile sector-specific evaluations.
        </p>
      </div>

      {/* Selectors Bar */}
      <form onSubmit={handleCompare} className="p-5 glass-panel rounded-2xl flex flex-col md:flex-row items-end gap-4 bg-gradient-to-r from-[#120d2b]/20 to-transparent">
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase">Company A</label>
          <select
            value={companyA}
            onChange={(e) => setCompanyA(e.target.value)}
            className="w-full bg-black/60 border border-glass px-4 py-2.5 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-purple/50 cursor-pointer text-sm"
          >
            <option value="" disabled>Select Company A</option>
            {companies.map((c, idx) => (
              <option key={idx} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center p-2 text-slate-500 hidden md:block">
          <Scale className="w-5 h-5 text-brand-purple" />
        </div>

        <div className="flex-1 w-full space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase">Company B</label>
          <select
            value={companyB}
            onChange={(e) => setCompanyB(e.target.value)}
            className="w-full bg-black/60 border border-glass px-4 py-2.5 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-purple/50 cursor-pointer text-sm"
          >
            <option value="" disabled>Select Company B</option>
            {companies.map((c, idx) => (
              <option key={idx} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !companyA || !companyB || companyA === companyB}
          className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm shadow-glow-purple/10"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <span>Compare Matrix</span>
          )}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-sm text-slate-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-3 animate-pulse">
          <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 italic">Performing side-by-side risk taxonomy audit...</p>
        </div>
      )}

      {/* Results panel */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <div className="glass-panel p-6 rounded-2xl space-y-3 border-glow-purple transition-all bg-gradient-to-b from-[#110d29]/30 to-transparent">
            <div className="flex items-center gap-2 text-xs text-brand-neon-purple font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Comparative AI Executive Summary</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed font-sans">{result.summary}</p>
          </div>

          {/* Visual Risk Distribution Bar */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 bg-gradient-to-b from-black/10 to-transparent">
            <div className="flex items-center justify-between border-b border-glass/40 pb-2">
              <h3 className="font-bold text-white text-sm">Exposure Overlap & Specificity</h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Proportional Distribution</span>
            </div>
            <div className="space-y-3">
              <div className="flex h-5 rounded-xl overflow-hidden bg-black/60 border border-glass/40">
                {result.unique_company_a.length > 0 && (
                  <div 
                    className="bg-gradient-to-r from-brand-purple to-indigo-600 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all" 
                    style={{ width: `${(result.unique_company_a.length / (result.unique_company_a.length + result.unique_company_b.length + result.shared_risks.length || 1)) * 100}%` }}
                    title={`Unique to ${companyA}: ${result.unique_company_a.length} risks`}
                  >
                    {`${((result.unique_company_a.length / (result.unique_company_a.length + result.unique_company_b.length + result.shared_risks.length || 1)) * 100).toFixed(0)}%`}
                  </div>
                )}
                {result.shared_risks.length > 0 && (
                  <div 
                    className="bg-brand-neon-cyan/80 h-full flex items-center justify-center text-[10px] font-bold text-slate-900 transition-all" 
                    style={{ width: `${(result.shared_risks.length / (result.unique_company_a.length + result.unique_company_b.length + result.shared_risks.length || 1)) * 100}%` }}
                    title={`Shared Overlap: ${result.shared_risks.length} risks`}
                  >
                    {`${((result.shared_risks.length / (result.unique_company_a.length + result.unique_company_b.length + result.shared_risks.length || 1)) * 100).toFixed(0)}%`}
                  </div>
                )}
                {result.unique_company_b.length > 0 && (
                  <div 
                    className="bg-gradient-to-r from-sky-600 to-brand-blue h-full flex items-center justify-center text-[10px] font-bold text-white transition-all" 
                    style={{ width: `${(result.unique_company_b.length / (result.unique_company_a.length + result.unique_company_b.length + result.shared_risks.length || 1)) * 100}%` }}
                    title={`Unique to ${companyB}: ${result.unique_company_b.length} risks`}
                  >
                    {`${((result.unique_company_b.length / (result.unique_company_a.length + result.unique_company_b.length + result.shared_risks.length || 1)) * 100).toFixed(0)}%`}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-brand-purple" />
                  <span>{companyA} Unique ({result.unique_company_a.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-brand-neon-cyan" />
                  <span>Shared Overlap ({result.shared_risks.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded bg-brand-blue" />
                  <span>{companyB} Unique ({result.unique_company_b.length})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shared vs Unique Lists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shared Risks */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="border-b border-glass pb-2">
                <span className="text-[10px] text-brand-neon-cyan uppercase font-bold tracking-wider">Shared Vulnerabilities</span>
                <h3 className="font-bold text-white text-base mt-0.5">Common Risks</h3>
              </div>
              <div className="flex flex-col gap-2">
                {result.shared_risks && result.shared_risks.length > 0 ? (
                  result.shared_risks.map((risk, idx) => (
                    <div key={idx} className="p-2.5 bg-white/5 border border-glass rounded-xl text-xs text-slate-300">
                      {risk}
                    </div>
                  ))
                ) : (
                  <div className="text-xs italic text-slate-500">No matching shared risks.</div>
                )}
              </div>
            </div>

            {/* Unique to A */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="border-b border-glass pb-2">
                <span className="text-[10px] text-brand-neon-purple uppercase font-bold tracking-wider">Specific Exposure</span>
                <h3 className="font-bold text-white text-base mt-0.5">Unique to {companyA}</h3>
              </div>
              <div className="flex flex-col gap-2">
                {result.unique_company_a && result.unique_company_a.length > 0 ? (
                  result.unique_company_a.map((risk, idx) => (
                    <div key={idx} className="p-2.5 bg-brand-purple/5 border border-brand-purple/10 rounded-xl text-xs text-slate-300">
                      {risk}
                    </div>
                  ))
                ) : (
                  <div className="text-xs italic text-slate-500">No matching unique risks.</div>
                )}
              </div>
            </div>

            {/* Unique to B */}
            <div className="glass-panel p-5 rounded-2xl space-y-4">
              <div className="border-b border-glass pb-2">
                <span className="text-[10px] text-brand-neon-cyan uppercase font-bold tracking-wider">Specific Exposure</span>
                <h3 className="font-bold text-white text-base mt-0.5">Unique to {companyB}</h3>
              </div>
              <div className="flex flex-col gap-2">
                {result.unique_company_b && result.unique_company_b.length > 0 ? (
                  result.unique_company_b.map((risk, idx) => (
                    <div key={idx} className="p-2.5 bg-brand-blue/5 border border-brand-blue/10 rounded-xl text-xs text-slate-300">
                      {risk}
                    </div>
                  ))
                ) : (
                  <div className="text-xs italic text-slate-500">No matching unique risks.</div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Categorical Matrix */}
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex items-center gap-2 border-b border-glass pb-4">
              <Columns className="w-5 h-5 text-brand-blue" />
              <h3 className="font-bold text-lg text-white">Categorical Breakdown</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Operational Risk Factors', key: 'operational', label: 'Operational' },
                { title: 'Financial Risk Factors', key: 'financial', label: 'Financial' },
                { title: 'Regulatory & Compliance', key: 'regulatory', label: 'Regulatory' },
                { title: 'Supply Chain & Logistics', key: 'supply_chain', label: 'Supply Chain' },
              ].map(({ title, key, label }) => (
                <div key={key} className="p-4 bg-white/5 border border-glass rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200 text-sm">{title}</h4>
                    <span className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple rounded">
                      {label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {result.categories ? (result.categories as any)[key] : 'Not analyzed.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
