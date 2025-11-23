// src/utils/alertEngine.js

/**
 * Checks for alerts based on price history using a rolling time window.
 * 使用滾動時間窗口 (Rolling Window) 來計算漲跌幅度
 * @param {Array} priceHistory - Array of { timestamp, open, close, ... } objects.
 * @param {number} currentPrice - The current price.
 * @param {number} currentTime - The current timestamp (ms).
 * @param {number} thresholdPoints - The N points to trigger alert.
 * @param {number} timeWindowMinutes - The T time window in minutes.
 * @param {string} direction - 'RISE', 'FALL', or 'BOTH'.
 * @returns {Object|null} Alert object if triggered, null otherwise.
 */
export const checkAlert = (priceHistory, currentPrice, currentTime, thresholdPoints, timeWindowMinutes, direction = 'BOTH') => {
    if (!priceHistory || priceHistory.length === 0) return null;

    // 計算目標時間點 (當前時間 - 時間窗口)
    const targetTime = currentTime - (timeWindowMinutes * 60 * 1000);

    // 在歷史資料中尋找最接近目標時間點的資料
    // 我們假設 priceHistory 是按時間排序的
    // 為了效能，我們可以從後往前找，因為目標時間通常在比較新的資料中
    let baselineData = null;

    // 容許的時間誤差 (例如：目標時間的前後 30 秒內)
    // 如果資料頻率是每秒一筆，這應該很容易找到
    // 容許的時間誤差 (例如：目標時間的前後 120 秒內)
    // 為了容忍資料可能有 1-2 分鐘的缺漏，將誤差放寬到 120 秒
    const timeTolerance = 120 * 1000;

    for (let i = priceHistory.length - 1; i >= 0; i--) {
        const point = priceHistory[i];
        if (point.timestamp <= targetTime) {
            // 找到第一個小於等於目標時間的點
            // 檢查這個點是否在容許誤差範圍內 (避免用到太舊的資料)
            if (targetTime - point.timestamp <= timeTolerance) {
                baselineData = point;
            }
            // 既然已經找到小於等於目標時間的點，再往前的點只會更舊，所以可以停止搜尋
            // 但如果這個點太舊 (超過 tolerance)，表示我們缺資料，無法計算這個窗口的漲跌
            break;
        }
    }

    if (!baselineData) {
        // 找不到符合時間窗口的基準點 (可能是資料不足或是剛開盤不久)
        return null;
    }

    // 使用基準點的收盤價作為比較基準 (也可以考慮用 open，視需求而定，這裡用 close 代表那個時間點的價格)
    const baselinePrice = baselineData.close;

    // 計算相對於基準點的漲跌幅
    const changeFromBaseline = currentPrice - baselinePrice;

    // Check for Rise (上漲警示)
    if (direction === 'RISE' || direction === 'BOTH') {
        if (changeFromBaseline >= thresholdPoints) {
            return {
                type: 'RISE',
                points: Math.round(changeFromBaseline),
                fromPrice: baselinePrice,
                toPrice: currentPrice,
                time: currentTime,
                timeWindow: timeWindowMinutes, // 加入時間窗口資訊
                baselineTime: baselineData.timestamp // 加入基準時間
            };
        }
    }

    // Check for Fall (下跌警示)
    if (direction === 'FALL' || direction === 'BOTH') {
        if (-changeFromBaseline >= thresholdPoints) {
            return {
                type: 'FALL',
                points: Math.round(-changeFromBaseline),
                fromPrice: baselinePrice,
                toPrice: currentPrice,
                time: currentTime,
                timeWindow: timeWindowMinutes, // 加入時間窗口資訊
                baselineTime: baselineData.timestamp // 加入基準時間
            };
        }
    }

    return null;
};
