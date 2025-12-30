import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { nextStep } from './next-step.js';
import { writeRunlog } from './runlog-write.js';
import { getCoaching } from './pillar2/coaching_engine.js';

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// Health check
// --------------------
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'GeminiScanner',
    ts: new Date().toISOString(),
  });
});
