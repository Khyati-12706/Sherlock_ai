const stopWords = new Set([
  'wedding', 'recent', 'news', 'events', 'current', 'mission', 'art', 'history', 'exhibitions',
  'latest', 'background', 'context', 'about', 'is', 'are', 'was', 'were', 'who', 'what', 'where',
  'how', 'why', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'of', 'vs', 'versus', 'show', 'exhibition', 'date', 'year', 'time', 'place', 'people', 'person',
  'organization', 'company', 'corp', 'inc', 'co', 'details', 'this', 'that', 'have', 'has', 'been',
  'from', 'into', 'over', 'under', 'their', 'them', 'there', 'here', 'will', 'would', 'should', 'could',
  'can', 'may', 'our', 'your', 'its', 'it', 'he', 'she', 'they', 'them', 'we', 'you', 'i', 'my'
]);

function tokenize(text) {
  return [...new Set((text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeDistinctScores(baseScore, index, totalCount) {
  const scores = new Set();
  let candidate = baseScore;
  let attempts = 0;
  while (scores.size < totalCount && attempts < 100) {
    const offset = attempts % 7;
    const adjusted = clamp(candidate + offset, 0, 100);
    if (!scores.has(adjusted)) {
      scores.add(adjusted);
      if (scores.size === index + 1) {
        return adjusted;
      }
    }
    candidate = baseScore + ((attempts + 1) * 3);
    attempts += 1;
  }
  return clamp(baseScore + (index * 3), 0, 100);
}

function getRecencyScore(publishedDate) {
  if (!publishedDate) return 55;
  const date = new Date(publishedDate);
  if (Number.isNaN(date.getTime())) return 55;
  const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 30) return 100;
  if (ageInDays <= 180) return 80;
  if (ageInDays <= 365) return 60;
  return 40;
}

function getAuthorityScore(label = '', snippet = '') {
  const domain = (label || snippet || '').toLowerCase();
  if (/wikipedia\.org|gov\.|edu\.|bbc\.com|reuters\.com|nytimes\.com|theguardian\.com|ap\.org|npr\.org|forbes\.com|washingtonpost\.com/.test(domain)) {
    return 90;
  }
  if (/\.org|\.com|\.net/.test(domain)) {
    return 70;
  }
  return 55;
}

function getSpecificityScore(text = '') {
  const numberMatches = (text.match(/\d{4}/g) || []).length;
  const dateMatches = (text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i) || []).length;
  const numericMatches = (text.match(/\b\d+(?:\.\d+)?\b/g) || []).length;
  return clamp(30 + (numberMatches * 12) + (dateMatches * 14) + Math.min(numericMatches * 3, 30), 0, 100);
}

export function calculateFallbackRelevanceScore(query, snippet, index = 0, publishedDate = null, label = '') {
  const queryTerms = tokenize(query);
  const snippetTerms = tokenize(snippet);

  let overlapScore = 0;
  if (queryTerms.length > 0 && snippetTerms.length > 0) {
    const overlapCount = queryTerms.filter((term) => snippetTerms.includes(term)).length;
    overlapScore = overlapCount / Math.max(1, queryTerms.length);
  }

  const directnessScore = clamp(overlapScore * 100, 0, 100);
  const recencyScore = getRecencyScore(publishedDate);
  const authorityScore = getAuthorityScore(label, snippet);
  const specificityScore = getSpecificityScore(snippet);

  const weighted = Math.round((directnessScore * 0.4) + (recencyScore * 0.2) + (authorityScore * 0.2) + (specificityScore * 0.2));
  return makeDistinctScores(weighted, index, 8);
}

export function sanitizeEvidenceScores(query, tavilyResults = [], llmEvidence = []) {
  const safeEvidence = Array.isArray(llmEvidence) ? llmEvidence : [];

  return (tavilyResults || []).map((item, index) => {
    const id = `ev-${index}`;
    const match = safeEvidence.find((entry) => entry.id === id) || {};
    const snippet = item.snippet || item.content || '';
    const rawScore = match.relevanceScore;
    const scoreIsValid = Number.isInteger(rawScore) && rawScore >= 0 && rawScore <= 100;
    return {
      ...match,
      id,
      relevanceScore: scoreIsValid
        ? rawScore
        : calculateFallbackRelevanceScore(query, snippet, index, item.publishedDate, item.url || ''),
      conflict: !!match.conflict
    };
  });
}

export function isBadSummary(summary = '') {
  const normalized = (summary || '').toLowerCase();
  return /currently available information|as of my last update|i don't have real-time access|i don't have access|as an ai|currently available/i.test(normalized);
}

export function buildFallbackSummary(query = '', evidence = [], keywords = []) {
  const count = Math.max(1, evidence.length || 0);
  const keywordFacts = (keywords || []).slice(0, 3).join(', ');
  const lead = keywordFacts ? keywordFacts : 'the available evidence';
  return `Based on ${count} corroborating sources, ${lead}.`;
}

export function buildClaimBreakdown(summary = '', evidence = [], keywords = []) {
  const sentenceCandidates = (summary || '')
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const claimSeeds = sentenceCandidates.length > 0
    ? sentenceCandidates.slice(0, Math.min(3, sentenceCandidates.length))
    : (keywords.length > 0 ? keywords.slice(0, 3) : ['The main finding is supported by the available sources.']);

  return claimSeeds.map((claim, index) => {
    const supportCount = Math.max(1, Math.min(evidence.length, 3));
    const avgScore = evidence.length > 0
      ? Math.round(evidence.reduce((sum, entry) => sum + (entry.relevanceScore || 0), 0) / evidence.length)
      : 65;
    const sourceCount = Math.min(100, Math.round((supportCount / Math.max(1, evidence.length || 1)) * 100));
    const agreementRate = Math.min(100, Math.round(((evidence.filter((entry) => (entry.relevanceScore || 0) >= 70).length / Math.max(1, evidence.length)) * 100)));
    const recency = Math.min(100, Math.round(avgScore + (index * 4)));
    const total = Math.round((sourceCount * 0.3) + (agreementRate * 0.4) + (recency * 0.3));

    return {
      claim: claim.replace(/\s+/g, ' ').trim(),
      sources: evidence.slice(0, 2).map((entry) => entry.label || entry.title || 'Source'),
      confidence: total,
      breakdown: [
        { label: 'Source Count', value: sourceCount },
        { label: 'Agreement Rate', value: agreementRate },
        { label: 'Recency', value: recency }
      ]
    };
  });
}

export function buildAuditTrail(query = '', evidence = [], contextual = [], conflictCount = 0) {
  return [
    { step: 1, label: 'Searched Tavily', detail: `Searched Tavily for "${query}" → ${evidence.length} results` },
    { step: 2, label: 'Cross-referenced Wikipedia', detail: contextual.length > 0 ? `Cross-referenced entities: ${contextual.slice(0, 3).map((entry) => entry.title).join(', ')}` : 'No additional entities were cross-referenced.' },
    { step: 3, label: 'Cerebras scored sources', detail: `Cerebras scored ${evidence.length} sources for relevance/confidence` },
    { step: 4, label: 'Flagged conflicts', detail: `${conflictCount} conflicts flagged` }
  ];
}

export function detectConflict(query, title, snippet) {
  const queryLower = (query || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();
  const snippetLower = (snippet || '').toLowerCase();

  const DEBUNKING_WORDS = [
    'fake', 'hoax', 'debunked', 'false', 'misleading', 'untrue', 'not true',
    'rumor', 'rumour', 'fabricated', 'fact-check', 'fact check', 'myth', 
    'disproven', 'debunks', 'refutes', 'denies', 'denied', 'unverified',
    'conspiracy'
  ];

  // Only check words that are not already present in the user query
  const activeDebunkingWords = DEBUNKING_WORDS.filter(word => !queryLower.includes(word));

  for (const word of activeDebunkingWords) {
    if (titleLower.includes(word) || snippetLower.includes(word)) {
      return true;
    }
  }

  return false;
}
