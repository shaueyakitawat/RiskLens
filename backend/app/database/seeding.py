import logging
from typing import List
from langchain_core.documents import Document
from app.ingestion.chunker import chunk_documents
from app.vector_store.qdrant_store import get_vector_store, get_qdrant_client
from app.config import settings

logger = logging.getLogger(__name__)

SEED_DOCUMENTS = [
    # APPLE 2023
    {
        "company": "Apple",
        "year": 2023,
        "quarter": "FY",
        "doc_type": "Annual Report",
        "source": "Apple_10K_2023.pdf",
        "text": (
            "We are highly dependent on global manufacturing operations, logistics, and assembly services, particularly concentrated in China. "
            "Our primary manufacturing partner, Hon Hai Precision Industry Co., Ltd. (Foxconn), operates major assembly plants in Zhengzhou and "
            "other parts of China where geopolitical issues, labor disruptions, or government restrictions can severely affect production capacity. "
            "Any supply chain blockages, customs clearance delays, or trade tariffs between the United States and China would directly impact our "
            "ability to meet customer demand for iPhone, iPad, and Mac devices. Concurrently, our digital services, including App Store commissions "
            "and Apple Pay payment processing fees, are subject to deep regulatory investigations by the European Commission, threatening to impose "
            "antitrust penalties and require structural changes to our iOS app ecosystem and payment systems."
        )
    },
    # APPLE 2024
    {
        "company": "Apple",
        "year": 2024,
        "quarter": "FY",
        "doc_type": "Annual Report",
        "source": "Apple_10K_2024.pdf",
        "text": (
            "We face severe intellectual property and patent litigation challenges in several jurisdictions. For example, a patent dispute with "
            "Masimo Corporation regarding pulse oximetry technology led to a temporary import ban on certain Apple Watch models (Series 9 and Ultra 2) "
            "in the United States, forcing us to disable key health monitoring features for US customers. Additionally, we face regulatory pressure "
            "under the European Union’s Digital Markets Act (DMA), which requires us to allow third-party app stores and alternative browser engines "
            "on iOS, altering our monetization of developer services. Furthermore, our strategic shift towards generative artificial intelligence "
            "under Apple Intelligence requires significant capital expenditures to acquire server infrastructure, lease private cloud capacity, and "
            "fabricate custom Apple Silicon hardware processors, exposing us to intense competition from other technology platforms."
        )
    },
    # NVIDIA 2024
    {
        "company": "Nvidia",
        "year": 2024,
        "quarter": "FY",
        "doc_type": "Annual Report",
        "source": "Nvidia_10K_2024.pdf",
        "text": (
            "Our business model relies on third-party semiconductor foundries to manufacture our integrated circuits, and we are heavily dependent "
            "on Taiwan Semiconductor Manufacturing Company (TSMC) for advanced node wafer fabrication and packaging. Any supply disruptions, natural "
            "disasters, or geopolitical tensions in the Taiwan Strait could severely impair our ability to supply our Hopper (H100) and Ampere graphics "
            "processing units. Additionally, the United States Department of Commerce has expanded export control licensing requirements on advanced "
            "computing chips, preventing us from exporting our high-performance AI processors to customers in China (including Hong Kong and Macau) "
            "and other restricted countries. While we have designed lower-performance alternative chips (like H20/L20), these restrictions limit our "
            "long-term growth and market share in Asia."
        )
    },
    # NVIDIA 2025
    {
        "company": "Nvidia",
        "year": 2025,
        "quarter": "FY",
        "doc_type": "Annual Report",
        "source": "Nvidia_10K_2025.pdf",
        "text": (
            "We face increasing competition as cloud service providers and hyperscalers (including Microsoft, Alphabet, Amazon, and Meta Platforms) "
            "invest in custom application-specific integrated circuits (ASICs) to run AI workloads locally and reduce reliance on our GPUs. Furthermore, "
            "supply chain constraints for advanced packaging technologies, such as Chip-on-Wafer-on-Substrate (CoWoS), and high-bandwidth memory (HBM3e) "
            "modules limit our Blackwell architecture GPU shipments. Any delays in our manufacturing partners scaling up production or yields of Blackwell "
            "processors would allow competitors like Advanced Micro Devices (AMD) to capture market share with their Instinct MI300 accelerators, "
            "leading to pricing pressure and inventory write-downs."
        )
    },
    # MICROSOFT 2024
    {
        "company": "Microsoft",
        "year": 2024,
        "quarter": "FY",
        "doc_type": "Annual Report",
        "source": "Microsoft_10K_2024.pdf",
        "text": (
            "We are subject to sophisticated cybersecurity threats and cyberattacks. A security incident in late 2023 by a nation-state threat actor "
            "(Midnight Blizzard) compromised internal corporate email accounts of our senior leadership and extracted source code snippets, prompting "
            "severe scrutiny from the US Cyber Safety Review Board. Security vulnerabilities in our software products (such as Windows, Exchange, "
            "and Active Directory) could harm our reputation and expose us to class-action litigation or regulatory enforcement. Operationally, our "
            "Azure cloud services depend on massive capital investments to procure land, build data centers, and secure high-performance computing hardware "
            "(GPUs) to support AI workloads. If we cannot secure adequate power grids or hardware capacity to meet customer demand for Copilot, our growth could slow."
        )
    },
    # MICROSOFT 2025
    {
        "company": "Microsoft",
        "year": 2025,
        "quarter": "FY",
        "doc_type": "Annual Report",
        "source": "Microsoft_10K_2025.pdf",
        "text": (
            "We are subject to ongoing antitrust investigations and regulatory challenges, particularly regarding the bundling of Teams with our Office 365 "
            "suites in the European Union. These regulatory headwinds have forced us to unbundle Teams globally, which could affect our market position "
            "against competitors like Slack and Zoom. Additionally, new international regulations on artificial intelligence, including the European "
            "Union's AI Act, impose stringent transparency and safety testing requirements on our foundational models and Azure OpenAI services, "
            "increasing our legal compliance costs and slowing deployment. Finally, copyright litigation brought by publishers, authors, and news outlets "
            "regarding the use of training data for our large language models could lead to substantial licensing liabilities or alterations to our training pipelines."
        )
    }
]


def seed_database_if_empty():
    """
    Checks if the Qdrant collection is empty, and automatically populates it with
    initial realistic filings for Apple, Nvidia, and Microsoft if it is.
    """
    # Force initialize vector store to trigger dimension checking and collection alignment
    get_vector_store()
    
    client = get_qdrant_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
        
    try:
        # Check if collection has points
        collection_info = client.get_collection(collection_name)
        if collection_info.points_count > 0:
            logger.info(f"Collection '{collection_name}' already contains {collection_info.points_count} points. Skipping seed.")
            return
            
        logger.info("Vector database is empty. Seeding initial corporate risk data...")
        
        seeded_docs = []
        for seed in SEED_DOCUMENTS:
            # Wrap as a langchain document
            doc = Document(
                page_content=seed["text"],
                metadata={"source": seed["source"], "page_number": 1}
            )
            
            # Chunk and tag categories
            chunks = chunk_documents(
                documents=[doc],
                company=seed["company"],
                year=seed["year"],
                quarter=seed["quarter"],
                document_type=seed["doc_type"],
                chunk_size=1000,
                chunk_overlap=100
            )
            seeded_docs.extend(chunks)
            
        # Add to vector store
        vector_store = get_vector_store()
        vector_store.add_documents(seeded_docs)
        logger.info(f"Successfully seeded database with {len(seeded_docs)} corporate risk chunks.")
        
    except Exception as e:
        logger.error(f"Failed to seed database: {str(e)}")
