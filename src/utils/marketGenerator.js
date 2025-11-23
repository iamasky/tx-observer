// src/utils/marketGenerator.js

/**
 * Generates a single day's worth of minute-level OHLC data.
 * @param {Date} date - The date to generate data for.
 * @param {boolean} isNightSession - Whether it's a night session.
 * @returns {Array} Array of OHLC objects.
 */
export const generateMarketData = (date, isNightSession = false) => {
  const data = [];
  // TX Regular Session: 08:45 - 13:45 (5 hours)
  // TX Night Session: 15:00 - 05:00 (next day) (14 hours)

  let startTime = new Date(date);
  let endTime = new Date(date);

  if (isNightSession) {
    startTime.setHours(15, 0, 0, 0);
    endTime.setDate(endTime.getDate() + 1);
    endTime.setHours(5, 0, 0, 0);
  } else {
    startTime.setHours(8, 45, 0, 0);
    endTime.setHours(13, 45, 0, 0);
  }

  // Initial price (random base around 20000 for realism)
  let currentPrice = 20000 + (Math.random() * 1000 - 500);

  let currentTime = new Date(startTime);

  while (currentTime <= endTime) {
    const open = currentPrice;
    // Random walk volatility
    const volatility = 10; // points
    const change = (Math.random() - 0.5) * volatility;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;

    data.push({
      time: new Date(currentTime).toISOString(),
      timestamp: currentTime.getTime(),
      open: parseFloat(open.toFixed(0)),
      high: parseFloat(high.toFixed(0)),
      low: parseFloat(low.toFixed(0)),
      close: parseFloat(close.toFixed(0)),
      volume: Math.floor(Math.random() * 100)
    });

    // Next data point (10 seconds resolution)
    currentTime.setSeconds(currentTime.getSeconds() + 10);
    currentPrice = close;
  }

  return data;
};

/**
 * Simulates the next tick based on the last price.
 * @param {number} lastPrice 
 * @returns {number} New price
 */
export const getNextPrice = (lastPrice) => {
  const volatility = 5;
  const change = (Math.random() - 0.5) * volatility;
  return parseFloat((lastPrice + change).toFixed(0));
};
