import React, { useState, useEffect } from 'react';
import { Search, FileText, AlertTriangle, Newspaper, Sparkles, SlidersHorizontal, CheckCircle, Globe, Calendar, Layers } from 'lucide-react';
import { api, SemanticSearchResult, NewsCompareResponse } from '../utils/api';

interface SearchPageProps {
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  selectedCompany,
  setSelectedCompany,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'semantic' | 'news'>('semantic');
  const [companies, setCompanies] = useState<string[]>([]);
  
  // Semantic search states
  const [query, setQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState(selectedCompany); // local state to prevent workspace disruption
  const [filterYear, setFilterYear] = useState<number | ''>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // News Mode states
  const [newsText, setNewsText] = useState('');
  const [newsUrl, setNewsUrl] = useState(''); // URL Scraping state
  const [comparingNews, setComparingNews] = useState(false);
  const [newsResult, setNewsResult] = useState<NewsCompareResponse | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);

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

  // Update local filter company when parent changes workspace (sync initial load)
  useEffect(() => {
    if (selectedCompany) {
      setFilterCompany(selectedCompany);
    }
  }, [selectedCompany]);

  const handleSemanticSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    api.semanticSearch(
      query,
      filterCompany || undefined,
      filterYear !== '' ? filterYear : undefined,
      filterCategory || undefined
    )
      .then((res) => {
        setSearchResults(res);
        if (res.length === 0) {
          setSearchError('No matching passages found. Refine your query or filters.');
        }
      })
      .catch((err) => {
        console.error(err);
        setSearchError('Semantic query failed. Please verify database connection.');
      })
      .finally(() => setSearching(false));
  };

  const handleNewsCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsText.trim() && !newsUrl.trim()) {
      setNewsError('Please provide either news article body text or a news URL.');
      return;
    }
    if (!selectedCompany) {
      setNewsError('Please select a target company workspace to audit.');
      return;
    }

    setComparingNews(true);
    setNewsError(null);
    setNewsResult(null);

    api.newsCompare(selectedCompany, newsText, newsUrl)
      .then((data) => {
        if (data.error) {
          setNewsError(data.error);
        } else {
          setNewsResult(data);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setNewsError(err.message || 'News comparison failed. Ensure annual reports exist for this company.');
      })
      .finally(() => setComparingNews(false));
  };

  const categories = [
    "Regulatory", "Operational", "Supply Chain", "Financial", "Geopolitical", 
    "Cybersecurity", "Technology", "AI", "Competition", "Market", "ESG", "Litigation"
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Subtab Toggle */}
      <div className="flex border-b border-glass gap-6 select-none">
        <button
          onClick={() => setActiveSubTab('semantic')}
          className={`pb-3 font-semibold text-sm transition-all cursor-pointer relative ${
            activeSubTab === 'semantic' ? 'text-brand-purple' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Semantic Document Search</span>
          {activeSubTab === 'semantic' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-purple rounded-full shadow-glow-purple/40"></div>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('news')}
          className={`pb-3 font-semibold text-sm transition-all cursor-pointer relative ${
            activeSubTab === 'news' ? 'text-brand-purple' : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>News Mode Audit</span>
          {activeSubTab === 'news' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-purple rounded-full shadow-glow-purple/40"></div>
          )}
        </button>
      </div>

      {/* Semantic Search Interface */}
      {activeSubTab === 'semantic' && (
        <div className="space-y-6">
          <form onSubmit={handleSemanticSearch} className="space-y-4">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search concepts programmatically (e.g. GPU margins, labor union strikes, chip tariff adjustments)"
                className="w-full bg-black/50 border border-glass pl-12 pr-4 py-3.5 rounded-xl text-slate-200 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 text-sm"
              />
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 glass-panel rounded-2xl items-end">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-brand-purple" />
                  <span>Entity Filter</span>
                </div>
                <select
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="w-full bg-black/60 border border-glass px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-brand-purple/50 cursor-pointer"
                >
                  <option value="">All Indexed Companies</option>
                  {companies.map((c, idx) => (
                    <option key={idx} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-brand-purple" />
                  <span>Filing Year</span>
                </div>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full bg-black/60 border border-glass px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-brand-purple/50 cursor-pointer"
                >
                  <option value="">All Filing Years</option>
                  {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-brand-purple" />
                  <span>Risk Category</span>
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-black/60 border border-glass px-3 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-brand-purple/50 cursor-pointer"
                >
                  <option value="">All Threat Vectors</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
                  <span>Execute Search</span>
                </div>
                <button
                  type="submit"
                  disabled={searching || !query.trim()}
                  className="w-full py-2 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white rounded-lg font-semibold transition-all text-xs shadow-glow-purple/10 disabled:opacity-50 h-[34px] flex items-center justify-center cursor-pointer"
                >
                  {searching ? 'Querying Index...' : 'Semantic Search'}
                </button>
              </div>
            </div>
          </form>

          {/* Search Error details */}
          {searchError && (
            <div className="p-8 text-center text-slate-500 text-sm glass-panel rounded-2xl">
              {searchError}
            </div>
          )}

          {/* Results list */}
          {searchResults.length > 0 && !searching && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Semantic Match Returns</h3>
              
              <div className="space-y-4">
                {searchResults.map((item, idx) => (
                  <div key={idx} className="glass-panel p-5 rounded-2xl space-y-4 border-glow-purple transition-all">
                    {/* Header meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass pb-3 text-[10px] uppercase font-bold text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-brand-blue" />
                        <span className="font-extrabold text-white text-xs">{item.source}</span>
                        <span>•</span>
                        <span>Page {item.page}</span>
                        <span>•</span>
                        <span>Year {item.year} ({item.quarter})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.categories && item.categories.map((cat, cIdx) => (
                          <span key={cIdx} className="px-2 py-0.5 text-[9px] bg-brand-purple/15 text-brand-neon-purple rounded-full border border-brand-purple/20">
                            {cat}
                          </span>
                        ))}
                        <span className="text-brand-neon-emerald">
                          Match Score: {(item.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Text block */}
                    <p className="text-slate-300 text-sm leading-relaxed font-sans">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* News Mode Interface */}
      {activeSubTab === 'news' && (
        <div className="space-y-6">
          <div className="p-4 bg-white/5 border border-glass rounded-2xl flex items-start gap-3">
            <Newspaper className="w-5 h-5 text-brand-blue flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">How News Mode works:</strong> Paste news article text or link an external URL reporting on recent labor strikes, regulatory investigations, or raw material bottlenecks below. RiskLens AI will extract the coverage and cross-audit it against formal SEC filings to identify undisclosed gaps or contradictions.
            </div>
          </div>

          <form onSubmit={handleNewsCompare} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Workspace Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Target Workspace Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full bg-black/60 border border-glass px-4 py-2.5 rounded-xl text-white font-semibold focus:outline-none focus:border-brand-purple/50 cursor-pointer text-sm"
                  required
                >
                  <option value="" disabled>Select Target Company</option>
                  {companies.map((c, idx) => (
                    <option key={idx} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* URL input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Extract from News URL (Optional)</span>
                </label>
                <input
                  type="url"
                  value={newsUrl}
                  onChange={(e) => setNewsUrl(e.target.value)}
                  placeholder="https://www.bloomberg.com/news/articles/..."
                  className="w-full bg-black/50 border border-glass px-4 py-2.5 rounded-xl text-slate-300 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-400 uppercase font-bold">Paste News Article Body</label>
                <button
                  type="button"
                  onClick={() => {
                    setNewsUrl('');
                    if (selectedCompany.toLowerCase() === 'nvidia') {
                      setNewsText("Nvidia Corporation is experiencing massive shipment bottlenecks for its newly launched Blackwell B200 AI processors. According to supply chain reports, manufacturing yields at TSMC's packaging line in Taiwan are lower than expected, resulting in a three-month shipping delay. Major cloud provider customers have expressed concerns about computing infrastructure delays.");
                    } else if (selectedCompany.toLowerCase() === 'apple') {
                      setNewsText("The European Commission has fined Apple Inc. 1.8 billion euros for antitrust violations related to music streaming. European regulators ruled that Apple applied anti-steering restrictions on rival developers, preventing them from informing iOS users of alternative subscription options outside the App Store.");
                    } else {
                      setNewsText("Recent news reports reveal that a major cloud infrastructure provider suffered a massive cybersecurity breach, exposing internal databases and customer access tokens. The incident is currently under investigation by regulatory security agencies, raising concerns about software supply chain safety.");
                    }
                  }}
                  className="text-[10px] px-2 py-1 bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple hover:bg-brand-purple/20 rounded-lg cursor-pointer transition-all"
                >
                  Load Demo News Article
                </button>
              </div>
              <textarea
                value={newsText}
                onChange={(e) => setNewsText(e.target.value)}
                placeholder="Paste news coverage text here (ignored if a URL is provided above)..."
                rows={6}
                className="w-full bg-black/50 border border-glass p-4 rounded-xl text-slate-300 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 text-sm leading-relaxed"
                required={!newsUrl.trim()}
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={comparingNews || (!newsText.trim() && !newsUrl.trim()) || !selectedCompany}
              className="w-full py-3 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-glow-purple/10"
            >
              {comparingNews ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Running Discrepancy Cross-Check...</span>
                </>
              ) : (
                <span>Run Discrepancy Audit</span>
              )}
            </button>
          </form>

          {newsError && (
            <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-sm text-slate-300">
              {newsError}
            </div>
          )}

          {/* News Mode Comparison Result Display */}
          {newsResult && !comparingNews && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="glass-panel p-6 rounded-2xl space-y-3 bg-gradient-to-b from-[#110d29]/30 to-transparent">
                <div className="flex items-center gap-2 text-xs text-brand-neon-purple font-semibold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Audit Summary</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed font-sans">{newsResult.summary}</p>
              </div>

              {/* Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gaps / New Risks */}
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                  <div className="border-b border-glass pb-2">
                    <span className="text-[10px] text-brand-neon-rose uppercase font-bold tracking-wider">Undisclosed / Under-reported</span>
                    <h3 className="font-bold text-white text-base mt-0.5">New Risks Identified</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {newsResult.new_risks && newsResult.new_risks.length > 0 ? (
                      newsResult.new_risks.map((risk, idx) => (
                        <div key={idx} className="p-3 bg-rose-950/10 border border-rose-950/30 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-brand-neon-rose flex-shrink-0 mt-0.5" />
                          <span>{risk}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs italic text-slate-500">No new threat signatures identified.</div>
                    )}
                  </div>
                </div>

                {/* Discrepancies */}
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                  <div className="border-b border-glass pb-2">
                    <span className="text-[10px] text-brand-neon-cyan uppercase font-bold tracking-wider">Filing Conflicts</span>
                    <h3 className="font-bold text-white text-base mt-0.5">Disclosed Discrepancies</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {newsResult.discrepancies && newsResult.discrepancies.length > 0 ? (
                      newsResult.discrepancies.map((disc, idx) => (
                        <div key={idx} className="p-3 bg-brand-blue/5 border border-brand-blue/15 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
                          <CheckCircle className="w-4 h-4 text-brand-neon-cyan flex-shrink-0 mt-0.5" />
                          <span>{disc}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs italic text-slate-500">No conflicts with SEC filing text identified.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
