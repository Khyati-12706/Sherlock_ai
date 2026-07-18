import dotenv from 'dotenv';
dotenv.config();
const key = process.env.TAVILY_API_KEY;
console.log('key', key ? key.slice(0, 8) + '...' : 'missing');
const body = { api_key: key, query: 'Latest OpenAI news', search_depth: 'basic', max_results: 3 };
const response = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`
  },
  body: JSON.stringify(body)
});
console.log('status', response.status);
console.log(await response.text());
