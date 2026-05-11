import React, { useState } from 'react';
import { 
  BarChart3, 
  Search, 
  Upload, 
  Scale, 
  GitBranch, 
  Network, 
  Sparkles, 
  Compass,
  Menu,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Pages
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { ComparePage } from './pages/Compare';
import { TimelinePage } from './pages/Timeline';
import { ExplorerPage } from './pages/Explorer';
import { SearchPage } from './pages/Search';

type Tab = 'landing' | 'dashboard' | 'compare' | 'upload' | 'timeline' | 'explorer' | 'search';

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('landing');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  const renderActivePage = () => {
    switch (currentTab) {
      case 'landing':
        return (
          <Landing 
            onStart={() => setCurrentTab('dashboard')} 
            onGoToUpload={() => setCurrentTab('upload')} 
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            selectedCompany={selectedCompany} 
            setSelectedCompany={setSelectedCompany}
            onNavigateToUpload={() => setCurrentTab('upload')} 
          />
        );
      case 'compare':
        return <ComparePage />;
      case 'upload':
        return <UploadPage onUploadSuccess={(c) => {
          setSelectedCompany(c);
          setCurrentTab('dashboard');
        }} />;
      case 'timeline':
        return (
          <TimelinePage 
            selectedCompany={selectedCompany} 
            setSelectedCompany={setSelectedCompany} 
          />
        );
      case 'explorer':
        return (
          <ExplorerPage 
            selectedCompany={selectedCompany} 
            setSelectedCompany={setSelectedCompany} 
          />
        );
      case 'search':
        return (
          <SearchPage 
            selectedCompany={selectedCompany} 
            setSelectedCompany={setSelectedCompany} 
          />
        );
      default:
        return <Landing onStart={() => setCurrentTab('dashboard')} onGoToUpload={() => setCurrentTab('upload')} />;
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: BarChart3 },
    { id: 'explorer', label: 'Risk Explorer Graph', icon: Network },
    { id: 'timeline', label: 'Risk Timeline', icon: GitBranch },
    { id: 'compare', label: 'Compare Companies', icon: Scale },
    { id: 'search', label: 'Semantic Search', icon: Search },
    { id: 'upload', label: 'Upload Disclosures', icon: Upload }
  ] as const;


  return (
    <div className="min-h-screen bg-[#05040a] text-slate-100 flex font-sans antialiased relative overflow-hidden select-none">
      {/* Background Mesh (fixed behind everything) */}
      <div className="absolute inset-0 bg-radial-gradient from-brand-glow via-[#07050d] to-[#040307] pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none z-0"></div>

      {/* Main Layout wrapper (conditional sidebar) */}
      {currentTab === 'landing' ? (
        // Landing mode doesn't render the sidebar, just floats the top navbar
        <div className="w-full min-h-screen flex flex-col z-10">
          <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between z-20">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentTab('landing')}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-brand-purple to-violet-600 flex items-center justify-center text-white shadow-glow-purple/20">
                <Compass className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg text-white font-sans tracking-tight">RiskLens AI</span>
            </div>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="px-4 py-2 bg-white/5 border border-glass hover:bg-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all text-slate-200"
            >
              <span>Explore Platform</span>
              <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
            </button>
          </header>
          
          <main className="flex-1">
            {renderActivePage()}
          </main>
        </div>
      ) : (
        // Standard Workspace Frame with Sidebar
        <div className="w-full min-h-screen flex z-10 relative">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-64 glass-panel border-r border-glass flex flex-col justify-between shrink-0 hidden md:flex bg-black/40 z-20">
            <div className="flex flex-col">
              {/* Logo block */}
              <div 
                className="p-6 border-b border-glass flex items-center gap-2.5 cursor-pointer hover:bg-white/2 transition-all"
                onClick={() => setCurrentTab('landing')}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-brand-purple to-violet-600 flex items-center justify-center text-white shadow-glow-purple/20">
                  <Compass className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h1 className="font-extrabold text-sm text-white tracking-tight leading-none">RiskLens AI</h1>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mt-1 block">Risk Intelligence</span>
                </div>
              </div>

              {/* Navigation list */}
              <nav className="p-4 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-xs font-medium cursor-pointer ${
                        isActive 
                          ? 'bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple shadow-glow-purple/5 font-semibold' 
                          : 'border border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-brand-neon-purple' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom active company badge */}
            <div className="p-4 border-t border-glass bg-black/20 text-[10px] space-y-1.5">
              <div className="text-slate-500 font-bold uppercase tracking-wider">Active Workspace</div>
              <div className="flex items-center justify-between text-slate-300 font-semibold truncate bg-white/5 border border-glass p-2 rounded-xl">
                <span className="truncate">{selectedCompany || 'None Selected'}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${selectedCompany ? 'bg-brand-neon-emerald' : 'bg-slate-600'}`}></div>
              </div>
            </div>
          </aside>

          {/* MAIN CONTAINER */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Workspace Header */}
            <header className="h-16 border-b border-glass flex items-center justify-between px-6 z-20 bg-[#05040a]/40 backdrop-blur-md">
              <div className="flex items-center gap-4">
                {/* Responsive Hamburger for Mobile */}
                <div className="flex items-center gap-2.5 md:hidden">
                  <button 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-1 rounded-lg hover:bg-white/5 border border-transparent hover:border-glass text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                  <span className="font-bold text-white text-sm">RiskLens AI</span>
                </div>
                
                <h2 className="text-sm font-bold text-white tracking-tight hidden md:block uppercase">
                  {currentTab === 'dashboard' && 'RAG Overview Dashboard'}
                  {currentTab === 'compare' && 'Company Risk Comparison Matrix'}
                  {currentTab === 'upload' && 'Document Ingestion Portal'}
                  {currentTab === 'timeline' && 'Temporal Risk Timeline'}
                  {currentTab === 'explorer' && 'Risk Knowledge Graph'}
                  {currentTab === 'search' && 'Semantic & News Search'}
                </h2>
              </div>

              {/* Top Bar actions */}
              <div className="flex items-center gap-3">
                {currentTab !== 'dashboard' && selectedCompany && (
                  <button
                    onClick={() => setCurrentTab('dashboard')}
                    className="text-xs px-3 py-1.5 bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple rounded-lg font-medium hover:bg-brand-purple/20 transition-colors"
                  >
                    Back to {selectedCompany}
                  </button>
                )}
                
                <button
                  onClick={() => setCurrentTab('landing')}
                  className="text-xs px-3 py-1.5 bg-white/5 border border-glass hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Exit Workspace
                </button>
              </div>
            </header>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-x-0 top-16 bottom-0 bg-[#05040a]/95 backdrop-blur-lg z-30 flex flex-col justify-between p-6 md:hidden border-t border-glass"
                >
                  <div className="space-y-6">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Navigation</div>
                    <nav className="flex flex-col gap-2">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setCurrentTab(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all text-sm font-semibold cursor-pointer ${
                              isActive 
                                ? 'bg-brand-purple/10 border border-brand-purple/20 text-brand-neon-purple shadow-glow-purple/5' 
                                : 'border border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-brand-neon-purple' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>

                  {/* Bottom active company badge */}
                  <div className="border-t border-glass pt-4 text-[10px] space-y-2">
                    <div className="text-slate-500 font-bold uppercase tracking-wider">Active Workspace</div>
                    <div className="flex items-center justify-between text-slate-300 font-semibold truncate bg-white/5 border border-glass p-3 rounded-xl">
                      <span className="truncate text-xs">{selectedCompany || 'None Selected'}</span>
                      <div className={`w-2 h-2 rounded-full ${selectedCompany ? 'bg-brand-neon-emerald' : 'bg-slate-600'}`}></div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scrollable View Area */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="h-full select-text"
                >
                  {renderActivePage()}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

        </div>
      )}
    </div>
  );
}
