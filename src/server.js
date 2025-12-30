import dotenv from 'dotenv';
import express from 'express';
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { nextStep } from './next-step.js';

dotenv.config();

const app = express();
app.use(express.json());

// Existing routes
app.get('/health', health);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);

// New route to test nextStep (async)
app.get('/api/next-step', async (req, res) => {
    const symbol = req.query.symbol || 'AAPL';
    const decision = await nextStep(symbol);
    res.json(decision);
});

// Server listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
