import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from .env file if it exists, overriding existing env variables
load_dotenv(override=True)

class Settings(BaseSettings):
    LLM_PROVIDER: str = "google"  # 'google' or 'openai'
    EMBEDDING_PROVIDER: str = "google"  # 'google' or 'openai'
    
    # API Keys
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    
    # Vector Database
    QDRANT_STORAGE_PATH: str = "./data/qdrant"
    QDRANT_COLLECTION_NAME: str = "risklens_documents"
    
    # Server configuration
    PORT: int = 8000
    HOST: str = "127.0.0.1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()

# Validate that at least one API key is present for the chosen provider
if settings.LLM_PROVIDER == "google" and not settings.GEMINI_API_KEY:
    # Try reading from default environment variables
    settings.GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

if settings.LLM_PROVIDER == "openai" and not settings.OPENAI_API_KEY:
    settings.OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

if not settings.GROQ_API_KEY:
    settings.GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
