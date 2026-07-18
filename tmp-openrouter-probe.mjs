import dotenv from 'dotenv';
dotenv.config();
const key = process.env.OPENROUTER_API_KEY;
const body = {
  model: 'openai/gpt-4o-mini',
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: 'Return JSON: {"entities":["OpenAI"]}' },
    { role: 'user', content: 'Latest OpenAI news' }
  ]
};
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
console.log('status', response.status);
console.log(await response.text());
