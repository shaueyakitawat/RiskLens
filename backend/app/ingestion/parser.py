import io
import re
import logging
from typing import List
from pypdf import PdfReader
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

# Keywords to determine if a page is actually a risk disclosure page
PAGE_RISK_KEYWORDS = ["risk", "threat", "uncertain", "litigation", "lawsuit", "disruption", "shortage", "headwind"]

def clean_text(text: str) -> str:
    """
    Cleans text formatting, removing double whitespaces, page dividers, and strange symbols.
    """
    # Replace multiple whitespaces and newlines with a single space
    text = re.sub(r'\s+', ' ', text)
    # Remove binary characters or non-ascii placeholders
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    return text.strip()

def parse_pdf(file_bytes: bytes, filename: str) -> List[Document]:
    """
    Extracts text page by page from PDF bytes, keeping only pages that explicitly 
    discuss risk disclosures, up to a maximum of 35 pages (to stay under free-tier API quotas).
    """
    logger.info(f"Parsing PDF: {filename} ({len(file_bytes)} bytes)")
    
    # Try pypdf first
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        total_pages = len(reader.pages)
        documents = []
        
        for page_idx in range(total_pages):
            try:
                page = reader.pages[page_idx]
                text = page.extract_text() or ""
                text_cleaned = clean_text(text)
                if not text_cleaned:
                    continue
                    
                text_lower = text_cleaned.lower()
                # Count how many times risk keywords occur on this page
                match_count = sum(text_lower.count(kw) for kw in PAGE_RISK_KEYWORDS)
                
                # If the page does not discuss risks, skip it.
                if match_count < 2:
                    continue
                    
                metadata = {
                    "source": filename,
                    "page_number": page_idx + 1,
                }
                documents.append(Document(page_content=text_cleaned, metadata=metadata))
                
                # Cap the pages at 10 to respect the Google free-tier token/request rate limits.
                if len(documents) >= 10:
                    logger.info(f"Reached safety cap of 10 risk-heavy pages for '{filename}'. Stopping parser.")
                    break
            except Exception as page_err:
                logger.warning(f"Skipping page {page_idx + 1} of '{filename}' due to extraction error: {str(page_err)}")
                continue
                
        logger.info(
            f"Filtered PDF '{filename}': extracted {len(documents)} risk-heavy pages "
            f"out of {total_pages} total pages."
        )
        if documents:
            return documents
        logger.info(f"pypdf found 0 risk-heavy pages. Attempting PyMuPDF fallback for '{filename}'...")
    except Exception as e:
        logger.warning(f"pypdf failed to parse '{filename}' ({str(e)}). Attempting PyMuPDF fallback...")

    # PyMuPDF Fallback
    try:
        import fitz
        doc_fitz = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = len(doc_fitz)
        documents = []
        
        for page_idx in range(total_pages):
            try:
                page = doc_fitz[page_idx]
                text = page.get_text() or ""
                text_cleaned = clean_text(text)
                if not text_cleaned:
                    continue
                    
                text_lower = text_cleaned.lower()
                match_count = sum(text_lower.count(kw) for kw in PAGE_RISK_KEYWORDS)
                if match_count < 2:
                    continue
                    
                metadata = {
                    "source": filename,
                    "page_number": page_idx + 1,
                }
                documents.append(Document(page_content=text_cleaned, metadata=metadata))
                
                if len(documents) >= 10:
                    logger.info(f"Reached safety cap of 10 risk-heavy pages with PyMuPDF fallback for '{filename}'. Stopping parser.")
                    break
            except Exception as page_err:
                logger.warning(f"PyMuPDF fallback: skipping page {page_idx + 1} of '{filename}' due to extraction error: {str(page_err)}")
                continue
                
        logger.info(
            f"PyMuPDF Fallback Filtered PDF '{filename}': extracted {len(documents)} risk-heavy pages "
            f"out of {total_pages} total pages."
        )
        return documents
    except Exception as e:
        logger.error(f"Error during PyMuPDF fallback for '{filename}': {str(e)}")
        raise e

def parse_txt(text_content: str, filename: str) -> List[Document]:
    """
    Cleans and wraps text content (from news articles or earnings calls) into a single Document.
    """
    logger.info(f"Parsing TXT file: {filename}")
    cleaned = clean_text(text_content)
    metadata = {
        "source": filename,
        "page_number": 1,
    }
    return [Document(page_content=cleaned, metadata=metadata)]
