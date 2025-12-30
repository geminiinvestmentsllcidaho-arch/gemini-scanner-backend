import { alpaca } from './alpaca.js';

/**
 * Fetches the latest trade price from Alpaca and returns a placeholder decision.
 * Works only for symbols supported in your paper account.
 * @param {string} symbol - Ticker symbol
 */
export async function nextStep(symbol) {
    try {
        const latestTrade = await alpaca.getLatestTrade(symbol);
        const price = latestTrade.Price;

        console.log(`Latest trade price for ${symbol}: $${price}`);

        return {
            symbol,
            action: 'hold',       // placeholder action
            price: price,
            confidence: 0.5       // placeholder confidence
        };
    } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error);
        return { symbol, action: 'hold', price: null, confidence: 0 };
    }
}

