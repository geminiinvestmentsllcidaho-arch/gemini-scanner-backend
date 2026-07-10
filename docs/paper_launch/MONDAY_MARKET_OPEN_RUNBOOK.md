# Monday Market-Open Runbook

Decision: NO-GO until market-open freshness passes.

Run after the stock market is open:

Freshness decision scripts:

- npm run paper:monday:freshness
- npm run paper:monday:freshness:strict

Strict expected behavior:

- exits 10 while scanner remains stale/blocked
- exits 0 only after market-open freshness passes
- still requires operator review before any tiny paper attempt


- verify /health is ok, degraded=false
- verify /scanner/rankings is fresh, not stale
- verify at least one ranking has p3GateOk=true
- review /app/paper-readiness-gate
- review /app/paper-trade-readiness-report
- review /app/paper-trade-operator-go-no-go
- confirm selected symbol, live price, quantity, and risk are visible
- run dry-run preview before any tiny paper attempt
- require exact operator approval

Hard blocks:

- no real-money trading
- no auto trading
- no OAuth/connect/account mutation
- no tiny paper attempt until freshness and approval gates pass

Abort:

- pm2 stop gemini-scanner
- pm2 logs gemini-scanner --lines 100
- npm run validate:trading-safety
- npm run validate:connect-safety
