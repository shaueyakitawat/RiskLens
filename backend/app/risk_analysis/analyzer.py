import json
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document
from app.config import settings
from app.llm.llm_service import get_llm
from app.retriever.retriever import retrieve_similar_chunks
from app.vector_store.qdrant_store import get_qdrant_client, get_vector_store
from qdrant_client.http import models as qmodels

logger = logging.getLogger(__name__)

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # backend/
DATA_DIR = os.path.join(BASE_DIR, "data")

DASHBOARD_CACHE_FILE = os.path.join(DATA_DIR, "dashboard_cache.json")
TIMELINE_CACHE_FILE = os.path.join(DATA_DIR, "timeline_cache.json")
COMPARISON_CACHE_FILE = os.path.join(DATA_DIR, "comparison_cache.json")

# 1. DASHBOARD CACHE
def load_dashboard_cache() -> Dict[str, Any]:
    if not os.path.exists(DASHBOARD_CACHE_FILE):
        return {}
    try:
        with open(DASHBOARD_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading dashboard cache: {e}")
        return {}

def save_dashboard_cache(cache: Dict[str, Any]):
    os.makedirs(os.path.dirname(DASHBOARD_CACHE_FILE), exist_ok=True)
    try:
        with open(DASHBOARD_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving dashboard cache: {e}")

def invalidate_dashboard_cache(company: str):
    cache = load_dashboard_cache()
    if company in cache:
        del cache[company]
        save_dashboard_cache(cache)
        logger.info(f"Invalidated dashboard cache for company: {company}")

def clear_all_dashboard_cache():
    try:
        cache = load_dashboard_cache()
        # Keep only seeded companies
        cleared = {k: v for k, v in cache.items() if k in ["Apple", "Nvidia", "Microsoft"]}
        save_dashboard_cache(cleared)
        logger.info("Cleared dashboard cache (preserved default companies).")
    except Exception as e:
        logger.error(f"Error clearing dashboard cache: {e}")

# 2. TIMELINE CACHE
def load_timeline_cache() -> Dict[str, Any]:
    if not os.path.exists(TIMELINE_CACHE_FILE):
        return {}
    try:
        with open(TIMELINE_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading timeline cache: {e}")
        return {}

def save_timeline_cache(cache: Dict[str, Any]):
    os.makedirs(os.path.dirname(TIMELINE_CACHE_FILE), exist_ok=True)
    try:
        with open(TIMELINE_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving timeline cache: {e}")

def invalidate_timeline_cache(company: str):
    cache = load_timeline_cache()
    if company in cache:
        del cache[company]
        save_timeline_cache(cache)
        logger.info(f"Invalidated timeline cache for company: {company}")

def clear_all_timeline_cache():
    try:
        cache = load_timeline_cache()
        # Keep only seeded companies
        cleared = {k: v for k, v in cache.items() if k in ["Apple", "Nvidia", "Microsoft"]}
        save_timeline_cache(cleared)
        logger.info("Cleared timeline cache (preserved default companies).")
    except Exception as e:
        logger.error(f"Error clearing timeline cache: {e}")

# 3. COMPARISON CACHE
def load_comparison_cache() -> Dict[str, Any]:
    if not os.path.exists(COMPARISON_CACHE_FILE):
        return {}
    try:
        with open(COMPARISON_CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading comparison cache: {e}")
        return {}

def save_comparison_cache(cache: Dict[str, Any]):
    os.makedirs(os.path.dirname(COMPARISON_CACHE_FILE), exist_ok=True)
    try:
        with open(COMPARISON_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Error saving comparison cache: {e}")

def invalidate_comparison_cache(company: str):
    cache = load_comparison_cache()
    to_delete = []
    for key in cache:
        if company in key.split("_vs_"):
            to_delete.append(key)
    if to_delete:
        for k in to_delete:
            del cache[k]
        save_comparison_cache(cache)
        logger.info(f"Invalidated comparison cache entries containing: {company}")

def clear_all_comparison_cache():
    try:
        cache = load_comparison_cache()
        # Keep comparisons between default companies only
        cleared = {}
        default_companies = ["Apple", "Nvidia", "Microsoft"]
        for key, val in cache.items():
            parts = key.split("_vs_")
            if len(parts) == 2 and parts[0] in default_companies and parts[1] in default_companies:
                cleared[key] = val
        save_comparison_cache(cleared)
        logger.info("Cleared comparison cache (preserved default companies).")
    except Exception as e:
        logger.error(f"Error clearing comparison cache: {e}")


def clean_and_parse_json(text: str) -> Dict[str, Any]:
    """
    Cleans markdown formatting and parses JSON from LLM responses safely.
    """
    # Remove markdown code fences if present
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        # Try finding the first '{' and last '}'
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
        else:
            json_str = text.strip()
            
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {text}. Error: {str(e)}")
        # Return a fallback structure
        return {"error": "Failed to parse LLM response as JSON", "raw": text}

def clean_and_parse_json_list(text: str) -> List[Any]:
    """
    Cleans markdown formatting and parses JSON lists from LLM responses safely.
    """
    match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        start = text.find('[')
        end = text.rfind(']')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
        else:
            json_str = text.strip()
            
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON List: {text}. Error: {str(e)}")
        return []

def evaluate_rag_response(answer: str, citations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes lightweight evaluation metrics for the RAG answer:
    1. Groundedness Score: percentage of sentences containing a valid citation [Source X].
    2. Context Relevance: containment of answer terms in the retrieved citation snippets.
    3. Evaluation Label: 'Excellent', 'Good', 'Fair', 'Needs Improvement'.
    """
    if "cannot find sufficient information" in answer.lower() or not citations:
        return {
            "groundedness_score": 100,
            "context_relevance": 0,
            "label": "No Data (Grounded)"
        }
        
    # Split answer into lines first, then split lines into sentences
    sentences = []
    for line in answer.split('\n'):
        line = line.strip()
        if not line:
            continue
        # Split each line by sentence ending punctuation
        line_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', line) if s.strip()]
        sentences.extend(line_sentences)

    if not sentences:
        return {"groundedness_score": 0, "context_relevance": 0, "label": "No Output"}
        
    cited_count = 0
    for s in sentences:
        # Check if sentence has a citation like [Source 1] or [Source 1, Source 2]
        # Matches [Source followed by space and digit
        if re.search(r'\[Source \d+', s):
            cited_count += 1
            
    groundedness = int((cited_count / len(sentences)) * 100)
    
    # Context relevance: Containment similarity (precision-based overlap)
    # Stopwords to filter out basic English grammar words
    stopwords = {
        "the", "and", "a", "of", "to", "in", "is", "that", "it", "for", "on", "with", 
        "as", "at", "by", "an", "be", "this", "are", "from", "or", "have", "has", "had", 
        "will", "would", "shall", "should", "can", "could", "may", "might", "must", 
        "us", "we", "our", "their", "its", "but", "not", "he", "she", "they", "i", 
        "you", "me", "my", "your", "them", "his", "her", "which", "who", "whom", 
        "whose", "what", "where", "when", "why", "how", "about", "their", "there", "then"
    }
    
    answer_words = set(re.findall(r'\w+', answer.lower())) - stopwords
    citation_text = " ".join([c.get("snippet", "") for c in citations]).lower()
    citation_words = set(re.findall(r'\w+', citation_text)) - stopwords
    
    if answer_words:
        intersection = answer_words.intersection(citation_words)
        relevance = int((len(intersection) / len(answer_words)) * 100)
    else:
        relevance = 0
        
    # Groundedness adjustment: if Jaccard similarity is extremely low, cap groundedness
    if relevance < 15:
        groundedness = min(groundedness, 40)
        
    # Determine label
    if groundedness >= 85 and relevance >= 50:
        label = "Excellent (Highly Grounded)"
    elif groundedness >= 60 and relevance >= 30:
        label = "Good (Grounded)"
    elif groundedness >= 40:
        label = "Fair (Weakly Grounded)"
    else:
        label = "Needs Improvement (Low Grounding)"
        
    return {
        "groundedness_score": groundedness,
        "context_relevance": relevance,
        "label": label
    }


# 1. RAG QUESTION ANSWERING
def answer_company_question(company: str, question: str) -> Dict[str, Any]:
    """
    Retrieves relevant chunks and generates a grounded answer with citations.
    """
    # Retrieve top 6 chunks for relevance
    chunks_with_scores = retrieve_similar_chunks(query=question, company=company, k=6)
    
    if not chunks_with_scores:
        return {
            "answer": f"I couldn't find any indexed documents for '{company}'. Please upload documents first.",
            "citations": [],
            "chunks": [],
            "evaluation": {
                "groundedness_score": 0,
                "context_relevance": 0,
                "label": "No Data"
            }
        }
        
    context_blocks = []
    citations = []
    
    for idx, (doc, score) in enumerate(chunks_with_scores):
        meta = doc.metadata
        cite_key = f"{meta.get('source', 'unknown')}_p{meta.get('page_number', 1)}"
        citations.append({
            "id": idx + 1,
            "source": meta.get("source", "unknown"),
            "page_number": meta.get("page_number", 1),
            "year": meta.get("year", "N/A"),
            "quarter": meta.get("quarter", "FY"),
            "categories": meta.get("categories", []),
            "snippet": doc.page_content,
            "score": float(score)
        })
        
        context_blocks.append(
            f"--- SOURCE ID {idx + 1} ({meta.get('source', 'unknown')} | Page {meta.get('page_number', 1)} | Year {meta.get('year', 'N/A')}) ---\n"
            f"{doc.page_content}\n"
        )
        
    context_str = "\n".join(context_blocks)
    
    system_prompt = (
        "You are RiskLens AI, an expert corporate risk intelligence agent.\n"
        "Your goal is to answer the user's question about the company's risks using ONLY the provided sources.\n"
        "Follow these rules strictly:\n"
        "1. Answer based solely on the sources provided. Never assume or extrapolate.\n"
        "2. Ground every single claim with an inline citation using the source ID, e.g., '[Source 1]' or '[Source 2, Source 3]'.\n"
        "3. If the answer cannot be found in the provided sources, state clearly: 'Based on the uploaded documents, I cannot find sufficient information to answer this question.'\n"
        "4. Keep your answer professional, concise, and structured (using bullet points where helpful).\n"
        "5. Do NOT hallucinate."
    )
    
    human_prompt = f"Company: {company}\nQuestion: {question}\n\nRetrieved Source Text:\n{context_str}"
    
    try:
        llm = get_llm(temperature=0.1)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])
        
        eval_metrics = evaluate_rag_response(response.content, citations)
        return {
            "answer": response.content,
            "citations": citations,
            "chunks": [c["snippet"] for c in citations], # for highlighting
            "evaluation": eval_metrics
        }
    except Exception as e:
        logger.error(f"Error generating LLM response: {str(e)}")
        return {
            "answer": f"Error generating answer: {str(e)}",
            "citations": citations,
            "chunks": [],
            "evaluation": {
                "groundedness_score": 0,
                "context_relevance": 0,
                "label": "Error"
            }
        }

# 2. TEMPORAL RISK ANALYSIS
def analyze_temporal_risks(company: str) -> List[Dict[str, Any]]:
    """
    Identifies the primary risk trends for a company across different years and builds a timeline.
    """
    # Check cache first
    cache = load_timeline_cache()
    if company in cache:
        logger.info(f"Returning cached timeline for company: {company}")
        return cache[company]

    # Retrieve chunks related to risk and challenges overall
    chunks_with_scores = retrieve_similar_chunks(
        query="major risks challenges uncertainties headwinds concerns", 
        company=company, 
        k=25
    )
    
    if not chunks_with_scores:
        return []
        
    # Group by year
    years_data: Dict[int, List[Document]] = {}
    for doc, _ in chunks_with_scores:
        yr = doc.metadata.get("year")
        if yr:
            try:
                yr_val = int(yr)
                if yr_val not in years_data:
                    years_data[yr_val] = []
                years_data[yr_val].append(doc)
            except ValueError:
                continue
                
    timeline = []
    try:
        llm = get_llm(temperature=0.1)
    except Exception as e:
        logger.error(f"Error initializing LLM for temporal risks: {e}")
        return []
    
    # Process each year
    for year in sorted(years_data.keys()):
        docs = years_data[year][:4] # Top 4 chunks for that year
        context_str = "\n\n".join([f"Page {d.metadata.get('page_number', 'N/A')}: {d.page_content}" for d in docs])
        
        system_prompt = (
            "You are a financial analyst summarizing corporate risk filings for a specific year.\n"
            "Analyze the provided text from SEC documents and extract the single most significant risk theme for that year.\n"
            "Format your output strictly as a JSON object matching this schema:\n"
            "{\n"
            "  \"risk_title\": \"Brief Risk Theme (2-4 words, e.g. Supply Chain Disruptions)\",\n"
            "  \"summary\": \"A concise 2-sentence summary of why this was the primary risk.\",\n"
            "  \"evidence_quote\": \"A direct, exact sentence or quote from the text supporting this.\",\n"
            "  \"category\": \"One of: Regulatory, Operational, Supply Chain, Financial, Geopolitical, Cybersecurity, Technology, AI, Competition, Market, ESG, Litigation\"\n"
            "}"
        )
        
        human_prompt = f"Company: {company}\nYear: {year}\n\nTexts:\n{context_str}"
        
        try:
            response = llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=human_prompt)
            ])
            parsed = clean_and_parse_json(response.content)
            
            # Find document source page if possible
            best_page = 1
            best_source = "Unknown Document"
            if docs:
                best_page = docs[0].metadata.get("page_number", 1)
                best_source = docs[0].metadata.get("source", "Unknown Document")
                
            timeline.append({
                "year": year,
                "title": parsed.get("risk_title", "General Risk"),
                "summary": parsed.get("summary", "No summary available"),
                "category": parsed.get("category", "Operational"),
                "quote": parsed.get("evidence_quote", ""),
                "source": best_source,
                "page": best_page
            })
        except Exception as e:
            logger.error(f"Error analyzing temporal risks for year {year}: {str(e)}")
            
    # Save to cache if we got some results
    if timeline:
        cache[company] = timeline
        save_timeline_cache(cache)
        
    return timeline

# 3. COMPANY COMPARISON
def compare_companies_risks(company_a: str, company_b: str) -> Dict[str, Any]:
    """
    Compares risks between Company A and Company B.
    """
    # Check cache first
    cache = load_comparison_cache()
    cache_key = f"{min(company_a, company_b)}_vs_{max(company_a, company_b)}"
    if cache_key in cache:
        logger.info(f"Returning cached comparison for key: {cache_key}")
        return cache[cache_key]

    # Query risks for both companies
    chunks_a = retrieve_similar_chunks(query="key business operational regulatory cybersecurity financial risks", company=company_a, k=10)
    chunks_b = retrieve_similar_chunks(query="key business operational regulatory cybersecurity financial risks", company=company_b, k=10)
    
    # If either company is missing data, return a clean error without calling LLM
    if not chunks_a or not chunks_b:
        missing = []
        if not chunks_a: missing.append(company_a)
        if not chunks_b: missing.append(company_b)
        missing_str = " and ".join(missing)
        return {
            "error": f"No indexed data found for {missing_str}. Please ingest documents for both companies before comparing.",
            "shared_risks": [],
            "unique_company_a": [],
            "unique_company_b": [],
            "categories": {"operational": "", "financial": "", "regulatory": "", "supply_chain": ""},
            "summary": f"Comparison is unavailable because {missing_str} has no indexed documents."
        }
        
    context_a = "\n\n".join([d.page_content for d, _ in chunks_a])
    context_b = "\n\n".join([d.page_content for d, _ in chunks_b])
    
    system_prompt = (
        "You are an expert risk auditor comparing two corporate entities.\n"
        "Based on the provided text disclosures, perform a side-by-side risk comparison.\n"
        "Format your output strictly as a JSON object matching this schema:\n"
        "{\n"
        "  \"shared_risks\": [\"Short risk name 1\", \"Short risk name 2\"],\n"
        "  \"unique_company_a\": [\"Short risk unique to Company A\"],\n"
        "  \"unique_company_b\": [\"Short risk unique to Company B\"],\n"
        "  \"categories\": {\n"
        "    \"operational\": \"Brief comparison of operational risks between A and B.\",\n"
        "    \"financial\": \"Brief comparison of financial risks between A and B.\",\n"
        "    \"regulatory\": \"Brief comparison of regulatory risks between A and B.\",\n"
        "    \"supply_chain\": \"Brief comparison of supply chain risks between A and B.\"\n"
        "  },\n"
        "  \"summary\": \"A concise 3-sentence summary highlighting the main contrast in their risk profiles.\"\n"
        "}"
    )
    
    human_prompt = (
        f"Company A: {company_a}\n"
        f"Company A Disclosures:\n{context_a}\n\n"
        f"Company B: {company_b}\n"
        f"Company B Disclosures:\n{context_b}"
    )
    
    try:
        llm = get_llm(temperature=0.1)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])
        result = clean_and_parse_json(response.content)
        
        # Save to cache if valid
        if "summary" in result and ("shared_risks" in result or "categories" in result):
            cache[cache_key] = result
            save_comparison_cache(cache)
            
        return result
    except Exception as e:
        logger.error(f"Error comparing companies: {str(e)}")
        return {
            "error": f"Failed comparison: {str(e)}",
            "shared_risks": [],
            "unique_company_a": [],
            "unique_company_b": [],
            "categories": {"operational": "", "financial": "", "regulatory": "", "supply_chain": ""},
            "summary": "An error occurred during comparison."
        }

# 4. DASHBOARD SCORE CALCULATION
def calculate_risk_dashboard(company: str) -> Dict[str, Any]:
    """
    Generates explainable severity risk scores (1-100) for key risk categories.
    """
    # Try loading from cache first
    cache = load_dashboard_cache()
    if company in cache:
        logger.info(f"Returning cached dashboard metrics for company: {company}")
        return cache[company]
        
    # Retrieve top 15 chunks overall to evaluate the company's risks
    chunks_with_scores = retrieve_similar_chunks(
        query="risk disclosures, threat, litigation, cyber, supply chain disruption, financial loss, competition, regulatory fine",
        company=company,
        k=15
    )
    
    if not chunks_with_scores:
        return {
            "overall": {"score": 0, "explanation": "No data indexed for this company."}
        }
        
    context_str = "\n\n".join([f"- {d.page_content[:400]}..." for d, _ in chunks_with_scores])
    
    system_prompt = (
        "You are a financial credit and risk rating agency.\n"
        "Analyze the provided risk disclosures for the company and assign risk severity scores (1 to 100, where 100 is extremely severe risk) for each of these categories:\n"
        "- Overall Risk Score\n"
        "- Supply Chain Risk\n"
        "- Regulatory Risk\n"
        "- Financial Risk\n"
        "- Competition Risk\n"
        "- Geopolitical Risk\n"
        "- Cybersecurity Risk\n\n"
        "Be realistic. For example, if they disclose severe GPU shortages, supply chain risk should be high (e.g. 75-85).\n"
        "If there are no mentions of a category (e.g., Cybersecurity), assign a low score (e.g. 10-20) and write 'No critical risks disclosed'.\n"
        "Format your output strictly as a JSON object matching this schema:\n"
        "{\n"
        "  \"overall\": {\"score\": 65, \"explanation\": \"Overall summary explanation...\"},\n"
        "  \"supply_chain\": {\"score\": 80, \"explanation\": \"Explanation of supply chain findings...\"},\n"
        "  \"regulatory\": {\"score\": 50, \"explanation\": \"Explanation of regulatory findings...\"},\n"
        "  \"financial\": {\"score\": 40, \"explanation\": \"Explanation of financial findings...\"},\n"
        "  \"competition\": {\"score\": 75, \"explanation\": \"Explanation of competition findings...\"},\n"
        "  \"geopolitical\": {\"score\": 30, \"explanation\": \"Explanation of geopolitical findings...\"},\n"
        "  \"cybersecurity\": {\"score\": 25, \"explanation\": \"Explanation of cyber findings...\"}\n"
        "}"
    )
    
    human_prompt = f"Company: {company}\n\nDisclosures:\n{context_str}"
    
    try:
        llm = get_llm(temperature=0.0) # lower temperature for maximum score consistency
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])
        result = clean_and_parse_json(response.content)
        
        # Save to cache if valid
        if "overall" in result and result["overall"].get("score", 0) > 0:
            cache[company] = result
            save_dashboard_cache(cache)
            
        return result
    except Exception as e:

        logger.error(f"Error calculating dashboard: {str(e)}")
        # Return fallback values
        err_msg = f"Error calculating scores: {str(e)}"
        return {
            "overall": {"score": 0, "explanation": err_msg},
            "supply_chain": {"score": 0, "explanation": err_msg},
            "regulatory": {"score": 0, "explanation": err_msg},
            "financial": {"score": 0, "explanation": err_msg},
            "competition": {"score": 0, "explanation": err_msg},
            "geopolitical": {"score": 0, "explanation": err_msg},
            "cybersecurity": {"score": 0, "explanation": err_msg}
        }

# 5. KNOWLEDGE GRAPH GENERATION
def generate_knowledge_graph_data(company: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts nodes and links for a 2D interactive force-directed graph.
    If company is provided, filters for that company. Otherwise extracts globally.
    """
    client = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    
    # Retrieve recent points from Qdrant
    if not client.collection_exists(collection_name):
        return {"nodes": [], "links": []}
        
    try:
        if company:
            # Filter by company
            scroll_result = client.scroll(
                collection_name=collection_name,
                scroll_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="metadata.company",
                            match=qmodels.MatchValue(value=company)
                        )
                    ]
                ),
                limit=40,
                with_payload=True,
                with_vectors=False
            )
        else:
            # Fetch globally
            scroll_result = client.scroll(
                collection_name=collection_name,
                limit=50,
                with_payload=True,
                with_vectors=False
            )
            
        points = scroll_result[0]
    except Exception as e:
        logger.error(f"Error fetching points from Qdrant scroll: {str(e)}")
        return {"nodes": [], "links": []}
        
    nodes = []
    links = []
    
    # Use sets to ensure uniqueness of node IDs
    seen_nodes = set()
    
    # Always add basic category groups as central nodes
    all_categories = [
        "Regulatory", "Operational", "Supply Chain", "Financial", "Geopolitical", 
        "Cybersecurity", "Technology", "AI", "Competition", "Market", "ESG", "Litigation"
    ]
    
    active_companies = set()
    active_categories = set()
    
    # Pre-calculate counts of risks for formatting labels
    company_counts = {}
    category_counts = {}
    
    for pt in points:
        payload = pt.payload
        if not payload or "metadata" not in payload:
            continue
        meta = payload["metadata"]
        comp = meta.get("company")
        if not comp:
            continue
            
        company_counts[comp] = company_counts.get(comp, 0) + 1
        
        cats = meta.get("categories", ["Operational"])
        if isinstance(cats, str):
            cats = [cats]
        for cat in cats:
            if cat in all_categories:
                category_counts[cat] = category_counts.get(cat, 0) + 1

    # Compile nodes and links
    for pt in points:
        payload = pt.payload
        if not payload or "metadata" not in payload:
            continue
        meta = payload["metadata"]
        comp = meta.get("company")
        if not comp:
            continue
            
        # Register company node
        if comp not in seen_nodes:
            seen_nodes.add(comp)
            count = company_counts.get(comp, 0)
            nodes.append({
                "id": comp,
                "label": f"{comp} ({count} risks)" if count > 0 else comp,
                "group": "company",
                "val": 25,
                "description": f"Indexed parent node for {comp}."
            })
        active_companies.add(comp)
        
        # Extract text snippets to make Risk Nodes
        snippet = payload.get("page_content", "")
        first_sentence = snippet.split(".")[0].strip()
        risk_label = first_sentence[:45] + "..." if len(first_sentence) > 45 else first_sentence
        
        # Unique node ID
        risk_node_id = f"R_{pt.id}"
        
        # Extract categories
        cats = meta.get("categories", ["Operational"])
        if isinstance(cats, str):
            cats = [cats]
            
        # Register risk node
        if risk_node_id not in seen_nodes:
            seen_nodes.add(risk_node_id)
            nodes.append({
                "id": risk_node_id,
                "label": risk_label,
                "group": "risk",
                "val": 10,
                "description": snippet,
                "company": comp,
                "categories": cats,
                "source": meta.get("source", "unknown"),
                "page": meta.get("page_number", 1),
                "year": meta.get("year", "N/A")
            })
            
            # Connect company directly to risk
            links.append({"source": comp, "target": risk_node_id})
            
            # Connect risk to its categories
            for cat in cats:
                if cat in all_categories:
                    active_categories.add(cat)
                    links.append({"source": risk_node_id, "target": cat})

    # Add active categories as nodes (WITHOUT direct company-to-category connections)
    for cat in active_categories:
        if cat not in seen_nodes:
            seen_nodes.add(cat)
            count = category_counts.get(cat, 0)
            nodes.append({
                "id": cat,
                "label": f"{cat} ({count} risks)" if count > 0 else cat,
                "group": "category",
                "val": 18,
                "description": f"Risk Category: {cat}"
            })
            
    # De-duplicate links
    unique_links = []
    seen_links = set()
    for l in links:
        link_key = f"{l['source']}->{l['target']}"
        if link_key not in seen_links:
            seen_links.add(link_key)
            unique_links.append(l)
            
    return {"nodes": nodes, "links": unique_links}

# 6. EXPLAIN RISK
def get_risk_explanation(risk_title: str, context: str) -> Dict[str, Any]:
    """
    Generates a deep explanation of a selected risk including impact, probability, and historical context.
    """
    system_prompt = (
        "You are RiskLens AI, an expert corporate risk assessment consultant.\n"
        "Analyze the provided risk and text context, then generate a comprehensive assessment.\n"
        "Format your output strictly as a JSON object matching this schema:\n"
        "{\n"
        "  \"importance\": \"Detailed paragraph explaining why this risk matters for the business.\",\n"
        "  \"impact\": \"Specific operational or financial damages this risk could inflict.\",\n"
        "  \"probability\": \"High / Medium / Low with 1 sentence justifying this likelihood.\",\n"
        "  \"trend\": \"Historical or future trajectory of this risk (e.g. rising due to tariffs, stable).\",\n"
        "  \"evidence\": \"A key direct quote from the context that anchors this risk.\"\n"
        "}"
    )
    
    human_prompt = f"Risk Title: {risk_title}\n\nContext Paragraph:\n{context}"
    
    try:
        llm = get_llm(temperature=0.2)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_prompt)
        ])
        return clean_and_parse_json(response.content)
    except Exception as e:
        logger.error(f"Error explaining risk: {str(e)}")
        return {
            "importance": "Failed to generate assessment.",
            "impact": str(e),
            "probability": "N/A",
            "trend": "N/A",
            "evidence": "N/A"
        }

def get_yearly_category_scores(company: str) -> List[Dict[str, Any]]:
    """
    Computes deterministic category risk severity scores (10-100) year-over-year
    for the temporal line chart, based on metadata tags and keyword densities.
    """
    client = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    if not client.collection_exists(collection_name):
        return []
        
    try:
        # Retrieve all company chunks
        scroll_res = client.scroll(
            collection_name=collection_name,
            scroll_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="metadata.company",
                        match=qmodels.MatchValue(value=company)
                    )
                ]
            ),
            limit=2000,
            with_payload=True,
            with_vectors=False
        )
        points = scroll_res[0]
        if not points:
            return []
            
        # Group points by year
        by_year = {}
        for pt in points:
            meta = pt.payload.get("metadata", {})
            yr = meta.get("year")
            if yr:
                try:
                    yr = int(yr)
                    if yr not in by_year:
                        by_year[yr] = []
                    by_year[yr].append(pt.payload)
                except ValueError:
                    continue
                    
        # Category list mapping
        from app.ingestion.chunker import CATEGORY_KEYWORDS
        
        categories_map = {
            "supply_chain": "Supply Chain",
            "regulatory": "Regulatory",
            "financial": "Financial",
            "competition": "Competition",
            "geopolitical": "Geopolitical",
            "cybersecurity": "Cybersecurity"
        }
        
        result = []
        for year in sorted(by_year.keys()):
            payloads = by_year[year]
            total_chunks = len(payloads)
            
            yearly_scores = {}
            for key, cat_name in categories_map.items():
                cat_count = 0
                kw_matches = 0
                
                # Count matching chunks and keywords
                for p in payloads:
                    meta_cats = p.get("metadata", {}).get("categories", [])
                    if cat_name in meta_cats:
                        cat_count += 1
                        
                    # Count keyword occurrences
                    chunk_text = p.get("page_content", "").lower()
                    for kw in CATEGORY_KEYWORDS.get(cat_name, []):
                        kw_matches += chunk_text.count(kw.lower())
                        
                # Compute score: base value + chunk ratio + keyword matches
                ratio = cat_count / max(1, total_chunks)
                raw_score = 15 + int(ratio * 60) + min(25, kw_matches * 3)
                yearly_scores[key] = max(10, min(100, raw_score))
                
            result.append({
                "year": year,
                "scores": yearly_scores
            })
            
        return result
    except Exception as e:
        logger.error(f"Error computing yearly category scores: {e}")
        return []

