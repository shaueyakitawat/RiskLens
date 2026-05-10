import os
import logging
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from langchain_qdrant import QdrantVectorStore
from app.config import settings
from app.embeddings.embedding_service import get_embeddings

logger = logging.getLogger(__name__)

_client = None

def get_qdrant_client() -> QdrantClient:
    """
    Initializes and returns a singleton QdrantClient instance configured for local persistence or cloud.
    """
    global _client
    if _client is None:
        url = os.environ.get("QDRANT_URL")
        api_key = os.environ.get("QDRANT_API_KEY")
        if url:
            logger.info(f"Initializing Qdrant client with remote cloud cluster at: {url}")
            _client = QdrantClient(url=url, api_key=api_key or None)
        else:
            path = settings.QDRANT_STORAGE_PATH
            if path and path != ":memory:":
                # Ensure the directory exists
                os.makedirs(path, exist_ok=True)
                logger.info(f"Initializing Qdrant client with local disk storage at: {path}")
                _client = QdrantClient(path=path)
            else:
                logger.info("Initializing Qdrant client in ephemeral ':memory:' mode.")
                _client = QdrantClient(location=":memory:")
    return _client

def get_vector_store() -> QdrantVectorStore:
    """
    Returns the LangChain QdrantVectorStore wrapper.
    Ensures that the target collection exists and matches the active embedding dimension.
    """
    client = get_qdrant_client()
    embeddings = get_embeddings()
    collection_name = settings.QDRANT_COLLECTION_NAME

    # Determine vector dimension
    vector_size = 3072  # default for google gemini-embedding-001
    if settings.EMBEDDING_PROVIDER == "openai":
        vector_size = 1536
    elif settings.EMBEDDING_PROVIDER == "local":
        vector_size = 384

    # Check if collection exists and has matching vector dimension
    if client.collection_exists(collection_name):
        try:
            info = client.get_collection(collection_name)
            # Support both Single and Named vector configuration
            vectors_config = info.config.params.vectors
            existing_size = (
                vectors_config.size 
                if hasattr(vectors_config, 'size') 
                else getattr(next(iter(vectors_config.values())), 'size', 3072)
            )
            
            if existing_size != vector_size:
                logger.warning(
                    f"Qdrant collection '{collection_name}' dimension mismatch. "
                    f"Existing: {existing_size}, Expected: {vector_size}. Recreating collection..."
                )
                client.delete_collection(collection_name)
        except Exception as err:
            logger.error(f"Error checking existing Qdrant collection size: {str(err)}")

    # Create collection if it doesn't exist (or was deleted due to size mismatch)
    if not client.collection_exists(collection_name):
        logger.info(f"Creating a new Qdrant collection '{collection_name}' with size {vector_size}...")
        client.create_collection(
            collection_name=collection_name,
            vectors_config=qmodels.VectorParams(
                size=vector_size,
                distance=qmodels.Distance.COSINE
            )
        )
        
    # Ensure payload indexes exist (safely catch if already created)
    try:
        client.create_payload_index(
            collection_name=collection_name,
            field_name="metadata.company",
            field_schema=qmodels.PayloadSchemaType.KEYWORD
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="metadata.year",
            field_schema=qmodels.PayloadSchemaType.INTEGER
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="metadata.quarter",
            field_schema=qmodels.PayloadSchemaType.KEYWORD
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="metadata.document_type",
            field_schema=qmodels.PayloadSchemaType.KEYWORD
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="metadata.categories",
            field_schema=qmodels.PayloadSchemaType.KEYWORD
        )
        logger.info("Successfully ensured Qdrant payload indexes exist.")
    except Exception as idx_err:
        logger.warning(f"Note on payload indexes creation: {str(idx_err)}")
    
    return QdrantVectorStore(
        client=client,
        collection_name=collection_name,
        embedding=embeddings
    )

def clear_vector_store():
    """
    Recreates (clears) the collection in the vector database.
    """
    global _client
    url = os.environ.get("QDRANT_URL")
    collection_name = settings.QDRANT_COLLECTION_NAME
    
    if url:
        client = get_qdrant_client()
        try:
            if client.collection_exists(collection_name):
                client.delete_collection(collection_name)
                logger.info(f"Successfully deleted Qdrant cloud collection: {collection_name}")
        except Exception as e:
            logger.warning(f"Failed to delete Qdrant cloud collection: {str(e)}")
    else:
        if _client is not None:
            try:
                # Close client to release RocksDB lock
                _client.close()
            except Exception as e:
                logger.warning(f"Error closing Qdrant client: {str(e)}")
            _client = None

        # Delete storage folder
        path = settings.QDRANT_STORAGE_PATH
        if path and path != ":memory:":
            import shutil
            import time
            for attempt in range(5):
                try:
                    if os.path.exists(path):
                        shutil.rmtree(path)
                    logger.info(f"Successfully deleted Qdrant storage directory: {path}")
                    break
                except Exception as e:
                    logger.warning(f"Failed to delete Qdrant storage directory on attempt {attempt+1}: {str(e)}")
                    time.sleep(0.5)

    # Reinitialize it
    get_vector_store()
