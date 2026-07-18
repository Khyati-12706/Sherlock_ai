import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAuditTrail, buildClaimBreakdown, buildFallbackSummary, calculateFallbackRelevanceScore, isBadSummary, sanitizeEvidenceScores } from './src/investigationUtils.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Use the provided OpenRouter key only
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';

// Cached model list fetched from OpenRouter catalog endpoint
let cachedModelList = [];
let modelApiBase = 'https://openrouter.ai/api';

// If an OpenRouter key was provided, prefer its API base immediately
if (process.env.OPENROUTER_API_KEY) {
  modelApiBase = 'https://openrouter.ai/api';
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
      modelApiBase = 'https://openrouter.ai/api';
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
  if (!Array.isArray(cachedModelList) || cachedModelList.length === 0) return [];
  // Prefer explicit production-tier models if available
  const prod = cachedModelList.filter(m => (m.tier && String(m.tier).toLowerCase().includes('prod')) || (m.tags && m.tags.includes && m.tags.includes('production')));
  if (prod.length > 0) return prod.map(m => m.id || m.slug || m.name).filter(Boolean);
  // Heuristic: prefer chat/general models by common substrings
  const chatCandidates = cachedModelList.filter(m => /gpt|glm|gemma|zai|chat|oss/i.test(m.id || m.slug || m.name || ''));
  if (chatCandidates.length > 0) return chatCandidates.map(m => m.id || m.slug || m.name).filter(Boolean);
  return cachedModelList.map(m => m.id || m.slug || m.name).filter(Boolean);
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TAVILY_API_KEY}`
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
  let entities = [];
  const fallbackModels = ['llama3.1-8b', 'llama-3.3-70b', 'gemma-4-31b', 'zai-glm-4.7', 'gpt-oss-120b'];

  try {
    let extractResponse = null;
    // Attempt LLM entity extraction with fallbacks
    const availableModels = getAvailableModelIDs();
    const tryModels = (availableModels && availableModels.length > 0) ? availableModels : fallbackModels;
    for (const model of tryModels) {
      try {
        const resp = await fetch(`${modelApiBase}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You are an advanced entity extractor. Extract 2 to 3 key entities (specific people, organizations, or places) from the query that would have Wikipedia articles. Return a JSON object with an array of strings under the key "entities". Keep entities concise.'
              },
              {
                role: 'user',
                content: query
              }
            ]
          })
        });

        if (resp.ok) {
          extractResponse = resp;
          break;
        }
        if (resp.status === 404) {
          // model no longer available; remove from cache and continue
          removeModelFromCache(model);
          continue;
        }
      } catch (err) {
        // continue
      }
    }

    if (extractResponse && extractResponse.ok) {
      const resJson = await extractResponse.json();
      let rawContent = resJson.choices[0].message.content.trim();
      if (rawContent.startsWith("```")) {
        rawContent = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      }
      const data = JSON.parse(rawContent);
      entities = data.entities || [];
    } else {
      entities = backupEntityExtractor(query);
    }
  } catch (err) {
    entities = backupEntityExtractor(query);
  }

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
  let lastUsedModel = null;
  try {
    const formattedWebSources = tavilyResults.map((item, idx) => {
      return `Source ID: ev-${idx}\nTitle: ${item.title}\nURL: ${item.url}\nSnippet: ${item.snippet}\n`;
    }).join('\n');

    const formattedWikiSources = wikiResults.map((item, idx) => {
      return `Source ID: wiki-${idx}\nTitle: ${item.title}\nURL: ${item.url}\nSummary: ${item.snippet}\n`;
    }).join('\n');

    const sourcesBlock = `--- WEB SOURCES ---\n${formattedWebSources}\n--- WIKIPEDIA SOURCES ---\n${formattedWikiSources}`;

    const systemPrompt = `You are a precise, grounded intelligence coordinator.
Your task is to synthesize a report based ONLY on the provided sources (Tavily search results and Wikipedia summaries).
Do NOT extrapolate, copy-paste external information, or assume facts not explicitly mentioned in the source material.

Sources:
${sourcesBlock}

You must return a JSON object with the following fields:
{
  "summary": "A concise 3-4 sentence summary of the main event or fact coverage, grounded ONLY in the source material.",
  "keywords": ["6 to 10 key terms/names/events that literally appear in the snippets and summary, to be used for highlighting."],
  "insufficientEvidence": true/false (Set to true if the provided sources are empty, insufficient, or completely unrelated to the query. If true, keep summary short and keywords empty.),
  "evidence": [
    // For each provided Web Source (Source ID: ev-X), fill in these:
    {
      "id": "ev-0", // matching the provided Web Source ID
      "relevanceScore": 85, // integer 0-100 indicating how relevant this source is to the user's query
      "conflict": true/false // true if this source contains facts that directly contradict another provided source, otherwise false
    }
  ]
}

IMPORTANT RULES:
1. Do not use external knowledge. If the provided sources do not contain enough facts to answer, set "insufficientEvidence" to true.
2. The keywords must appear exactly as strings in the source text so they can be highlighted in the UI.
3. relevanceScore for each evidence item MUST be a distinct integer between 0-100, calculated based on: how directly the snippet confirms the query (40%), source recency (20%), source authority/domain reputation (20%), specificity of facts/dates/numbers present (20%). No two sources should have the same score unless genuinely tied. Never omit this field.
4. Never include phrases like "currently available information", "as of my last update", "I don't have real-time access" — you ARE given real-time retrieved evidence below, summarize ONLY from it, in a direct factual tone, as if reporting confirmed findings.
5. Keep the JSON strictly formatted. Return ONLY the JSON object. No explanations outside the JSON block.`;

    const trySynthesis = async (retryMode = false) => {
      let chatResponse = null;
      const promptSuffix = retryMode
        ? 'IMPORTANT RETRY: The previous answer was weak or invalid. Return a fresh JSON object with direct factual language, no disclaimer phrases, and make every evidence item carry a valid integer relevanceScore between 0 and 100.'
        : `Synthesize report for target: "${query}"`;

      const availableModels = getAvailableModelIDs();
      const tryModels = (availableModels && availableModels.length > 0) ? availableModels : fallbackModels;
      let usedModelId = null;
      for (const model of tryModels) {
        try {
          const resp = await fetch(`${modelApiBase}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: promptSuffix }
              ]
            })
          });

          if (resp.ok) {
            chatResponse = resp;
            usedModelId = model;
            lastUsedModel = model;
            break;
          }
          if (resp.status === 404) {
            // Remove the model from cache and continue with next
            removeModelFromCache(model);
            continue;
          }
        } catch (err) {
          // network or other transient error, try next
          console.warn('[Synthesis] model call failed for', model, err.message || err);
          continue;
        }
      }
      // attach which model served (if any) to chatResponse via meta
      if (chatResponse && usedModelId) chatResponse.usedModelId = usedModelId;

      if (!chatResponse || !chatResponse.ok) {
        return {
          summary: `The investigation used ${Math.min(tavilyResults.length, 8)} retrieved sources for the query "${query}".`,
          keywords: backupEntityExtractor(query),
          insufficientEvidence: tavilyResults.length === 0,
          evidence: tavilyResults.slice(0, 5).map((item, idx) => ({ id: `ev-${idx}`, relevanceScore: calculateFallbackRelevanceScore(query, item.snippet || '', idx, item.publishedDate, item.url || ''), conflict: false }))
        };
      }

      const resJson = await chatResponse.json();
      let rawContent = resJson.choices[0].message.content.trim();
      if (rawContent.startsWith("```")) {
        rawContent = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
      }
      return JSON.parse(rawContent);
    };

    try {
      synthesisResult = await trySynthesis(false);
    } catch (err) {
      synthesisResult = null;
      console.error('[Investigate SSE] Primary synthesis parse failed:', err.message || err);
    }

    if (!synthesisResult || !Array.isArray(synthesisResult.evidence)) {
      try {
        synthesisResult = await trySynthesis(true);
      } catch (err) {
        synthesisResult = null;
        console.error('[Investigate SSE] Retry synthesis parse failed:', err.message || err);
      }
    }

    if (synthesisResult && Array.isArray(synthesisResult.evidence)) {
      const evidenceItems = synthesisResult.evidence;
      const hasInvalidScores = evidenceItems.some((entry) => typeof entry.relevanceScore !== 'number' || !Number.isInteger(entry.relevanceScore) || entry.relevanceScore < 0 || entry.relevanceScore > 100);
      const badSummary = !synthesisResult.summary || isBadSummary(synthesisResult.summary);
      if (badSummary || hasInvalidScores) {
        try {
          const retryResult = await trySynthesis(true);
          if (retryResult) {
            synthesisResult = retryResult;
          }
        } catch (err) {
          console.error('[Investigate SSE] Retry synthesis failed:', err.message || err);
        }
      }
    }
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
      conflict: false
    }));

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
      auditTrail: buildAuditTrail(query, fallbackEvidence, wikiResults, 0),
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
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server successfully started on port ${PORT}`);
});
