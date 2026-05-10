import time
import logging
from typing import List
from langchain_core.embeddings import Embeddings
from app.config import settings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import FastEmbedEmbeddings

logger = logging.getLogger(__name__)

class RateLimitedEmbeddings(Embeddings):
    """
    Wrapper around langchain Embeddings to handle rate-limiting (429 errors)
    by splitting embedding calls into smaller batches, adding pauses between them,
    and implementing automatic retry with exponential backoff.
    """
    def __init__(self, inner_embeddings: Embeddings, requests_per_minute: int = 80, batch_size: int = 5):
        self.inner_embeddings = inner_embeddings
        self.requests_per_minute = requests_per_minute
        self.batch_size = batch_size

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        results = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i+self.batch_size]
            max_retries = 5
            backoff = 10.0
            batch_embeddings = None
            
            for attempt in range(max_retries):
                try:
                    logger.info(f"Embedding batch of {len(batch)} texts (index {i} to {i+len(batch)}) - attempt {attempt+1}/{max_retries}...")
                    batch_embeddings = self.inner_embeddings.embed_documents(batch)
                    break
                except Exception as e:
                    err_msg = str(e)
                    is_rate_limit = "429" in err_msg or "resource_exhausted" in err_msg.lower() or "quota" in err_msg.lower()
                    if is_rate_limit and attempt < max_retries - 1:
                        logger.warning(
                            f"Rate limit hit during embedding batch. Retrying in {backoff} seconds... "
                            f"Error: {err_msg}"
                        )
                        time.sleep(backoff)
                        backoff *= 2.0
                    else:
                        logger.error(f"Failed to embed documents after {attempt+1} attempts: {err_msg}")
                        raise e
            
            if batch_embeddings is None:
                raise ValueError("Embedding generation failed, returned None.")
            results.extend(batch_embeddings)
            
            if i + self.batch_size < len(texts):
                sleep_time = 2.0
                logger.info(f"Throttling embedding requests. Sleeping for {sleep_time} seconds...")
                time.sleep(sleep_time)
                
        return results

    def embed_query(self, text: str) -> List[float]:
        max_retries = 3
        backoff = 2.0
        for attempt in range(max_retries):
            try:
                return self.inner_embeddings.embed_query(text)
            except Exception as e:
                err_msg = str(e)
                is_rate_limit = "429" in err_msg or "resource_exhausted" in err_msg.lower() or "quota" in err_msg.lower()
                if is_rate_limit and attempt < max_retries - 1:
                    logger.warning(
                        f"Rate limit hit during query embedding. Retrying in {backoff} seconds... "
                        f"Error: {err_msg}"
                    )
                    time.sleep(backoff)
                    backoff *= 2.0
                else:
                    raise e

def get_embeddings():
    """
    Returns a rate-limited instance of GoogleGenerativeAIEmbeddings or OpenAIEmbeddings based on settings.
    """
    if settings.EMBEDDING_PROVIDER == "google":
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY environment variable or config value is missing. "
                "Please add GEMINI_API_KEY to your .env file."
            )
        inner = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=settings.GEMINI_API_KEY
        )
        return RateLimitedEmbeddings(inner, requests_per_minute=80, batch_size=100)
    elif settings.EMBEDDING_PROVIDER == "openai":
        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY environment variable or config value is missing. "
                "Please add OPENAI_API_KEY to your .env file."
            )
        inner = OpenAIEmbeddings(
            model="text-embedding-3-small",
            openai_api_key=settings.OPENAI_API_KEY
        )
        return RateLimitedEmbeddings(inner, requests_per_minute=200, batch_size=100)
    elif settings.EMBEDDING_PROVIDER == "local":
        logger.info("Initializing local FastEmbedEmbeddings (BAAI/bge-small-en-v1.5)...")
        return FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    else:
        raise ValueError(f"Unsupported embedding provider: {settings.EMBEDDING_PROVIDER}")

