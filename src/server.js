import dotenv from 'dotenv';
import express from 'express';
import { getDiagnostics } from './diagnostics/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * Health / diagnostics endpoint
 */
app.get('/diagnostics', (req, res) => {
  res.json(getDiagnostics());
});

/**
 * Root
 */
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'GeminiScanner' });
});

app.listen(PORT, () => {
  console.log(`GeminiScanner listening on port ${PORT}`);
});
