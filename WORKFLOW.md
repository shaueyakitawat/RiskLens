# System Workflows & Architecture Diagrams

This document details the step-by-step workflow of the major pipelines in RiskLens: Ingestion, Retrieval (RAG), Graph Explorer, and Temporal Scoring.

---

## 1. Document Ingestion Workflow

This workflow represents the data pipeline from uploading a raw PDF/TXT document to storing semantic vectors in Qdrant.

```mermaid
graph TD
    A[User Uploads PDF/TXT File] --> B{Check File Type}
    B -- .pdf --> C[parse_pdf Ingestion]
    B -- .txt --> D[parse_txt Ingestion]
    C --> E[Try PyMuPDF Extract]
    E -- Error / Fail --> F[Fallback: PyPDF Extract]
    E -- Success --> G[Clean Raw Text Blocks]
    F --> G
    D --> G
    G --> H[chunk_documents sliding window]
    H --> I[Auto-tag Company, Year, & Quarter Metadata]
    I --> J[Auto-classify Categories using Keyword Density]
    J --> K[Compute 384-dim Dense Vectors locally with FastEmbed]
    K --> L[Save Batches to Qdrant Disk Collection]
    L --> M[Invalidate Dashboard, Timeline, & Comparison Caches]
```

---

## 2. Retrieval & RAG QA Workflow

This workflow represents the conversational search query pipeline executing semantic vector matches, generating answers, and evaluating response quality.

```mermaid
graph TD
    A[User Submits Question] --> B[Generate Question Embeddings locally]
    B --> C[Query Qdrant DB with Company & Year filters]
    C --> D[Retrieve top 6 scoring chunks]
    D --> E[Check for empty results]
    E -- Empty --> F[Return Ingest Documents warning]
    E -- Not Empty --> G[Assemble Context & LLM Prompt]
    G --> H[Invoke Gemini 2.5 Flash]
    H -- Success --> I[Parse Answer and Citations]
    H -- Rate Limit 429 / Fail --> J[Fallback: Invoke Groq Llama 3.3]
    J --> I
    I --> K[Run evaluate_rag_response]
    K --> L[Calculate Groundedness Sentence Score]
    K --> M[Calculate Stopword-Filtered Vocabulary Overlap]
    L --> N{Overlap < 15%?}
    M --> N
    N -- Yes --> O[Cap Groundedness at 40% Hallucination Warning]
    N -- No --> P[Map Rating Label]
    O --> P
    P --> Q[Return Answer, Citations, and Evaluation JSON to client]
```

---

## 3. Knowledge Graph Construction Workflow

This workflow illustrates how the 2D Force-Directed Network Graph compiles nodes and links from Qdrant scroll requests.

```mermaid
graph TD
    A[Client loads Graph tab or updates Workspace] --> B[Get /api/graph?company=Name]
    B --> C[Scroll Qdrant collection for recent points]
    C --> D[Count risks per company & categories]
    D --> E[Generate Company Entity Nodes]
    D --> F[Generate Category Nodes]
    D --> G[Generate SEC Excerpt Risk Nodes]
    E --> H[Create links: Company -> Risk Node]
    F --> H
    G --> H
    H --> I[Create links: Risk Node -> Category Node]
    I --> J[Return Graph Nodes & Links JSON]
    J --> K[Render on HTML5 Canvas]
    K --> L[Execute D3-style Force Simulation link, charge, center]
    L --> M[Cool simulation decay=0.94 to settle nodes in < 2s]
```

---

## 4. Chronological Timeline Scoring Workflow

This workflow represents how the YoY risk trends are computed and plotted over time.

```mermaid
graph TD
    A[Client updates selected company workspace] --> B[Get /api/company/Name/temporal-scores]
    B --> C[Fetch all points for company from Qdrant]
    C --> D[Group points by Metadata Year]
    D --> E[Loop through sorted years]
    E --> F[Calculate matching category chunks / total chunks]
    F --> G[Count keyword frequencies in page content]
    G --> H[Compute Score: base + ratio + keyword matches]
    H --> I[Return Chronological Score List]
    I --> J[Plot SVG YoY Line Chart in frontend]
    J --> K[Execute label relaxation algorithm to prevent overlaps]
    K --> L[Render timeline tree cards under chart]
```
