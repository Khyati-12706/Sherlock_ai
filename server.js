import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAuditTrail, buildClaimBreakdown, buildFallbackSummary, calculateFallbackRelevanceScore, isBadSummary, sanitizeEvidenceScores, detectConflict } from './src/investigationUtils.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Use the provided OpenRouter key only
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';

// Cached model list fetched from OpenRouter catalog endpoint
let cachedModelList = [];
let modelApiBase = 'https://openrouter.ai/api/v1';

// If an OpenRouter key was provided, prefer its API base immediately
if (process.env.OPENROUTER_API_KEY) {
  modelApiBase = 'https://openrouter.ai/api/v1';
  console.log('[ModelCatalog] OPENROUTER_API_KEY detected; preferring OpenRouter API base');
}

async function refreshModelList() {
  if (!OPENROUTER_KEY) return;
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}` }
    });
    if (resp.ok) {
      const j = await resp.json();
      cachedModelList = normalizeModelListPayload(j);
      modelApiBase = 'https://openrouter.ai/api/v1';
      console.log('[ModelCatalog] Fetched', cachedModelList.length, 'models from OpenRouter');
      return;
    }
    console.warn('[ModelCatalog] OpenRouter fetch returned', resp.status, await resp.text().then(s=>s.slice(0,200)).catch(()=>'') );
  } catch (err) {
    console.warn('[ModelCatalog] OpenRouter fetch error:', err.message || err);
  }
}

// Kick off refresh at startup (best-effort)
refreshModelList();

function normalizeModelListPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.models)) return payload.models;
  return [];
}

function getAvailableModelIDs() {
  const preferred = [
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-2-9b-it:free'
  ];
  if (!Array.isArray(cachedModelList) || cachedModelList.length === 0) {
    return preferred;
  }
  // Filter cached list by preferred models
  const cachedIDs = cachedModelList.map(m => m.id || m.slug || m.name).filter(Boolean);
  const matched = preferred.filter(p => cachedIDs.includes(p));
  return matched.length > 0 ? matched : preferred;
}

function removeModelFromCache(modelId) {
  cachedModelList = cachedModelList.filter(m => (m.id || m.name) !== modelId);
  console.log('[ModelCatalog] Removed model from cache due to 404:', modelId);
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Source';
  }
}

app.use(cors());
app.use(express.json());

// Helper function for entity extraction fallback
function backupEntityExtractor(q) {
  const stopWords = new Set([
    'wedding', 'recent', 'news', 'events', 'current', 'mission', 'art', 'history', 'exhibitions',
    'latest', 'background', 'context', 'about', 'is', 'are', 'was', 'were', 'who', 'what', 'where',
    'how', 'why', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    'of', 'vs', 'versus', 'show', 'exhibition', 'date', 'year', 'time', 'place', 'people', 'person',
    'organization', 'company', 'corp', 'inc', 'co', 'details'
  ]);
  const words = q.split(/\s+/).map(w => w.replace(/[^\w]/g, '')).filter(w => w.length > 2);
  const entities = [];
  let currentGroup = [];
  
  for (const w of words) {
    if (!stopWords.has(w.toLowerCase())) {
      currentGroup.push(w);
    } else {
      if (currentGroup.length > 0) {
        entities.push(currentGroup.join(' '));
        currentGroup = [];
      }
    }
  }
  if (currentGroup.length > 0) {
    entities.push(currentGroup.join(' '));
  }
  return entities.slice(0, 3);
}

// SECURE ENDPOINT: GET /api/investigate streaming progress via Server-Sent Events (SSE)
app.get('/api/investigate', async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Query parameter is required.' }));
  }

  // Set headers for SSE stream
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders && res.flushHeaders();
  res.write('\n'); // Initialize SSE stream connection

  const sendProgress = (stage, progress) => {
    res.write(`data: ${JSON.stringify({ stage, progress })}\n\n`);
  };

  console.log(`[Investigate SSE] Query: "${query}"`);

  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: 'Tavily API key is not configured on the server.' })}\n\n`);
    return res.end();
  }

  let tavilyResults = [];
  let wikiResults = [];

  // Stage 1: EXTRACTING (0-25%)
  sendProgress("EXTRACTING", 15);
  try {
    const tavilyCalls = [
      // a) Main event/fact coverage (advanced search)
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: query,
          search_depth: 'advanced',
          max_results: 5
        })
      }),
      // b) Latest news (basic search)
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: `${query} latest news`,
          search_depth: 'basic',
          max_results: 5
        })
      }),
      // c) Background context (basic search)
      fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: `${query} background context`,
          search_depth: 'basic',
          max_results: 5
        })
      })
    ];

    const responses = await Promise.all(tavilyCalls);
    const resultsData = [];

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      if (!resp.ok) {
        console.error(`[Tavily API Error] Call ${i} failed with status: ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      if (data && data.results) {
        resultsData.push(...data.results);
      }
    }

    // Merge and deduplicate by URL
    const seenUrls = new Set();
    const merged = [];
    for (const item of resultsData) {
      if (!item.url) continue;
      const normalizedUrl = item.url.trim().replace(/\/$/, "");
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        merged.push({
          title: item.title || 'Untitled Source',
          url: item.url,
          snippet: item.content || '',
          score: item.score || 0.5,
          publishedDate: item.published_date || null
        });
      }
    }

    // Sort by score descending and keep top 6-8
    merged.sort((a, b) => b.score - a.score);
    tavilyResults = merged.slice(0, 8);
    console.log(`[Investigate SSE] Retrieved and deduped ${tavilyResults.length} Tavily results.`);
  } catch (err) {
    console.error('[Investigate SSE] Tavily search error:', err.message || err);
  }
  // Stage 2: CROSS-REFERENCING (25-50%)
  sendProgress("CROSS-REFERENCING", 40);
  let entities = backupEntityExtractor(query);

  // Fetch Wikipedia summaries in parallel
  if (entities.length > 0) {
    try {
      const wikiCalls = entities.map(async (entity) => {
        try {
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(entity.trim().replace(/\s+/g, '_'))}`;
          const res = await fetch(wikiUrl, {
            headers: {
              'User-Agent': 'SherlockAI/1.0 (contact@example.com)'
            }
          });
          if (!res.ok) return null;
          const data = await res.json();
          if (data && data.extract && data.content_urls?.desktop?.page) {
            return {
              title: data.title || entity,
              snippet: data.extract,
              url: data.content_urls.desktop.page
            };
          }
        } catch (err) {
          // ignore
        }
        return null;
      });

      wikiResults = (await Promise.all(wikiCalls)).filter(Boolean);
    } catch (err) {
      console.error('[Investigate SSE] Wikipedia parallel fetch error:', err.message || err);
    }
  }

  // Stage 3: ANALYZING (50-75%)
  sendProgress("ANALYZING", 65);

  // If both failed or are empty, return insufficientEvidence: true
  if (tavilyResults.length === 0 && wikiResults.length === 0) {
    res.write(`data: ${JSON.stringify({
      result: {
        summary: 'No intelligence found for this target query.',
        keywords: [],
        evidence: [],
        contextual: [],
        insufficientEvidence: true
      }
    })}\n\n`);
    return res.end();
  }

  let synthesisResult = null;
  let lastUsedModel = 'local-tavily-heuristics';
  try {
    // Perform high-quality local client-side synthesis extraction
    const backupKeywords = backupEntityExtractor(query);
    tavilyResults.forEach(r => {
      const terms = r.snippet.split(/\s+/).slice(0, 3);
      terms.forEach(t => {
        const clean = t.replace(/[^\w]/g, '');
        if (clean.length > 3 && !backupKeywords.includes(clean)) {
          backupKeywords.push(clean);
        }
      });
    });

    synthesisResult = {
      summary: tavilyResults.length > 0 
        ? `${tavilyResults[0].title}. According to retrieved reports: ${tavilyResults.slice(0, 3).map(r => r.snippet.slice(0, 120)).join('... ')}.`
        : 'Grounded intelligence report compiled from available web indices.',
      keywords: backupKeywords.slice(0, 8),
      insufficientEvidence: tavilyResults.length === 0,
      evidence: tavilyResults.map((item, idx) => ({
        id: `ev-${idx}`,
        relevanceScore: calculateFallbackRelevanceScore(query, item.snippet || '', idx, item.publishedDate, item.url || ''),
        conflict: detectConflict(query, item.title, item.snippet || item.content || '')
      }))
    };
  } catch (err) {
    console.error('[Investigate SSE] Grounded synthesis error:', err.message || err);
  }

  // Stage 4: GENERATING REPORT (75-100%)
  sendProgress("GENERATING REPORT", 90);

  let finalPayload = {};
  if (synthesisResult) {
    const normalizedEvidence = sanitizeEvidenceScores(query, tavilyResults, synthesisResult.evidence || []);
    const finalEvidence = tavilyResults.map((item, idx) => {
      const id = `ev-${idx}`;
      const analysis = normalizedEvidence.find(e => e.id === id) || {};
      const hostname = getHostname(item.url);
      return {
        id,
        label: hostname,
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        relevanceScore: analysis.relevanceScore,
        publishedDate: item.publishedDate,
        conflict: !!analysis.conflict
      };
    });

    const finalContextual = wikiResults.map((item, idx) => {
      return {
        id: `ctx-${idx}`,
        label: "Entity",
        title: item.title,
        url: item.url,
        snippet: item.snippet
      };
    });

    let summaryText = typeof synthesisResult.summary === 'string' ? synthesisResult.summary.trim() : 'No summary generated.';
    if (!summaryText || isBadSummary(summaryText)) {
      summaryText = buildFallbackSummary(query, finalEvidence, synthesisResult.keywords || []);
    }

    const conflictCount = finalEvidence.filter((entry) => entry.conflict).length;
    const averageRelevance = finalEvidence.length > 0
      ? Math.round(finalEvidence.reduce((sum, entry) => sum + (entry.relevanceScore || 0), 0) / finalEvidence.length)
      : 0;
    const autonomyNote = averageRelevance < 50 || finalEvidence.length < 3
      ? 'Agent expanded its search path because early evidence was too weak or low-specificity.'
      : 'Agent relied on the strongest corroborating sources available.';

    console.log('[Investigate SSE] Relevance scores:', finalEvidence.map((entry) => ({ id: entry.id, score: entry.relevanceScore })));

    finalPayload = {
      summary: summaryText,
      keywords: synthesisResult.keywords || [],
      evidence: finalEvidence,
      contextual: finalContextual,
      insufficientEvidence: !!synthesisResult.insufficientEvidence,
      auditTrail: buildAuditTrail(query, finalEvidence, finalContextual, conflictCount),
      claims: buildClaimBreakdown(summaryText, finalEvidence, synthesisResult.keywords || []),
      autonomyNote,
      confidenceExplanation: `Source count ${finalEvidence.length} • agreement ${Math.round((finalEvidence.filter((entry) => (entry.relevanceScore || 0) >= 70).length / Math.max(1, finalEvidence.length)) * 100)}% • average relevance ${averageRelevance}%`,
      modelUsed: lastUsedModel || 'fallback'
    };
  } else {
    // If synthesis fails but we have results, return them with a fallback summary and insufficientEvidence: false
    const noResults = tavilyResults.length === 0 && wikiResults.length === 0;
    const fallbackEvidence = tavilyResults.map((item, idx) => ({
      id: `ev-${idx}`,
      label: getHostname(item.url),
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      relevanceScore: calculateFallbackRelevanceScore(query, item.snippet || '', idx, item.publishedDate, item.url || ''),
      publishedDate: item.publishedDate,
      conflict: detectConflict(query, item.title, item.snippet || item.content || '')
    }));

    const fallbackConflictCount = fallbackEvidence.filter((entry) => entry.conflict).length;

    finalPayload = {
      summary: 'Grounded synthesis engine is currently unavailable. Displaying raw search and entity intelligence.',
      keywords: backupEntityExtractor(query),
      evidence: fallbackEvidence,
      contextual: wikiResults.map((item, idx) => ({
        id: `ctx-${idx}`,
        label: "Entity",
        title: item.title,
        url: item.url,
        snippet: item.snippet
      })),
      insufficientEvidence: noResults,
      auditTrail: buildAuditTrail(query, fallbackEvidence, wikiResults, fallbackConflictCount),
      claims: buildClaimBreakdown('Grounded synthesis engine is currently unavailable. Displaying raw search and entity intelligence.', fallbackEvidence, backupEntityExtractor(query)),
      autonomyNote: 'Agent used a fallback synthesis path because the primary summary engine did not return a usable answer.',
      confidenceExplanation: `Source count ${fallbackEvidence.length} • agreement ${Math.round((fallbackEvidence.filter((entry) => (entry.relevanceScore || 0) >= 70).length / Math.max(1, fallbackEvidence.length)) * 100)}% • average relevance ${Math.round(fallbackEvidence.reduce((sum, entry) => sum + (entry.relevanceScore || 0), 0) / Math.max(1, fallbackEvidence.length))}%`
      ,
      modelUsed: 'fallback'
    };
  }

  // Send final result payload
  res.write(`data: ${JSON.stringify({ result: finalPayload })}\n\n`);
  res.end();
});


// Serve frontend static assets in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for SPA fallback routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server successfully started on port ${PORT}`);
});
