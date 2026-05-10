# Local embeddings active reload trigger
import logging
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.vector_store.qdrant_store import get_vector_store, clear_vector_store, get_qdrant_client
from app.ingestion.parser import parse_pdf, parse_txt
from app.ingestion.chunker import chunk_documents
from app.retriever.retriever import retrieve_similar_chunks
from app.risk_analysis import analyzer
from app.llm.llm_service import get_llm
from langchain_core.messages import SystemMessage, HumanMessage


# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RiskLens AI API",
    description="Temporal Risk Intelligence Platform API backend.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.database.seeding import seed_database_if_empty

@app.on_event("startup")
def on_startup():
    logger.info("Server starting up. Checking database seeding status...")
    seed_database_if_empty()

# Pydantic Schemas
class QueryRequest(BaseModel):
    company: str
    question: str

class CompareRequest(BaseModel):
    company_a: str
    company_b: str

class ExplainRequest(BaseModel):
    risk_title: str
    context: str

def scrape_url_to_text(url: str) -> str:
    """
    Fetches the content of a URL and extracts readable text by stripping HTML tags.
    """
    import httpx
    import re
    import html
    try:
        logger.info(f"Scraping news text from URL: {url}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=10.0)
        if resp.status_code != 200:
            raise ValueError(f"HTTP error {resp.status_code} loading URL")
            
        html_content = resp.text
        
        # Simple HTML to text extraction
        # 1. Remove script and style elements
        html_content = re.sub(r'<(script|style|header|footer|nav)[\s\S]*?>[\s\S]*?<\/\1>', ' ', html_content, flags=re.IGNORECASE)
        # 2. Strip all remaining HTML tags
        text = re.sub(r'<[^>]+>', ' ', html_content)
        # 3. Unescape HTML entities
        text = html.unescape(text)
        # 4. Normalize whitespace
        lines = [line.strip() for line in text.splitlines()]
        text = "\n".join([line for line in lines if line])
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Limit scraped text length to 12,000 chars to avoid LLM context overflow
        return text[:12000]
    except Exception as e:
        logger.error(f"Error scraping URL '{url}': {str(e)}")
        raise ValueError(f"Scraping URL failed: {str(e)}")

class NewsCompareRequest(BaseModel):
    company: str
    news_text: Optional[str] = ""
    news_url: Optional[str] = None


# Endpoints
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "provider": settings.LLM_PROVIDER}


