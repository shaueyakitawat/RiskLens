import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, Trash2, Database } from 'lucide-react';
import { api, IndexedDocument } from '../utils/api';

interface UploadProps {
  onUploadSuccess: (companyName: string) => void;
}

export const UploadPage: React.FC<UploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [company, setCompany] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState('FY');
  const [documentType, setDocumentType] = useState('Annual Report');
  
  // Status states
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progressStep, setProgressStep] = useState<number>(0); // 0=Idle, 1=Uploading, 2=Parsing, 3=Embedding, 4=Success
  const [error, setError] = useState<string | null>(null);
  const [clearingDb, setClearingDb] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentsList, setDocumentsList] = useState<IndexedDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const loadDocuments = () => {
    setLoadingDocuments(true);
    api.getDocuments()
      .then((data) => setDocumentsList(data))
      .catch((err) => console.error('Error fetching documents:', err))
      .finally(() => setLoadingDocuments(false));
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const autoFillMetadata = (filename: string) => {
    const cleanName = filename.replace(/\.[^/.]+$/, ""); // strip extension
    const parts = cleanName.split(/[_\-\s]+/);
    
    // 1. Guess Company Name (first non-numeric part that isn't a keyword)
    let guessedCompany = "";
    for (const part of parts) {
      if (part.length >= 2 && isNaN(Number(part))) {
        const lower = part.toLowerCase();
        if (['10k', '10-k', 'annual', 'report', 'news', 'transcript', 'earnings', 'presentation', 'call', 'sec', 'filing', 'quarterly', 'pdf', 'txt'].includes(lower)) {
          continue;
        }
        guessedCompany = part.charAt(0).toUpperCase() + part.slice(1);
        break;
      }
    }
    if (guessedCompany) {
      setCompany(guessedCompany);
    }
    
    // 2. Guess Year (e.g. 2020 to 2029 or 2-digit years like 25)
    const yearMatch = cleanName.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      setYear(Number(yearMatch[1]));
    } else {
      const twoDigitMatch = cleanName.match(/(?:fy|q\d|[_#\-\s])(2[0-9])\b/i) || cleanName.match(/\b(2[0-9])$/);
      if (twoDigitMatch) {
        setYear(2000 + Number(twoDigitMatch[1]));
      }
    }
    
    // 3. Guess Quarter (Q1-Q4)
    const quarterMatch = cleanName.match(/\b(Q[1-4])\b/i);
    if (quarterMatch) {
      setQuarter(quarterMatch[1].toUpperCase());
    } else if (cleanName.toLowerCase().includes('fy') || cleanName.toLowerCase().includes('annual')) {
      setQuarter('FY');
    }
    
    // 4. Guess Document Type
    const lowerName = cleanName.toLowerCase();
    if (lowerName.includes('transcript') || lowerName.includes('call') || lowerName.includes('earnings')) {
      setDocumentType('Earnings Call Transcript');
    } else if (lowerName.includes('sec') || lowerName.includes('filing') || lowerName.includes('10q') || lowerName.includes('10-q')) {
      setDocumentType('SEC Filing');
    } else if (lowerName.includes('presentation') || lowerName.includes('investor') || lowerName.includes('ppt')) {
      setDocumentType('Investor Presentation');
    } else if (lowerName.includes('news') || lowerName.includes('article') || lowerName.includes('report-news')) {
      setDocumentType('Financial News');
    } else if (lowerName.includes('10k') || lowerName.includes('10-k') || lowerName.includes('annual')) {
      setDocumentType('Annual Report');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.pdf') || droppedFile.name.endsWith('.txt')) {
        setFile(droppedFile);
        setError(null);
        autoFillMetadata(droppedFile.name);
      } else {
        setError('Only PDF and TXT files are supported.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      autoFillMetadata(selectedFile.name);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !company.trim()) {
      setError('Please select a file and enter a company name.');
      return;
    }

    setUploading(true);
    setError(null);
    setProgressStep(1);
    setStatusMessage('Uploading source file to backend...');

    try {
      // Simulate steps to look professional (fast updates)
      setTimeout(() => {
        setProgressStep(2);
        setStatusMessage('Extracting document formatting & paragraphs...');
      }, 900);

      setTimeout(() => {
        setProgressStep(3);
        setStatusMessage('Chunking segments & executing risk category classifications...');
      }, 2100);

      const res = await api.uploadDocument(file, company, year, quarter, documentType);
      
      setProgressStep(4);
      setStatusMessage(`Complete! Generated ${res.chunks_created} embeddings. Saving vectors to Qdrant local client...`);
      
      setTimeout(() => {
        setProgressStep(5);
        setUploading(false);
        setFile(null);
        setCompany('');
        loadDocuments(); // Refresh the list of indexed files!
        onUploadSuccess(company);
      }, 1200);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ingestion failed. Please check your backend connection.');
      setUploading(false);
      setProgressStep(0);
    }
  };

  const handleClearDb = async () => {
    if (!window.confirm('Are you sure you want to clear the entire database? This deletes all vector indices and payloads.')) return;

    setClearingDb(true);
    try {
      const res = await api.clearDb();
      alert(res.message || 'Database collection cleared successfully.');
      loadDocuments(); // Refresh the list after clearing!
    } catch (err) {
      console.error(err);
      alert('Failed to clear database collection.');
    } finally {
      setClearingDb(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">Ingest Documents</h2>
        <p className="text-sm text-slate-400">
          Upload PDF annual reports, investor sheets, quarterly earnings transcripts, or news articles. RiskLens AI will automatically extract paragraphs, categorize threat dimensions, and build vector embeddings in Qdrant.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Form and Metadata */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl space-y-6">
          <form onSubmit={handleIngest} className="space-y-6">
            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                file
                  ? 'border-brand-purple/50 bg-brand-purple/5'
                  : 'border-glass hover:border-brand-purple/30 hover:bg-white/2'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.txt"
                className="hidden"
              />
              
              {file ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-neon-purple mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white truncate max-w-[280px]">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-glass flex items-center justify-center text-slate-400 mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Drag & drop files or click to browse</p>
                    <p className="text-xs text-slate-500 mt-1">Supports PDF (Annual reports) and TXT (Transcripts, news) up to 25MB</p>
                  </div>
                </div>
              )}
            </div>

            {/* Inputs grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Company Name</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Tesla, Apple, Nvidia"
                  className="w-full bg-black/50 border border-glass px-4 py-2.5 rounded-xl text-white focus:outline-none focus:border-brand-purple/50 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full bg-black/60 border border-glass px-4 py-2.5 rounded-xl text-white focus:outline-none focus:border-brand-purple/50 text-sm cursor-pointer"
                >
                  <option value="Annual Report">Annual Report (10-K)</option>
                  <option value="Earnings Call Transcript">Earnings Call Transcript</option>
                  <option value="SEC Filing">SEC Filing</option>
                  <option value="Investor Presentation">Investor Presentation</option>
                  <option value="Financial News">Financial News Article</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Filing Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-black/60 border border-glass px-4 py-2.5 rounded-xl text-white focus:outline-none focus:border-brand-purple/50 text-sm cursor-pointer"
                >
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">Reporting Quarter</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  className="w-full bg-black/60 border border-glass px-4 py-2.5 rounded-xl text-white focus:outline-none focus:border-brand-purple/50 text-sm cursor-pointer"
                >
                  <option value="FY">Full Year (FY)</option>
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl text-sm text-slate-300 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-brand-neon-rose flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit btn */}
            <button
              type="submit"
              disabled={uploading || !file || !company.trim()}
              className="w-full py-3 bg-gradient-to-r from-brand-purple to-violet-600 hover:from-brand-purple-dark hover:to-violet-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-glow-purple/15"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Document...</span>
                </>
              ) : (
                <span>Extract & Index Document</span>
              )}
            </button>
          </form>

          {/* Progress Indicators overlay */}
          {uploading && (
            <div className="border-t border-glass pt-6 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-200">{statusMessage}</span>
                <span className="font-bold text-brand-neon-purple font-mono">
                  {Math.round((progressStep / 5) * 100)}%
                </span>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-glass">
                <div
                  className="h-full bg-brand-purple rounded-full transition-all duration-500"
                  style={{ width: `${(progressStep / 5) * 100}%` }}
                ></div>
              </div>

              {/* Step checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] uppercase font-bold text-slate-500">
                <div className={`flex items-center gap-1.5 ${progressStep >= 1 ? 'text-brand-neon-cyan' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progressStep >= 1 ? 'bg-brand-neon-cyan' : 'bg-slate-600'}`}></div>
                  <span>1. Upload</span>
                </div>
                <div className={`flex items-center gap-1.5 ${progressStep >= 2 ? 'text-brand-neon-cyan' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progressStep >= 2 ? 'bg-brand-neon-cyan' : 'bg-slate-600'}`}></div>
                  <span>2. Parse Text</span>
                </div>
                <div className={`flex items-center gap-1.5 ${progressStep >= 3 ? 'text-brand-neon-cyan' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progressStep >= 3 ? 'bg-brand-neon-cyan' : 'bg-slate-600'}`}></div>
                  <span>3. Classify</span>
                </div>
                <div className={`flex items-center gap-1.5 ${progressStep >= 4 ? 'text-brand-neon-purple animate-pulse' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${progressStep >= 4 ? 'bg-brand-neon-purple' : 'bg-slate-600'}`}></div>
                  <span>4. Embed Vectors</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Database Management / Config panel */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between gap-6 border-glow-purple transition-all">
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-white">Database Control</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Managing index settings. To replace sample vector datasets or reset collections, utilize the reset controls.
            </p>
            
            <div className="p-3 bg-white/5 border border-glass rounded-xl space-y-1">
              <div className="text-[9px] uppercase font-bold text-slate-500">Active Storage Adapter</div>
              <div className="text-xs font-semibold text-brand-neon-cyan">Local Disk Qdrant Client</div>
              <div className="text-[10px] text-slate-400">Path: `./data/qdrant`</div>
            </div>
          </div>

          <button
            onClick={handleClearDb}
            disabled={clearingDb}
            className="w-full py-2.5 bg-rose-950/20 border border-rose-800/40 hover:bg-rose-950/50 hover:border-rose-700/60 text-brand-neon-rose rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-xs disabled:opacity-50"
          >
            {clearingDb ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Wipe Vector Database</span>
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="glass-panel p-6 rounded-2xl border border-glass space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-brand-neon-cyan" />
            <h3 className="font-bold text-lg text-white">Indexed Documents & Filings</h3>
          </div>
          <button 
            onClick={loadDocuments} 
            disabled={loadingDocuments}
            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all disabled:opacity-50"
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDocuments ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {loadingDocuments && documentsList.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">Fetching vector indexing summaries...</p>
        ) : documentsList.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-6 text-center">No filings indexed yet. Upload reports above to initialize the database.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-glass text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Document Type</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3">Filename Source</th>
                  <th className="py-2.5 px-3 text-right">Vectors Indexed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass text-slate-200">
                {documentsList.map((doc, idx) => (
                  <tr key={idx} className="hover:bg-white/1 transition-all">
                    <td className="py-3 px-3 font-semibold text-brand-neon-cyan">{doc.company}</td>
                    <td className="py-3 px-3 text-slate-300">{doc.document_type}</td>
                    <td className="py-3 px-3 text-slate-400">{doc.year} ({doc.quarter})</td>
                    <td className="py-3 px-3 text-slate-400 font-mono truncate max-w-[200px]" title={doc.source}>
                      {doc.source}
                    </td>
                    <td className="py-3 px-3 text-right font-bold font-mono text-brand-neon-purple">
                      {doc.chunks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
