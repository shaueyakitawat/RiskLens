# Run Guide: RiskLens Setup & Installation

Follow these steps to set up and run the RiskLens backend and frontend applications locally.

## 📋 Prerequisites

Ensure you have the following installed on your machine:
* **Python 3.10+** (with pip)
* **Node.js 18+** (with npm)
* Git

---

## 🐍 1. Backend Setup

The backend serves the FastAPI server, embeddings calculator, local Qdrant instance, and coordinates LLM prompts.

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: If you encounter issues compiling packages, ensure your compiler tools are up-to-date. PyMuPDF and FastEmbed will automatically compile or pull prebuilt binaries.*

3. **Configure Environment Variables**:
   Create a `.env` file in the `backend/` directory by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and fill in your API credentials:
   ```env
   # Server Configuration
   PORT=8000
   HOST=127.0.0.1

   # AI Provider: 'google' (default) or 'openai'
   LLM_PROVIDER=google
   EMBEDDING_PROVIDER=local  # Runs locally, no key needed!

   # API Keys (Provide at least one)
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_API_KEY=your_groq_api_key_here  # Fallback provider key
   OPENAI_API_KEY=
   ```

4. **Run the FastAPI server**:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   * The server will boot on `http://127.0.0.1:8000`.
   * On startup, the backend automatically checks if Qdrant contains seed data. If it is empty, it will **auto-seed** the database with realistic SEC risk disclosures for **Apple, Nvidia, and Microsoft** (representing 2 years of filings each).

---

## 💻 2. Frontend Setup

The frontend is a single-page React application built with TypeScript, Vite, and Tailwind CSS.

1. **Navigate to the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Install node dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```
   * The client development server will start, typically at `http://localhost:5173`.
   * Open your browser and navigate to this URL to access the platform.

---

## 🧹 Database Management

If you want to clear your local database indexes and reset the seed cache data to start fresh:
1. Open the platform in your browser.
2. Go to the **Upload Disclosures** tab on the sidebar.
3. Scroll to the bottom and click the red **Clear Database** button.
4. The backend will destroy the existing Qdrant collection, purge all non-default company caches, recreate the index, and automatically re-inject the default company filing chunks.
