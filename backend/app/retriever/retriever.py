import logging
from typing import List, Dict, Any, Optional, Tuple
from qdrant_client.http import models as qmodels
from langchain_core.documents import Document
from app.vector_store.qdrant_store import get_vector_store

logger = logging.getLogger(__name__)

def retrieve_similar_chunks(
    query: str,
    company: Optional[str] = None,
    year: Optional[int] = None,
    quarter: Optional[str] = None,
    document_type: Optional[str] = None,
    category: Optional[str] = None,
    k: int = 5
) -> List[Tuple[Document, float]]:
    """
    Performs a semantic search on the Qdrant vector store with metadata filtering.
    Returns a list of tuples containing (Document, similarity_score).
    """
    logger.info(
        f"Retrieving chunks for query='{query}' filters: company={company}, "
        f"year={year}, quarter={quarter}, doc_type={document_type}, category={category}"
    )
    
    vector_store = get_vector_store()
    conditions = []
    
    if company:
        conditions.append(
            qmodels.FieldCondition(
                key="metadata.company",
                match=qmodels.MatchValue(value=company)
            )
        )
        
    if year is not None:
        conditions.append(
            qmodels.FieldCondition(
                key="metadata.year",
                match=qmodels.MatchValue(value=int(year))
            )
        )
        
    if quarter:
        conditions.append(
            qmodels.FieldCondition(
                key="metadata.quarter",
                match=qmodels.MatchValue(value=quarter)
            )
        )
        
    if document_type:
        conditions.append(
            qmodels.FieldCondition(
                key="metadata.document_type",
                match=qmodels.MatchValue(value=document_type)
            )
        )
        
    if category:
        # Matches value in array of categories
        conditions.append(
            qmodels.FieldCondition(
                key="metadata.categories",
                match=qmodels.MatchValue(value=category)
            )
        )
        
    qdrant_filter = None
    if conditions:
        qdrant_filter = qmodels.Filter(must=conditions)
        
    try:
        # returns List[Tuple[Document, float]]
        results = vector_store.similarity_search_with_score(
            query=query,
            k=k,
            filter=qdrant_filter
        )
        logger.info(f"Retrieved {len(results)} chunks successfully.")
        return results
    except Exception as e:
        logger.error(f"Error during semantic retrieval: {str(e)}")
        # If collection is empty, return empty list instead of crashing
        return []