@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    company: str = Form(...),
    year: int = Form(...),
    quarter: str = Form("FY"),
    document_type: str = Form("Annual Report")
):
    """
    Ingests and indexes a financial document (PDF or TXT).
    """
    logger.info(f"Received upload request for {company} ({year} {quarter}) - File: {file.filename}")
    try:
        content = await file.read()
        filename = file.filename or "uploaded_document"
        
        # 1. Parse based on file extension
        if filename.endswith(".pdf"):
            documents = parse_pdf(content, filename)
        elif filename.endswith(".txt"):
            text_str = content.decode("utf-8", errors="ignore")
            documents = parse_txt(text_str, filename)
        else:
            raise HTTPException(status_code=400, detail="Only .pdf and .txt files are supported.")
            
        if not documents:
            raise HTTPException(status_code=400, detail="No readable text could be extracted from this document.")
            
        # 2. Chunk and tag with metadata/categories
        chunks = chunk_documents(
            documents=documents,
            company=company,
            year=year,
            quarter=quarter,
            document_type=document_type
        )
        
        # 3. Embed and save to Qdrant
        vector_store = get_vector_store()
        
        import time
        is_local = settings.EMBEDDING_PROVIDER == "local"
        batch_size = 50 if is_local else 100
        sleep_time = 0.0
        
        logger.info(f"Adding {len(chunks)} chunks to Qdrant in batches of {batch_size} (throttled={not is_local})...")
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            vector_store.add_documents(batch)
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        # Invalidate caches since new data is uploaded
        analyzer.invalidate_dashboard_cache(company)
        analyzer.invalidate_timeline_cache(company)
        analyzer.invalidate_comparison_cache(company)
        
        return {
            "status": "success",
            "message": f"Successfully ingested '{filename}' for {company}.",
            "pages_parsed": len(documents),
            "chunks_created": len(chunks)
        }
        
    except Exception as e:
        logger.error(f"Error during upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.get("/api/companies")
def get_companies():
    """
    Scrolls Qdrant to retrieve list of unique company names indexed.
    """
    client = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    if not client.collection_exists(collection_name):
        return []
        
    try:
        scroll_result = client.scroll(
            collection_name=collection_name,
            limit=300,
            with_payload=True,
            with_vectors=False
        )
        points = scroll_result[0]
        companies = set()
        for pt in points:
            if pt.payload and "metadata" in pt.payload:
                comp = pt.payload["metadata"].get("company")
                if comp:
                    companies.add(comp)
        return sorted(list(companies))
    except Exception as e:
        logger.error(f"Error fetching company list: {str(e)}")
        return []

@app.get("/api/documents")
def get_documents():
    """
    Scrolls Qdrant to aggregate and return all indexed documents and their chunk counts.
    """
    client = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    if not client.collection_exists(collection_name):
        return []
        
    try:
        # Retrieve payload of points from Qdrant
        scroll_result = client.scroll(
            collection_name=collection_name,
            limit=2000,
            with_payload=True,
            with_vectors=False
        )
        points = scroll_result[0]
        
        docs_map = {}
        for pt in points:
            if pt.payload and "metadata" in pt.payload:
                meta = pt.payload["metadata"]
                company = meta.get("company", "Unknown")
                year = meta.get("year", "Unknown")
                quarter = meta.get("quarter", "FY")
                doc_type = meta.get("document_type", "Annual Report")
                source = meta.get("source", "Unknown")
                
                key = (company, year, quarter, doc_type, source)
                if key not in docs_map:
                    docs_map[key] = 0
                docs_map[key] += 1
                
        result = []
        for key, count in docs_map.items():
            company, year, quarter, doc_type, source = key
            result.append({
                "company": company,
                "year": year,
                "quarter": quarter,
                "document_type": doc_type,
                "source": source,
                "chunks": count
            })
            
        # Sort by company, and year descending
        result.sort(key=lambda x: (x["company"], -int(x["year"]) if isinstance(x["year"], int) or str(x["year"]).isdigit() else 0))
        return result
    except Exception as e:
        logger.error(f"Error fetching document list: {str(e)}")
        return []

@app.post("/api/query")
def query_rag(req: QueryRequest):
    """
    Queries RiskLens AI RAG pipeline for a company.
    """
    logger.info(f"RAG query received for {req.company}: {req.question}")
    return analyzer.answer_company_question(req.company, req.question)

@app.get("/api/company/{company}/dashboard")
def get_dashboard(company: str):
    """
    Returns explainable risk category scores and overview dashboard info.
    """
    logger.info(f"Dashboard metrics request for {company}")
    return analyzer.calculate_risk_dashboard(company)

@app.get("/api/company/{company}/timeline")
def get_timeline(company: str):
    """
    Generates temporal risk timeline.
    """
    logger.info(f"Timeline analysis request for {company}")
    return analyzer.analyze_temporal_risks(company)

@app.get("/api/company/{company}/temporal-scores")
def get_temporal_scores(company: str):
    """
    Returns Year-over-Year category severity scores for plotting.
    """
    logger.info(f"Temporal scores request for {company}")
    return analyzer.get_yearly_category_scores(company)


@app.post("/api/compare")
def compare_companies(req: CompareRequest):
    """
    Compares risks side-by-side between two companies.
    """
    logger.info(f"Comparison request: {req.company_a} vs {req.company_b}")
    return analyzer.compare_companies_risks(req.company_a, req.company_b)

@app.get("/api/semantic-search")
def semantic_search(
    query: str,
    company: Optional[str] = None,
    year: Optional[int] = None,
    category: Optional[str] = None
):
    """
    Semantic search returning matched chunks and similarity scores without generating answers.
    """
    results = analyzer.retrieve_similar_chunks(
        query=query,
        company=company,
        year=year,
        category=category,
        k=10
    )
    
    parsed_results = []
    for doc, score in results:
        meta = doc.metadata
        parsed_results.append({
            "text": doc.page_content,
            "score": float(score),
            "source": meta.get("source", "unknown"),
            "page": meta.get("page_number", 1),
            "year": meta.get("year", "N/A"),
            "quarter": meta.get("quarter", "FY"),
            "document_type": meta.get("document_type", "Annual Report"),
            "categories": meta.get("categories", [])
        })
    return parsed_results

@app.get("/api/graph")
def get_graph(company: Optional[str] = None):
    """
    Generates nodes and links for the interactive risk network graph.
    """
    logger.info(f"Graph generation request (filter={company})")
    return analyzer.generate_knowledge_graph_data(company)

@app.post("/api/explain-risk")
def explain_risk(req: ExplainRequest):
    """
    Deconstructs a clicked risk node.
    """
    logger.info(f"Explain Risk request for: {req.risk_title}")
    return analyzer.get_risk_explanation(req.risk_title, req.context)

@app.post("/api/news-compare")
def news_compare(req: NewsCompareRequest):
    """
    News Mode: Compares news articles to the annual report disclosures and highlights gaps.
    """
    logger.info(f"News Mode comparison requested for: {req.company}")
    
    n_text = req.news_text
    if req.news_url:
        try:
            n_text = scrape_url_to_text(req.news_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    if not n_text or not n_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Please provide either news text or a valid news URL."
        )
        
    # Retrieve top chunks for company general business risks
    report_chunks = retrieve_similar_chunks(
        query="general business regulatory operating risks disclosures", 
        company=req.company, 
        k=5
    )
    
    if not report_chunks:
        raise HTTPException(
            status_code=400, 
            detail=f"Please upload annual reports or documents for '{req.company}' first before running News Mode comparison."
        )
        
    report_context = "\n\n".join([d.page_content for d, _ in report_chunks])

    
    system_prompt = (
        "You are RiskLens AI, an advanced investigative financial auditor.\n"
        "Compare the recently uploaded news block against the official risk disclosures of the company.\n"
        "Identify:\n"
        "1. Gaps / New Risks: Risks mentioned in the news that are NOT disclosed (or are severely downplayed) in the annual report.\n"
        "2. Discrepancies: Conflicts in statements (e.g., report claims stable manufacturing; news reveals a strike or shutdowns).\n"
        "3. Comparison Summary: High-level contrast of what management claims vs what the news reports.\n"
        "Format your output strictly as a JSON object matching this schema:\n"
        "{\n"
        "  \"new_risks\": [],\n"
        "  \"discrepancies\": [],\n"
        "  \"summary\": \"\"\n"
        "}\n"
        "Fill the 'new_risks' array with descriptions of identified new risks, the 'discrepancies' array with descriptions of identified conflicts, and 'summary' with your comparative summary. "
        "If there are no new risks or discrepancies, leave those arrays empty. Do not return any placeholder text or description from this instruction."
    )
    
    human_prompt = (
        f"Company: {req.company}\n"
        f"Annual Report Disclosures:\n{report_context}\n\n"
        f"Recent News Report:\n{n_text}"
    )
    
    try:
        llm = get_llm(temperature=0.1)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])
        return analyzer.clean_and_parse_json(response.content)
    except Exception as e:
        logger.error(f"Error in News Mode comparison: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clear-db")
def clear_db():
    """
    Deletes the current collection in the vector database and recreates it.
    """
    logger.info("Clearing Qdrant collection...")
    try:
        clear_vector_store()
        analyzer.clear_all_dashboard_cache() # Clear all dashboard cache files
        analyzer.clear_all_timeline_cache()
        analyzer.clear_all_comparison_cache()
        seed_database_if_empty()
        return {"status": "success", "message": "Database collection cleared and re-seeded with sample company vectors."}
    except Exception as e:
        logger.error(f"Error clearing database: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
