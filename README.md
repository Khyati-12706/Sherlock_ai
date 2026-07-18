# SHERLOCK AI — Autonomous OSINT & Explainability Dashboard

An autonomous investigative agent. Enter a query — it searches the web, cross-references entities, scores sources, and shows the entire investigation as an interactive, explainable node map.

Built for the **Explainable Agentic Systems Challenge** (Problem 4: OSINT Investigative Agent).

## Highlights

- Autonomous multi-step search & scoring
- Interactive drag-and-drop investigation map
- Claim-by-claim breakdown with source citations
- Direct links to original articles / Wikipedia
- Conflict detection between sources
- SHAP relevance score + overall confidence score
- Full audit trail of agent actions

## Tech Stack

React · Node.js/Express · Tavily (search) · Wikipedia API (entities) · OpenRouter (LLM reasoning) · SSE (live pipeline progress)

## Prerequisites

- Node.js v18+
- API keys: OpenRouter (openrouter.ai), Tavily (tavily.com)

## Run Locally

git clone <your-repo-url>
cd sherlock-ai
npm install

Create `.env` in root:

OPENROUTER_API_KEY=sk-or-v1-your-key
TAVILY_API_KEY=tvly-your-key
PORT=3000

Start:

npm start

Open http://localhost:3000, enter a query, click Analyze.

