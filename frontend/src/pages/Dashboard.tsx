import React, { useState, useEffect, useRef } from 'react';
import { Search, Brain, FileText, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { api, DashboardResponse, QueryResponse, Citation } from '../utils/api';
import { RiskScoreGauge } from '../components/RiskScoreGauge';
import { SourceViewer } from '../components/SourceViewer';

interface DashboardProps {
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  onNavigateToUpload: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedCompany,
  setSelectedCompany,
  onNavigateToUpload,
}) => {
  const [companies, setCompanies] = useState<string[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  
  // Q&A States
  const [question, setQuestion] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaResponse, setQaResponse] = useState<QueryResponse | null>(null);
  
  // Active citation for side viewer
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  const companyRef = useRef(selectedCompany);

  // Load available companies
  useEffect(() => {
    api.getCompanies()
      .then((data) => {
        setCompanies(data);
        if (data.length > 0 && !selectedCompany) {
          setSelectedCompany(data[0]);
        }
      })
      .catch((err) => console.error('Error fetching companies:', err));
  }, []);

  // Load dashboard metrics when company changes
  useEffect(() => {
    companyRef.current = selectedCompany;
    if (selectedCompany) {
      setLoadingDashboard(true);
      api.getDashboard(selectedCompany)
        .then((data) => {
          if (companyRef.current === selectedCompany) {
            setDashboardData(data);
            // Clear old Q&A on company change
            setQaResponse(null);
            setQuestion('');
          }
        })
        .catch((err) => console.error('Error loading dashboard:', err))
        .finally(() => {
          if (companyRef.current === selectedCompany) {
            setLoadingDashboard(false);
          }
        });
    }
  }, [selectedCompany]);

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedCompany) return;

    setQaLoading(true);
    setQaResponse(null);
    api.queryRAG(selectedCompany, question)
      .then((res) => {
        setQaResponse(res);
      })
      .catch((err) => {
        console.error(err);
        setQaResponse({
          answer: 'An error occurred while communicating with the AI model. Please verify your API key config.',
          citations: [],
          chunks: []
        });
      })
      .finally(() => setQaLoading(false));
  };

  const handleQuickQuestion = (q: string) => {
    setQuestion(q);
    setQaLoading(true);
    setQaResponse(null);
    api.queryRAG(selectedCompany, q)
      .then((res) => {
        setQaResponse(res);
      })
      .catch((err) => {
        console.error(err);
        setQaResponse({
          answer: 'An error occurred while communicating with the AI model.',
          citations: [],
          chunks: []
        });
      })
      .finally(() => setQaLoading(false));
  };

  // Inline citation parsing helper
  const renderAnswerWithCitations = (answer: string, citations: Citation[]) => {
    if (!citations || citations.length === 0) return answer;

    // We search for [Source 1], [Source 2], etc.
    const parts = answer.split(/(\[Source \d+\])/g);
    return parts.map((part, idx) => {
      const match = part.match(/\[Source (\d+)\]/);
      if (match) {
        const sourceId = parseInt(match[1]);
        const citation = citations.find(c => c.id === sourceId);
        if (citation) {
          return (
            <button
              key={idx}
              onClick={() => setSelectedCitation(citation)}
              className="inline-flex items-center justify-center px-1.5 py-0.5 mx-0.5 text-[10px] font-bold bg-brand-blue/20 hover:bg-brand-blue/40 border border-brand-blue/30 text-brand-neon-cyan rounded hover:scale-105 transition-all cursor-pointer font-mono"
              title={`${citation.source} - Page ${citation.page_number}`}
            >
              {part}
            </button>
          );
        }
      }
      return part;
    });
  };

  const sampleQuestions = [
    `What are ${selectedCompany || 'company'}'s biggest operational risks?`,
    `Does ${selectedCompany || 'company'} mention any supply chain or shipping issues?`,
    `What regulatory or government legal risks exist?`,
    `What competition threats are highlighted in the report?`
  ];

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Top Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 glass-panel rounded-2xl">
        <div className="space-y-1">
          <span className="text-[10px] text-brand-purple uppercase tracking-wider font-bold">Selected Workspace</span>
          <div className="flex items-center gap-3">
            {companies.length > 0 ? (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-black/60 border border-glass px-4 py-2 rounded-xl text-white font-semibold text-lg focus:outline-none focus:border-brand-purple/50 cursor-pointer"
              >
                {companies.map((c, idx) => (
                  <option key={idx} value={c} className="bg-background">{c}</option>
                ))}
              </select>
            ) : (
              <div className="text-slate-400 font-medium">No company records indexed.</div>
            )}
          </div>
        </div>

        <button
          onClick={onNavigateToUpload}
          className="px-4 py-2 border border-glass hover:bg-white/5 hover:border-brand-purple/40 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all"
        >
          <span>Ingest New Documents</span>
          <ArrowRight className="w-4 h-4 text-brand-purple" />
        </button>
      </div>

      {/* Main Grid: Gauges and Categories */}
      {selectedCompany && (
        <>
          {loadingDashboard ? (
            <div className="glass-panel p-10 rounded-2xl text-center space-y-4 animate-pulse flex flex-col justify-center items-center min-h-[300px] bg-gradient-to-b from-[#120d2b]/25 to-transparent">
              <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400 italic font-mono">
                Analyzing SEC filings and synthesizing risk metrics... Please wait (takes ~5-15s)
              </p>
            </div>
          ) : dashboardData && dashboardData.overall ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Overall Risk Score */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between items-center text-center gap-4 bg-gradient-to-b from-[#120d2b]/40 to-transparent">
                <div>
                  <h3 className="font-bold text-lg text-white">Overall Risk Score</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                    Synthesized rating based on cumulative weighted SEC risk disclosure densities.
                  </p>
                </div>
                
                <RiskScoreGauge score={dashboardData.overall.score} label="Risk Rating" size={140} />
                
                <p className="text-xs italic text-slate-300 leading-relaxed max-w-[240px]">
                  "{dashboardData.overall.explanation}"
                </p>
              </div>

              {/* Specific Categories Severity Grid */}
              <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-5">
                <div className="flex items-center justify-between border-b border-glass pb-3">
                  <h3 className="font-bold text-lg text-white">Risk Domains</h3>
                  <span className="text-xs text-slate-400 font-medium">Auto-Categorized Factors</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  {[
                    { key: 'supply_chain', label: 'Supply Chain Risk', color: 'bg-brand-neon-cyan' },
                    { key: 'regulatory', label: 'Regulatory Risk', color: 'bg-brand-neon-purple' },
                    { key: 'financial', label: 'Financial Risk', color: 'bg-brand-neon-emerald' },
                    { key: 'competition', label: 'Competition Risk', color: 'bg-brand-neon-purple' },
                    { key: 'geopolitical', label: 'Geopolitical Risk', color: 'bg-brand-neon-cyan' },
                    { key: 'cybersecurity', label: 'Cybersecurity Risk', color: 'bg-brand-neon-rose' },
                  ].map(({ key, label, color }) => {
                    const domain = dashboardData[key];
                    const score = domain?.score ?? 10;
                    const explanation = domain?.explanation ?? 'No significant risks identified.';

                    return (
                      <div key={key} className="space-y-1.5 p-2 rounded-xl hover:bg-white/5 transition-all">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium text-slate-200">{label}</span>
                          <span className="font-bold text-white font-mono">{score}/100</span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-glass/40">
                          <div
                            className={`h-full ${color} rounded-full`}
                            style={{
                              width: `${score}%`,
                              transition: 'width 1s ease-in-out',
                            }}
                          ></div>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400 mt-1" title={explanation}>
                          {explanation}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 text-center text-slate-400 rounded-2xl">
              No analysis model available. Please upload a report to initialize dashboard computations.
            </div>
          )}

          {/* RAG Section */}
          <div className="grid grid-cols-1 gap-6">
            <div className="glass-panel p-6 rounded-2xl space-y-6">
              <div className="flex items-center gap-2.5 border-b border-glass pb-4">
                <Brain className="w-5 h-5 text-brand-purple" />
                <h3 className="font-bold text-lg text-white">Ask RiskLens AI RAG</h3>
              </div>

              {/* RAG Input Form */}
              <form onSubmit={handleAskQuestion} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={`e.g. What legal risks does ${selectedCompany} disclose?`}
                    className="w-full bg-black/50 border border-glass pl-12 pr-4 py-3.5 rounded-xl text-slate-200 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={qaLoading || !question.trim()}
                  className="px-6 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm shadow-glow-purple/10"
                >
                  {qaLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Ask AI</span>
                  )}
                </button>
              </form>

              {/* Quick Prompt Suggesters */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Suggested Queries</span>
                <div className="flex flex-wrap gap-2">
                  {sampleQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(q)}
                      disabled={qaLoading}
                      className="text-xs px-3 py-1.5 bg-white/5 border border-glass hover:bg-white/10 hover:border-brand-purple/20 text-slate-300 rounded-lg text-left transition-all cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* QA Response display */}
              {(qaLoading || qaResponse) && (
                <div className="border-t border-glass pt-6 space-y-4">
                  {qaLoading ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-4 bg-white/5 rounded-lg w-1/4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-white/5 rounded-lg w-full"></div>
                        <div className="h-3 bg-white/5 rounded-lg w-5/6"></div>
                        <div className="h-3 bg-white/5 rounded-lg w-4/5"></div>
                      </div>
                    </div>
                  ) : qaResponse ? (
                    <div className="space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-glass/40 pb-3">
                        <div className="flex items-center gap-1 text-xs text-brand-neon-cyan font-semibold uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Grounded Response</span>
                        </div>
                        
                        {qaResponse.evaluation && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <div className="px-2 py-0.5 bg-brand-purple/10 border border-brand-purple/30 text-brand-neon-purple rounded-md font-bold uppercase" title="Ratio of claims supported by exact source citations">
                              Groundedness: {qaResponse.evaluation.groundedness_score}%
                            </div>
                            <div className="px-2 py-0.5 bg-brand-blue/10 border border-brand-blue/30 text-brand-neon-blue rounded-md font-bold uppercase" title="Vocabulary similarity between generated answer and source context">
                              Relevance: {qaResponse.evaluation.context_relevance}%
                            </div>
                            <div className="px-2 py-0.5 bg-white/5 border border-glass text-slate-300 rounded-md font-semibold">
                              {qaResponse.evaluation.label}
                            </div>
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 italic">Citations linked to source page viewer</span>
                      </div>

                      {/* Answer block */}
                      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap select-text font-sans bg-black/30 p-5 rounded-2xl border border-glass/40 shadow-inner">
                        {renderAnswerWithCitations(qaResponse.answer, qaResponse.citations)}
                      </div>

                      {/* Citation badges list */}
                      {qaResponse.citations && qaResponse.citations.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Source Material</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {qaResponse.citations.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => setSelectedCitation(c)}
                                className="flex items-center justify-between p-2.5 bg-white/5 border border-glass hover:border-brand-blue/30 rounded-xl cursor-pointer hover:bg-white/10 transition-all text-xs"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <FileText className="w-4 h-4 text-brand-blue flex-shrink-0" />
                                  <span className="font-semibold text-slate-200 truncate">{c.source}</span>
                                </div>
                                <span className="font-mono text-slate-400 shrink-0">
                                  [Source {c.id}] p.{c.page_number}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Slide-out Source Details Panel */}
      <SourceViewer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
};
