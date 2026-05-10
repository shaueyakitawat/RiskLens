# RiskLens: Interactive Temporal RAG Risk Intelligence Platform

**Live Demo**: [risklens-nine-mu.vercel.app](https://risklens-nine-mu.vercel.app/)

RiskLens is an advanced corporate risk assessment platform designed to analyze, track, and visualize risk disclosures from complex SEC filings, transcripts, and financial reports chronologically. 

Unlike standard conversational search interfaces, RiskLens organizes ingestion documents into a structured vector database, auto-categorizes them across threat vectors, maps their chronological changes on a 2D network force simulation graph, and traces Year-over-Year (YoY) risk indices with deterministic evaluation metrics.

---

## 🚀 Why RiskLens? (How it beats copy-pasting to ChatGPT)

If you upload two PDFs to ChatGPT and ask it to analyze risk evolution, you face several major limitations that RiskLens solves:

1. **Chronological Alignment and Database Memory**: ChatGPT holds information in a flat conversational window. RiskLens splits documents into semantic chunks, tags them by metadata (`company`, `year`, `quarter`, `document_type`), and indexes them in a persistent vector database. This allows it to trace risk trajectories over decades without context window degradation.
2. **2D Interactive Force-Directed Graph**: RiskLens maps risk factors visually. It groups entities (companies), threat categories (e.g., supply chain, regulatory), and source passages into physical nodes using a particle physics simulation. This visual clustering makes finding systemic corridors of exposure immediate.
3. **Deterministic Evaluation Metrics**: ChatGPT cannot verify its own accuracy. RiskLens runs a programmatic, free, and deterministic validation engine to evaluate every answer:
   * **Groundedness Score**: Verifies what percentage of the output sentences directly map to a cited database segment `[Source X]`.
   * **Context Relevance**: Measures exact word overlap (precision-based) between the answer and source snippets to ensure the model isn't hallucinating.
4. **Local Embedding & Vector Pipeline**: 100% of the text parsing, document segmentation, category tagging, vector embedding, and similarity database lookups run locally. You retain full control over the data corridor.
5. **Failover Resilience (Gemini 2.5 + Groq)**: Built with an instant fallback system. If Gemini API rate limits are hit (429), it fails fast in under 1s and instantly routes requests to Groq (serving `Llama 3.3 70B` at 100+ tokens/sec).

---

## 🛠 Tech Stack

* **Frontend**: React (Vite, TypeScript), Tailwind CSS (Slate/Indigo premium corporate palette), Lucide Icons.
* **Backend**: FastAPI (Python 3.10+), Pydantic Settings, StatReload.
* **Vector Database**: Qdrant (Local disk storage mode).
* **Embeddings**: FastEmbed (local implementation of BAAI `bge-small-en-v1.5` dense model).
* **LLM Engine**: LangChain Chat Models supporting Google Gemini 2.5 Flash and Groq Llama 3.3 (70B) failover backups.
* **Parsers**: PyMuPDF & PyPDF extraction pipelines.

---

## 🏗 System Architecture & Workflow

```
               [Annual Reports / Earnings Transcripts (PDF/TXT)]
                                     │
                                     ▼
                              [Parser Engine]
                       (PyMuPDF / PyPDF Fallbacks)
                                     │
                                     ▼
                              [Chunker & Categorizer]
                    (Auto-tags Company, Year, and Categories)
                                     │
                                     ▼
                           [Local Embedding Model]
                           (BGE-small-en-v1.5)
                                     │
                                     ▼
                            [Qdrant Vector DB]
                             (Local disk storage)
                                     │
                                     ▼
                               [Retriever]
                   (Dense Vector similarity matching)
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
            [RAG Engine]                        [Network Graph]
        (Gemini + Groq Fallback)            (Force Physics Simulation)
                  │                                     │
                  ▼                                     ▼
      [Citations + Groundedness]              [Visual Risk Clusters]
```

---

## 🌟 Key Features

* **Overview Dashboard**: Overall weighted risk ratings, score dial gauges, and severity summaries across 6 domains (Supply Chain, Regulatory, Financial, Competition, Geopolitical, Cybersecurity).
* **Risk Explorer Graph**: Interactive force-directed network graph. Click nodes to trace parent entities, category clusters, read source segments, or request deep AI explainers.
* **Risk Timeline**: Traces chronological risk vectors using a line graph with a **vertical collision relaxation algorithm** to prevent label overlapping, combined with a vertical timeline tree mapping events.
* **Compare Matrix**: Direct comparison of two companies, isolating shared vulnerabilities and unique exposures.
* **Semantic Search & News Mode**: Query the database using concept vectors or paste a news URL/article to audit management disclosures against current events (highlighting hidden gaps).

---

## 🏃 Getting Started

Please see the [RUN_GUIDE.md](RUN_GUIDE.md) for detailed installation instructions and backend/frontend configuration details.
