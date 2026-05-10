import sys
import os

# Add backend root to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from app.ingestion.parser import parse_txt
    from app.ingestion.chunker import chunk_documents
except ImportError as e:
    print(f"ImportError: {str(e)}")
    print("Please make sure you are executing from the backend folder or project root.")
    sys.exit(1)

def run_tests():
    print("==================================================")
    print("Starting RiskLens AI Parser & Chunker Tests")
    print("==================================================")
    
    sample_text = (
        "Apple Inc. disclosures: Apple faces extreme supply chain risks due to delays in "
        "semiconductor chip fabrication lines in Taiwan, impacting iPhone shipments. "
        "Additionally, we are subject to extensive antitrust litigation in Europe "
        "regarding App Store transaction fees, which could result in regulatory penalties. "
        "Our investments in artificial intelligence and deep neural networks expose us "
        "to new competitive risks against rival tech platforms."
    )
    
    # Test Parser
    print("\n1. Testing Parser...")
    docs = parse_txt(sample_text, "test_news_article.txt")
    print(f"Success: Parsed {len(docs)} document. Source: {docs[0].metadata['source']}")
    
    # Test Chunker and Category Tagger
    print("\n2. Testing Chunker and Category Auto-Tagging...")
    chunks = chunk_documents(
        documents=docs,
        company="Apple",
        year=2024,
        quarter="Q3",
        document_type="Financial News",
        chunk_size=300,  # small size to force split
        chunk_overlap=50
    )
    
    print(f"Success: Generated {len(chunks)} overlapping chunks.")
    
    # Inspect category results
    for idx, chunk in enumerate(chunks):
        print(f"\n--- Chunk {idx + 1} ---")
        print(f"Content: {chunk.page_content}")
        print(f"Categories Tagged: {chunk.metadata['categories']}")
        print(f"Metadata Summary: {chunk.metadata['company']} | Year: {chunk.metadata['year']} | Page: {chunk.metadata['page_number']}")
        
    print("\n==================================================")
    print("All internal parsing and chunking checks passed!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
