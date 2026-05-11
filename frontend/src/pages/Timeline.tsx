import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Quote, FileText, Compass, Info } from 'lucide-react';
import { api, TimelineItem, TemporalScoreItem } from '../utils/api';

interface TimelineProps {
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
}

export const TimelinePage: React.FC<TimelineProps> = ({
  selectedCompany,
  setSelectedCompany,
}) => {
  const [companies, setCompanies] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [scores, setScores] = useState<TemporalScoreItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingScores, setLoadingScores] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chart interactivity states
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);

  const companyRef = useRef(selectedCompany);

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

  useEffect(() => {
    companyRef.current = selectedCompany;
    if (selectedCompany) {
      setLoading(true);
      setLoadingScores(true);
      setError(null);
      setTimeline([]);
      setScores([]);
      setHoveredIdx(null);
      
      api.getTimeline(selectedCompany)
        .then((data) => {
          if (companyRef.current === selectedCompany) {
            setTimeline(data);
          }
        })
        .catch((err) => {
          console.error(err);
          if (companyRef.current === selectedCompany) {
            setError('Failed to calculate temporal risk vector.');
          }
        })
        .finally(() => {
          if (companyRef.current === selectedCompany) {
            setLoading(false);
          }
        });

      api.getTemporalScores(selectedCompany)
        .then((data) => {
          if (companyRef.current === selectedCompany) {
            setScores(data);
          }
        })
        .catch((err) => {
          console.error('Failed to load temporal scores:', err);
        })
        .finally(() => {
          if (companyRef.current === selectedCompany) {
            setLoadingScores(false);
          }
        });
    }
  }, [selectedCompany]);

  // SVG Chart sizing parameters
  const w = 530;
  const h = 150;
  const x0 = 50;
  const y0 = 20;

  const categories = [
    { key: 'supply_chain', label: 'Supply Chain', color: '#06b6d4' },
    { key: 'regulatory', label: 'Regulatory', color: '#a855f7' },
    { key: 'financial', label: 'Financial', color: '#10b981' },
    { key: 'competition', label: 'Competition', color: '#d946ef' },
    { key: 'geopolitical', label: 'Geopolitical', color: '#f59e0b' },
    { key: 'cybersecurity', label: 'Cybersecurity', color: '#f43f5e' }
  ];

  const getPathD = (key: string) => {
    if (scores.length < 2) return '';
    return scores.map((item, idx) => {
      const x = x0 + (idx / (scores.length - 1)) * w;
      const score = item.scores[key as keyof typeof item.scores] ?? 10;
      const y = y0 + ((100 - score) / 100) * h;
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  const activeIdx = hoveredIdx !== null ? hoveredIdx : (scores.length > 0 ? scores.length - 1 : null);
  const activeYearData = activeIdx !== null ? scores[activeIdx] : null;

  const toggleCategory = (key: string) => {
    setHiddenCategories(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Temporal Risk Evolution</h2>
        <p className="text-sm text-slate-400">
          Trace how liabilities change chronologically. The system aligns filings by year to plot the evolution of corporate exposures.
        </p>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 glass-panel rounded-2xl">
        <div className="space-y-1">
          <span className="text-[10px] text-brand-purple uppercase tracking-wider font-bold">Select Company</span>
          <div>
            {companies.length > 0 ? (
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-black/60 border border-glass px-4 py-2 rounded-xl text-white font-semibold text-lg focus:outline-none focus:border-brand-purple/50 cursor-pointer"
              >
                {companies.map((c, idx) => (
                  <option key={idx} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <div className="text-slate-400 font-medium">No company records indexed.</div>
            )}
          </div>
        </div>
      </div>

      {/* YoY Line Chart Section */}
      {!loadingScores && scores.length > 1 && (
        <div className="glass-panel p-6 rounded-2xl border border-glass space-y-6 bg-gradient-to-b from-[#0e0a1f]/35 to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-glass/40 pb-4">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-brand-neon-purple animate-pulse" />
                <span>Year-over-Year Risk severity trend</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeYearData ? `Showing risk indices for ${activeYearData.year} ${hoveredIdx !== null ? '(Hovered)' : '(Latest)'}` : 'Select data points to compare'}
              </p>
            </div>
            
            {/* Category Toggle Legend */}
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {categories.map(cat => {
                const isHidden = hiddenCategories.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    onClick={() => toggleCategory(cat.key)}
                    style={{
                      borderColor: isHidden ? 'rgba(255,255,255,0.05)' : `${cat.color}40`,
                      color: isHidden ? '#64748b' : '#e2e8f0',
                      backgroundColor: isHidden ? 'transparent' : `${cat.color}0c`
                    }}
                    className="px-2 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <div 
                      className="w-1.5 h-1.5 rounded-full" 
                      style={{ backgroundColor: isHidden ? '#64748b' : cat.color }}
                    ></div>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative">
            {/* SVG Plot */}
            <svg 
              viewBox="0 0 620 200" 
              className="w-full h-auto select-none overflow-visible"
            >
              {/* Glow filter definitions */}
              <defs>
                {categories.map(cat => (
                  <filter id={`glow-${cat.key}`} key={cat.key} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                ))}
              </defs>

              {/* Grid Lines */}
              {[0, 25, 50, 75, 100].map(gridVal => {
                const y = y0 + ((100 - gridVal) / 100) * h;
                return (
                  <g key={gridVal} className="opacity-15">
                    <line x1={x0} y1={y} x2={x0 + w} y2={y} stroke="#fff" strokeWidth={1} strokeDasharray="3 3" />
                    <text x={x0 - 10} y={y + 4} fill="#fff" fontSize="9" fontWeight="bold" textAnchor="end" className="opacity-70">{gridVal}</text>
                  </g>
                );
              })}

              {/* Year vertical guidelines & labels */}
              {scores.map((item, idx) => {
                const x = x0 + (idx / (scores.length - 1)) * w;
                return (
                  <g key={idx} className="opacity-20">
                    <line x1={x} y1={y0} x2={x} y2={y0 + h} stroke="#fff" strokeWidth={1} />
                    <text x={x} y={y0 + h + 18} fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">{item.year}</text>
                  </g>
                );
              })}

              {/* Active Hover vertical guide */}
              {hoveredIdx !== null && (
                <line
                  x1={x0 + (hoveredIdx / (scores.length - 1)) * w}
                  y1={y0}
                  x2={x0 + (hoveredIdx / (scores.length - 1)) * w}
                  y2={y0 + h}
                  stroke="rgba(168,85,247,0.45)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}

              {/* Draw Line paths */}
              {categories.map(cat => {
                if (hiddenCategories.includes(cat.key)) return null;
                return (
                  <path
                    key={cat.key}
                    d={getPathD(cat.key)}
                    fill="none"
                    stroke={cat.color}
                    strokeWidth={2.5}
                    filter={`url(#glow-${cat.key})`}
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Draw Data Points (interactive circles) */}
              {categories.map(cat => {
                if (hiddenCategories.includes(cat.key)) return null;
                return scores.map((item, idx) => {
                  const x = x0 + (idx / (scores.length - 1)) * w;
                  const score = item.scores[cat.key as keyof typeof item.scores] ?? 10;
                  const y = y0 + ((100 - score) / 100) * h;
                  const isHovered = hoveredIdx === idx;

                  return (
                    <circle
                      key={`${cat.key}-${idx}`}
                      cx={x}
                      cy={y}
                      r={isHovered ? 5.5 : 3.5}
                      fill={cat.color}
                      stroke="#080b11"
                      strokeWidth={1.5}
                      className="transition-all duration-150"
                    />
                  );
                });
              })}

              {/* Draw Active Year Labels (spaced out vertically to prevent overlaps) */}
              {(() => {
                if (scores.length === 0 || activeIdx === null) return null;
                const activeYearItem = scores[activeIdx];
                const x = x0 + (activeIdx / (scores.length - 1)) * w;
                
                // Get all active category scores for this year
                const labelItems = categories
                  .filter(cat => !hiddenCategories.includes(cat.key))
                  .map(cat => {
                    const score = activeYearItem.scores[cat.key as keyof typeof activeYearItem.scores] ?? 10;
                    const y = y0 + ((100 - score) / 100) * h;
                    return { key: cat.key, label: cat.label, color: cat.color, score, origY: y, y: y };
                  });
                
                // Sort by origY to resolve overlap top-to-bottom
                labelItems.sort((a, b) => a.origY - b.origY);
                
                // Spacing algorithm: ensure minimum vertical gap of 15px
                const minGap = 15;
                for (let i = 1; i < labelItems.length; i++) {
                  if (labelItems[i].y < labelItems[i - 1].y + minGap) {
                    labelItems[i].y = labelItems[i - 1].y + minGap;
                  }
                }
                
                // Second pass (backwards) to ensure labels don't get pushed past chart bottom
                for (let i = labelItems.length - 2; i >= 0; i--) {
                  if (labelItems[i].y > labelItems[i + 1].y - minGap) {
                    labelItems[i].y = labelItems[i + 1].y - minGap;
                  }
                }

                // Decide X alignment: if activeIdx is first point, shift label right, else shift left
                const isLeftEdge = activeIdx === 0;
                const rectX = isLeftEdge ? x + 6 : x - 34;
                const textX = isLeftEdge ? x + 20 : x - 20;

                return labelItems.map(item => (
                  <g key={item.key} className="pointer-events-none transition-all duration-150">
                    {/* Subtle indicator line from actual circle to shifted text pill */}
                    {Math.abs(item.y - item.origY) > 2 && (
                      <line 
                        x1={isLeftEdge ? x + 6 : x - 6} 
                        y1={item.origY} 
                        x2={isLeftEdge ? x + 10 : x - 10} 
                        y2={item.y - 4} 
                        stroke={item.color} 
                        strokeWidth={0.75} 
                        strokeDasharray="2 2"
                        opacity={0.6}
                      />
                    )}
                    {/* Background pill for readability */}
                    <rect
                      x={rectX}
                      y={item.y - 10}
                      width={28}
                      height={13}
                      rx={3}
                      fill="#0f1522"
                      stroke={item.color}
                      strokeWidth={1}
                      opacity={0.95}
                    />
                    <text
                      x={textX}
                      y={item.y - 1}
                      fill="#ffffff"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {item.score}
                    </text>
                  </g>
                ));
              })()}

              {/* Hover Column Detectors */}
              {scores.map((_, idx) => {
                const x = x0 + (idx / (scores.length - 1)) * w;
                const colWidth = w / (scores.length - 1 || 1);
                return (
                  <rect
                    key={idx}
                    x={x - colWidth / 2}
                    y={y0 - 10}
                    width={colWidth}
                    height={h + 20}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Grid display of active scores */}
          {activeYearData && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
              {categories.map(cat => {
                const score = activeYearData.scores[cat.key as keyof typeof activeYearData.scores] ?? 10;
                const isHidden = hiddenCategories.includes(cat.key);
                return (
                  <div 
                    key={cat.key} 
                    style={{ borderColor: isHidden ? 'transparent' : 'rgba(255,255,255,0.06)' }}
                    className={`p-3 rounded-xl border bg-black/25 flex flex-col justify-between h-[65px] transition-all ${isHidden ? 'opacity-30' : ''}`}
                  >
                    <div className="text-[9px] uppercase font-bold text-slate-400 truncate">{cat.label}</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black font-mono text-white leading-none">{score}</span>
                      <span className="text-[10px] text-slate-500 font-mono">/100</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-3 animate-pulse">
          <div className="w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 italic font-mono">Synthesizing chronological risk summaries... Please wait (takes ~10-30s)</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-sm text-slate-300">
          {error}
        </div>
      )}

      {!loading && timeline.length === 0 && selectedCompany && (
        <div className="glass-panel p-8 text-center text-slate-400 rounded-2xl">
          No filings detected across multiple years. Please upload reports representing multiple years (e.g. 2023, 2024, 2025) to map risk trends.
        </div>
      )}

      {/* Vertical Timeline Tree */}
      {timeline.length > 0 && !loading && (
        <div className="relative max-w-3xl mx-auto pl-8 sm:pl-0">
          {/* Vertical axis line */}
          <div className="absolute left-4 sm:left-1/2 top-4 bottom-4 w-0.5 bg-gradient-to-b from-brand-purple via-violet-900 to-brand-blue/30 -translate-x-1/2"></div>

          <div className="space-y-12">
            {timeline.map((item, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <div key={idx} className={`relative flex flex-col sm:flex-row items-start justify-between ${isEven ? 'sm:flex-row-reverse' : ''}`}>
                  {/* Timeline node bullet */}
                  <div className="absolute left-4 sm:left-1/2 top-1.5 w-6 h-6 rounded-full bg-[#0d0a1b] border-2 border-brand-purple shadow-glow-purple/40 -translate-x-1/2 z-10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-brand-neon-purple"></div>
                  </div>

                  {/* Left column placeholder (spacer) */}
                  <div className="w-full sm:w-[45%] hidden sm:block"></div>

                  {/* Content card */}
                  <div className="w-full sm:w-[45%] glass-panel p-5 rounded-2xl space-y-3 border-glow-purple transition-all relative">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-1.5 text-xs text-brand-neon-purple font-bold uppercase tracking-wider">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Filing Year {item.year}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider bg-brand-blue/10 border border-brand-blue/20 text-brand-neon-cyan rounded">
                        {item.category}
                      </span>
                    </div>

                    <h3 className="text-base font-extrabold text-white leading-tight">{item.title}</h3>
                    
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.summary}</p>

                    {item.quote && (
                      <div className="bg-black/30 p-3 rounded-xl border border-glass text-[11px] italic text-slate-400 relative pl-6">
                        <Quote className="w-3.5 h-3.5 text-brand-purple/40 absolute left-2 top-2" />
                        "{item.quote}"
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-glass">
                      <div className="flex items-center gap-1 truncate max-w-[70%]">
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{item.source}</span>
                      </div>
                      <span className="shrink-0 font-mono">Page {item.page}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
