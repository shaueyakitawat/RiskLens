# Technical Theory & Algorithmic Design

This document details the mathematical models, algorithmic designs, and technical decisions implemented across the RiskLens RAG pipeline.

---

## 1. Document Parsing & Semantic Windowing

### Ingestion Filter
To save vector space and prevent noise (e.g., balance sheets, indexes, and legal disclosures), the document parser filters out text blocks. 
* It checks page text content against risk-heavy keywords.
* It parses a maximum of the top 10 risk-heavy pages from large PDFs.
* Utilizes a dual-engine parser: attempts `PyMuPDF` (fast and handles complex layout text blocks) and falls back to `PyPDF` if an encoding boundary index error is raised.

### Semantic Sliding Window
Document passages are chunked using a sliding character window:
* **Chunk Size**: 1000 characters
* **Chunk Overlap**: 200 characters
This ensures that risk disclosures spanning sentence boundaries are captured whole without context truncation.

### Category Classification
Every chunk is classified into one of the core threat domains using a deterministic keyword density matcher. The classification groups mapping includes:
* **Supply Chain**: supply chain, logistics, raw materials, manufacturing, vendor, shipper, freight, warehouse, assembly, factory
* **Regulatory**: compliance, antitrust, regulation, legal, litigation, commission, government, lawsuit, penalty, fine
* **Financial**: liquidity, interest rate, forex, exchange rate, currency, debt, credit, hedge, inflation, recession, capital
* **Competition**: competitor, rival, market share, capacity, pricing pressure, AMD, Intel, ASICs, custom chip, capture
* **Geopolitical**: tariff, trade war, export control, sanctions, geopolitical, conflict, war, border, international trade
* **Cybersecurity**: cyber, hack, breach, nation-state, Midnight Blizzard, ransomware, security incident, vulnerability, endpoint

---

## 2. Dense Vector Embeddings & Similarity Matching

### Embeddings Model
We utilize `BAAI/bge-small-en-v1.5` via the local `FastEmbed` client.
* **Vector Dimension**: 384
* **Execution**: Local CPU execution (runs locally on the host machine in <10ms, eliminating network cost and privacy concerns).

### Similarity Search
To retrieve relevant context chunks, the search query vector $q$ and chunk vectors $v_i$ are compared using **Cosine Similarity**:

\[ \text{Cosine Similarity}(q, v_i) = \frac{q \cdot v_i}{\|q\| \|v_i\|} \]

Qdrant ranks results using this metric. Metadata filters (for `company`, `year`, and `category`) are injected as hard filters directly inside the Qdrant query API to narrow search spaces before vector computation.

---

## 3. Programmatic RAG Evaluation Metrics

Instead of utilizing expensive, slow, and non-deterministic LLM-as-a-judge APIs, RiskLens runs a custom, free, lightweight evaluation engine that scores answers programmatically.

### Groundedness Score
Groundedness measures what percentage of sentences in the generated answer are grounded in a cited source passage.
If the answer indicates lack of information or if there are no citations, the score is mapped accordingly. For informative answers, we split the response into sentences and calculate:

\[ \text{Groundedness} = \frac{\text{Sentences containing citation tag } [Source\ X]}{\text{Total sentences in answer}} \times 100 \]

### Context Relevance (Containment Precision)
Groundedness alone can be cheated if a model hallucinates details but appends `[Source X]` randomly. Context Relevance acts as a gatekeeper by measuring the vocabulary overlap between the answer and the cited source snippets.
We filter out standard English grammar stopwords (the, and, a, of, is, with, etc.) to form two sets of unique lowercase words:
* $W_a$: Words in the generated answer.
* $W_c$: Words in the cited source snippets.

We then calculate precision-based containment relevance:

\[ \text{Relevance} = \frac{|W_a \cap W_c|}{|W_a|} \times 100 \]

### Score Gatekeeping
If the containment relevance is extremely low ($\text{Relevance} < 15\%$), it indicates the model is quoting sources that do not contain the concepts it is discussing. The system automatically caps the Groundedness score to a maximum of $40\%$ to penalize hallucination.

### Rating Labels
* **Excellent**: Groundedness $\ge 85\%$ and Relevance $\ge 50\%$
* **Good**: Groundedness $\ge 60\%$ and Relevance $\ge 30\%$
* **Fair**: Groundedness $\ge 40\%$
* **Needs Improvement**: Groundedness $< 40\%$

---

## 4. Weighted Risk Index Math

For the temporal line chart, zero-temperature LLM dashboard requests are backed up by a deterministic counting model to ensure stability and reproducibility across runs.

The Year-over-Year category index score is calculated using chunk densities and keyword frequencies:

\[ \text{Raw Score} = 15 + \left(\frac{\text{matching chunks}}{\text{total chunks}} \times 60\right) + \min(25, \text{keyword matches} \times 3) \]

* **Base score**: 15 (representing minimal general risk exposure).
* **Chunk ratio**: up to 60 (evaluates what proportion of the company's filing pages discuss this specific category).
* **Keyword density**: up to 25 (measures the frequency of acute threat terms, e.g., "tariffs" or "Foxconn").
* The score is capped between $10$ and $100$.

---

## 5. Network Graph Force Physics

The interactive Risk Explorer uses a particle physics simulation built on a 2D HTML5 Canvas.
* **Link Force**: Acts like a spring pulling connected nodes together. Link distance is set to 80px for company-to-risk links and 60px for category-to-risk links.
* **Many-Body Charge Force**: Electrostatic repulsion that pushes all nodes apart, preventing overlapping node blobs. Strength is set to `-180` to keep the layout clean.
* **Center Force**: Subtle gravitational pull towards the canvas center coordinates to prevent nodes from drifting out of view.
* **Simulation Cooling (Alpha Decay)**: Set to `0.94` so that the graph settles and stabilizes under 2 seconds after loading, resolving the "dancing node" problem.
