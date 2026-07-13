# Customer Zero Scanner Roadmap

Status: planned
Scope: Customer Zero only
Asset universe: stocks
Execution mode: decision-assist/read-only until paper execution is explicitly enabled

## Current Surface

- `/customer-zero/scanner` currently renders the shared customer scanner hub.
- Intraday routes to `/app/todays-intraday-setups?session=regular`.
- Under $5 routes to `/customer-zero/under-five-scanner`.
- Swing and Long-term remain future modes.
- Current intraday cards expose scanner internals and remain read-only.
- Stale or blocked scanner data must never permit an order.

## Build Sequence

1. Add Customer Zero result-state normalization.
2. Add persistent multi-select result filters.
3. Build compact operator-facing decision cards.
4. Connect fresh rankings and explicit stale-data blocking.
5. Add read-only allocation controls and calculated order previews.
6. Connect paper buying power, positions, and ledger data.
7. Add paper-only ENTER and EXIT controls behind explicit safety gates.
8. Add timeframe performance reporting and earnings summary.
9. Run focused tests, full safety validation, runtime smoke, commit, push, and freeze.
10. Discuss private live execution only after successful paper testing.

## Result States

Normalize all scanner outcomes into a stable Customer Zero display state:

- ENTER
- DO_NOT_ENTER
- WAIT
- EXIT
- BLOCKED
- WATCH
- NO_SETUP
- STALE_DATA
- Additional backend states mapped explicitly without silently granting trade permission

Filters must support show all, multiple selections, individual hide/show, and persistence for Customer Zero.

## Decision Cards

Each card should prioritize:

1. EXIT state and affected position
2. Symbol
3. Normalized decision state
4. Current price and data timestamp
5. Freshness and blocking status
6. Setup name and confidence
7. Plain-language reasons
8. Allocation preview
9. Paper execution controls only when all gates pass

Internal diagnostics should remain available separately and should not dominate the operator surface.

## ENTER Control

Qualified ENTER results may display a bright green ENTER / BUY control only when paper execution is deliberately enabled.

Required gates:

- current quote
- fresh signal
- valid paper account state
- sufficient buying power
- price-deviation check
- duplicate-order prevention
- kill switch clear
- market-hours validation
- spread and liquidity checks
- scanner, portfolio, and capacity limits

No order may be submitted from stale, blocked, DO_NOT_ENTER, WAIT, WATCH, or NO_SETUP results.

## EXIT Control

A red EXIT control must receive visual priority over ENTER when an existing position reaches an exit condition.

Requirements:

- identify symbol and affected position
- require confirmation during early paper testing
- require fresh position and quote data
- preserve exit-all and kill-switch protections
- record a complete audit trail

## Allocation Controls

### Available Funds Percentage

- presets in 5% increments
- slider
- manual percentage field
- valid range: 0% through 80%
- hard cap: 80%
- conservative default until manually changed
- show calculated dollar allocation before submission

### Maximum Dollars Per Stock

- presets in $5 increments
- slider
- manual dollar field
- positive finite values only
- warn when requested amount exceeds available funds

Final order amount must be the lowest of:

- selected available-funds percentage
- selected maximum dollars per stock
- current buying power
- scanner risk limit
- portfolio exposure limit
- liquidity/capacity limit

The interface must never bypass the hard 80% available-funds ceiling.

## Performance Reporting

Selectable periods:

- Daily
- Weekly
- Monthly
- Yearly
- Year to date
- Lifetime

Use broker or paper-ledger data, not scanner estimates.

Report when data exists:

- realized profit/loss
- unrealized profit/loss
- total profit/loss
- winning and losing trades
- win rate
- average gain
- average loss
- largest gain
- largest loss
- fees and slippage
- starting and ending equity
- drawdown

At the top of the Customer Zero page, show total earnings for the selected timeframe with positive, negative, and neutral styling. Show realized, unrealized, combined totals, data timestamp, and stale status.

## Safety Controls

- paper trading first
- explicit execution-mode indicator
- hard 80% available-funds ceiling
- configurable reserve cash
- maximum dollars per stock
- maximum open positions
- maximum daily loss
- maximum loss per trade
- duplicate-order prevention
- price-slippage/deviation limit
- spread and liquidity checks
- market-hours validation
- fresh-data requirement
- position-aware EXIT controls
- full audit logging
- emergency kill switch
- no hidden live activation
- no order from stale or blocked data

## Deferred Work

- General customer-facing expansion
- Swing and Long-term scanners
- ETF, crypto, and options universes
- Broad customer auto-execution
- Strategy capacity and crowding control
- Commercial conflict-of-interest and legal/compliance review
