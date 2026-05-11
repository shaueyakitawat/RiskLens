const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface Citation {
  id: number;
  source: string;
  page_number: number;
  year: number | string;
  quarter: string;
  categories: string[];
  snippet: string;
  score: number;
}

export interface RAGEvaluation {
  groundedness_score: number;
  context_relevance: number;
  label: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  chunks: string[];
  evaluation?: RAGEvaluation;
}

export interface IndexedDocument {
  company: string;
  year: number;
  quarter: string;
  document_type: string;
  source: string;
  chunks: number;
}

export interface DashboardMetric {
  score: number;
  explanation: string;
}

export interface DashboardResponse {
  overall?: DashboardMetric;
  supply_chain?: DashboardMetric;
  regulatory?: DashboardMetric;
  financial?: DashboardMetric;
  competition?: DashboardMetric;
  geopolitical?: DashboardMetric;
  cybersecurity?: DashboardMetric;
  [key: string]: DashboardMetric | undefined;
}

export interface TimelineItem {
  year: number;
  title: string;
  summary: string;
  category: string;
  quote: string;
  source: string;
  page: number;
}

export interface TemporalScoreItem {
  year: number;
  scores: {
    supply_chain: number;
    regulatory: number;
    financial: number;
    competition: number;
    geopolitical: number;
    cybersecurity: number;
  };
}

export interface ComparisonResponse {
  shared_risks: string[];
  unique_company_a: string[];
  unique_company_b: string[];
  categories: {
    operational: string;
    financial: string;
    regulatory: string;
    supply_chain: string;
  };
  summary: string;
  error?: string;
}

export interface SemanticSearchResult {
  text: string;
  score: number;
  source: string;
  page: number;
  year: number | string;
  quarter: string;
  document_type: string;
  categories: string[];
}

export interface GraphNode {
  id: string;
  label?: string;
  group: 'company' | 'category' | 'risk';
  val: number;
  description?: string;
  company?: string;
  categories?: string[];
  source?: string;
  page?: number;
  year?: string | number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ExplainResponse {
  importance: string;
  impact: string;
  probability: string;
  trend: string;
  evidence: string;
}

export interface NewsCompareResponse {
  new_risks: string[];
  discrepancies: string[];
  summary: string;
  error?: string;
}

export const api = {
  async health(): Promise<{ status: string; provider: string }> {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
  },

  async uploadDocument(
    file: File,
    company: string,
    year: number,
    quarter: string = 'FY',
    documentType: string = 'Annual Report'
  ): Promise<{ status: string; message: string; chunks_created: number }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company', company);
    formData.append('year', year.toString());
    formData.append('quarter', quarter);
    formData.append('document_type', documentType);

    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to upload document');
    }
    return res.json();
  },

  async getCompanies(): Promise<string[]> {
    const res = await fetch(`${API_BASE_URL}/companies`);
    return res.json();
  },

  async getDocuments(): Promise<IndexedDocument[]> {
    const res = await fetch(`${API_BASE_URL}/documents`);
    return res.json();
  },

  async queryRAG(company: string, question: string): Promise<QueryResponse> {
    const res = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, question }),
    });
    return res.json();
  },

  async getDashboard(company: string): Promise<DashboardResponse> {
    const res = await fetch(`${API_BASE_URL}/company/${encodeURIComponent(company)}/dashboard`);
    return res.json();
  },

  async getTimeline(company: string): Promise<TimelineItem[]> {
    const res = await fetch(`${API_BASE_URL}/company/${encodeURIComponent(company)}/timeline`);
    return res.json();
  },

  async getTemporalScores(company: string): Promise<TemporalScoreItem[]> {
    const res = await fetch(`${API_BASE_URL}/company/${encodeURIComponent(company)}/temporal-scores`);
    return res.json();
  },

  async compareCompanies(companyA: string, companyB: string): Promise<ComparisonResponse> {
    const res = await fetch(`${API_BASE_URL}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_a: companyA, company_b: companyB }),
    });
    return res.json();
  },

  async semanticSearch(
    query: string,
    company?: string,
    year?: number,
    category?: string
  ): Promise<SemanticSearchResult[]> {
    const params = new URLSearchParams({ query });
    if (company) params.append('company', company);
    if (year) params.append('year', year.toString());
    if (category) params.append('category', category);

    const res = await fetch(`${API_BASE_URL}/semantic-search?${params.toString()}`);
    return res.json();
  },

  async getGraph(company?: string): Promise<GraphResponse> {
    const url = company ? `${API_BASE_URL}/graph?company=${encodeURIComponent(company)}` : `${API_BASE_URL}/graph`;
    const res = await fetch(url);
    return res.json();
  },

  async explainRisk(riskTitle: string, context: string): Promise<ExplainResponse> {
    const res = await fetch(`${API_BASE_URL}/explain-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risk_title: riskTitle, context }),
    });
    return res.json();
  },

  async newsCompare(company: string, newsText: string, newsUrl?: string): Promise<NewsCompareResponse> {
    const res = await fetch(`${API_BASE_URL}/news-compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, news_text: newsText, news_url: newsUrl || undefined }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'News comparison failed.');
    }
    return res.json();
  },

  async clearDb(): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/clear-db`, {
      method: 'POST',
    });
    return res.json();
  },
};
