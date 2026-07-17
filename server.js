import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Proxy endpoint to forward chat completions requests to Cerebras API securely
app.post('/api/cerebras', async (req, res) => {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    console.error('Error: CEREBRAS_API_KEY environment variable is not defined.');
    return res.status(500).json({ error: 'CEREBRAS_API_KEY is not configured on the server.' });
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const status = response.status;
    const contentType = response.headers.get('content-type');
    
    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      console.error(`Error: Cerebras API returned status ${status}:`, responseData);
      return res.status(status).json(typeof responseData === 'string' ? { error: responseData } : responseData);
    }

    return res.status(status).json(responseData);
  } catch (error) {
    console.error('Error forwarding request to Cerebras API:', error);
    return res.status(500).json({ error: 'Failed to communicate with Cerebras API.', details: error.message });
  }
});

// Serve frontend static assets in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));

// Serve index.html for SPA fallback routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server successfully started on port ${PORT}`);
});
