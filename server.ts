import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import openAIHandler from './netlify/functions/openai.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '8mb' }));

app.post('/.netlify/functions/openai', async (req, res) => {
  const request = new Request(`http://localhost/.netlify/functions/openai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  });
  const response = await openAIHandler(request);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await response.text());
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'finish-future-career-ai' });
});

const start = async () => {
  const port = Number(process.env.PORT) || 3000;
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

start().catch(() => {
  process.exitCode = 1;
});
