from app.config import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

def get_llm(temperature: float = 0.2, streaming: bool = False):
    """
    Returns an instance of ChatGoogleGenerativeAI, ChatOpenAI, or ChatOpenAI (Groq) based on settings.
    If GROQ_API_KEY is available, configures it as a fallback model to handle API rate limits.
    """
    primary_llm = None
    
    if settings.LLM_PROVIDER == "google":
        if not settings.GEMINI_API_KEY:
            raise ValueError(
                "GEMINI_API_KEY environment variable or config value is missing. "
                "Please add GEMINI_API_KEY to your .env file."
            )
        primary_llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=settings.GEMINI_API_KEY,
            temperature=temperature,
            streaming=streaming,
            max_retries=1
        )
    elif settings.LLM_PROVIDER == "openai":
        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY environment variable or config value is missing. "
                "Please add OPENAI_API_KEY to your .env file."
            )
        primary_llm = ChatOpenAI(
            model="gpt-4o-mini",
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=temperature,
            streaming=streaming
        )
    elif settings.LLM_PROVIDER == "groq":
        if not settings.GROQ_API_KEY:
            raise ValueError(
                "GROQ_API_KEY environment variable or config value is missing. "
                "Please add GROQ_API_KEY to your .env file."
            )
        primary_llm = ChatOpenAI(
            model="llama-3.3-70b-versatile",
            openai_api_key=settings.GROQ_API_KEY,
            openai_api_base="https://api.groq.com/openai/v1",
            temperature=temperature,
            streaming=streaming
        )
    else:
        raise ValueError(f"Unsupported LLM provider: {settings.LLM_PROVIDER}")

    # Set up automatic Groq fallback if GROQ_API_KEY is defined and primary is not already Groq
    if settings.GROQ_API_KEY and settings.LLM_PROVIDER != "groq":
        fallback_llm = ChatOpenAI(
            model="llama-3.3-70b-versatile",
            openai_api_key=settings.GROQ_API_KEY,
            openai_api_base="https://api.groq.com/openai/v1",
            temperature=temperature,
            streaming=streaming
        )
        return primary_llm.with_fallbacks([fallback_llm])

    return primary_llm
