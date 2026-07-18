import dotenv from 'dotenv';
dotenv.config();
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
console.log('keys ok', !!TAVILY_API_KEY, !!OPENROUTER_KEY);
const query = 'Latest OpenAI news';
try {
  const tavilyCalls = [
    fetch('https://api.tavily.com/search', {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${TAVILY_API_KEY}`}, body: JSON.stringify({api_key:TAVILY_API_KEY,query,search_depth:'advanced',max_results:5})}),
    fetch('https://api.tavily.com/search', {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${TAVILY_API_KEY}`}, body: JSON.stringify({api_key:TAVILY_API_KEY,query:`${query} latest news`,search_depth:'basic',max_results:5})}),
    fetch('https://api.tavily.com/search', {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${TAVILY_API_KEY}`}, body: JSON.stringify({api_key:TAVILY_API_KEY,query:`${query} background context`,search_depth:'basic',max_results:5})})
  ];
  const responses = await Promise.all(tavilyCalls);
  console.log('tavily statuses', responses.map(r => r.status));
  const resultsData = [];
  for (const resp of responses) {
    if (!resp.ok) continue;
    const data = await resp.json();
    if (data?.results) resultsData.push(...data.results);
  }
  console.log('resultsData', resultsData.length);
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:'POST',
    headers:{'Authorization':`Bearer ${OPENROUTER_KEY}`,'Content-Type':'application/json'},
    body: JSON.stringify({model:'openai/gpt-4o-mini',response_format:{type:'json_object'},messages:[{role:'system',content:'Return JSON: {"entities":["OpenAI"]}'},{role:'user',content:query}]})
  });
  console.log('entity status', resp.status);
  console.log(await resp.text());
} catch (err) {
  console.error(err);
}
