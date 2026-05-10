import datetime
import logging
import re
from typing import List, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

CATEGORY_KEYWORDS = {
    "Regulatory": ["regulation", "regulatory", "compliance", "sec", "tariff", "government", "policy", "statute", "rule", "act", "trade barrier"],
    "Operational": ["operation", "manufacturing", "production", "facility", "capacity", "disruption", "interruption", "efficiency", "personnel", "workforce"],
    "Supply Chain": ["supply chain", "supplier", "vendor", "raw material", "shortage", "logistics", "shipping", "inventory", "freight", "procurement"],
    "Financial": ["financial", "revenue", "cash flow", "debt", "interest rate", "inflation", "currency", "forex", "liquidity", "credit", "capital", "funding"],
    "Geopolitical": ["geopolitical", "tariff", "china", "trade war", "sanction", "export control", "treaty", "global tension", "foreign policy", "cross-border"],
    "Cybersecurity": ["cyber", "security breach", "hacker", "malware", "ransomware", "phishing", "data leak", "data theft", "intrusion", "vulnerability"],
    "Technology": ["technology", "software", "hardware", "it system", "infrastructure", "digital", "legacy", "cloud", "network", "server"],
    "AI": ["artificial intelligence", "ai", "machine learning", "deep learning", "large language model", "llm", "neural network", "gpu", "compute"],
    "Competition": ["competition", "competitor", "rival", "market share", "price pressure", "market consolidation", "incumbent", "new entrant"],
    "Market": ["market demand", "consumer taste", "macroeconomic", "recession", "economic downturn", "commodity price", "industry trend"],
    "ESG": ["esg", "environmental", "social", "governance", "climate change", "carbon footprint", "sustainability", "diversity", "green energy", "human rights"],
    "Litigation": ["litigation", "lawsuit", "sue", "suing", "court", "patent infringement", "dispute", "legal action", "class action", "judicial"]
}

# General keywords that indicate a paragraph discusses business risk
GENERAL_RISK_KEYWORDS = [
    "risk", "threat", "uncertain", "adversely", "headwind", "litigation", "lawsuit", 
    "penalty", "disruption", "shortage", "challenge", "liability", "damages", "material impact"
]

def tag_categories(text: str) -> List[str]:
    """
    Classifies a text block into relevant risk categories based on keyword mapping.
    Returns an empty list if no category keywords match.
    """
    text_lower = text.lower()
    categories = []
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if len(kw) <= 3:
                pattern = r'\b' + re.escape(kw) + r'\b'
                if re.search(pattern, text_lower):
                    categories.append(category)
                    break
            else:
                if kw in text_lower:
                    categories.append(category)
                    break
                    
    return categories

def chunk_documents(
    documents: List[Document],
    company: str,
    year: int,
    quarter: Optional[str] = "FY",
    document_type: Optional[str] = "Annual Report",
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> List[Document]:
    """
    Splits documents into overlapping chunks, filters out non-risk paragraphs, 
    and enriches the retained risk chunks with metadata and category tags.
    """
    logger.info(
        f"Segmenting {len(documents)} document pages for {company} ({year} {quarter}) "
        f"with size={chunk_size}, overlap={chunk_overlap}"
    )
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    raw_chunks = splitter.split_documents(documents)
    timestamp = datetime.datetime.now().isoformat()
    
    filtered_chunks = []
    skipped_count = 0
    
    for chunk in raw_chunks:
        content_lower = chunk.page_content.lower()
        categories = tag_categories(chunk.page_content)
        
        # Check if it has any general risk words
        has_general_risk = any(kw in content_lower for kw in GENERAL_RISK_KEYWORDS)
        
        # If the chunk does not match any specific category and lacks general risk keywords,
        # it is not a risk disclosure (e.g. balance sheet tables or directory pages). Skip it.
        if not categories and not has_general_risk:
            skipped_count += 1
            continue
            
        # If it has general risk terms but didn't map to a category, default to Operational
        if not categories:
            categories = ["Operational"]
            
        orig_source = chunk.metadata.get("source", "unknown")
        orig_page = chunk.metadata.get("page_number", 1)
        
        # Override metadata with full structured fields
        chunk.metadata = {
            "company": company.strip(),
            "year": int(year),
            "quarter": quarter.strip() if quarter else "FY",
            "document_type": document_type.strip(),
            "source": orig_source,
            "page_number": int(orig_page),
            "timestamp": timestamp,
            "chunk_index": len(filtered_chunks),
            "categories": categories
        }
        filtered_chunks.append(chunk)
        
    logger.info(
        f"Ingestion filter completed: retained {len(filtered_chunks)} risk disclosures, "
        f"discarded {skipped_count} irrelevant chunks (balance sheets, indexes, etc.)."
    )
    return filtered_chunks
