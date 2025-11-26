import React, { useState, useEffect, useRef } from 'react';
import ChartDisplay from '../components/ChartDisplay';
import ControlPanel from '../components/ControlPanel';
import AlertLog from '../components/AlertLog';
import { checkAlert } from '../utils/alertEngine';
import config from '../config';
import './RealTimePage.css';

const RealTimePage = () => {
    const [data, setData] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [settings, setSettings] = useState({
        threshold: 55,
        timeWindow: 20, // minutes
        direction: 'BOTH',
        telegramEnabled: false,
        telegramToken: '',
        telegramChatId: ''
    });
    const [lastNotifyTime, setLastNotifyTime] = useState(0);
    const [lastNotifyType, setLastNotifyType] = useState(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Default open for Alert Log
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connected, error
    const [marketStats, setMarketStats] = useState({
        currentPrice: 0,
        openPrice: 0,
        change: 0,
        changePercent: 0,
        updateTime: null
    });
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

    // 判斷交易時段
    const getTradingSession = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 100 + minutes;

        // 日盤: 09:00 ~ 13:45
        if (time >= 900 && time <= 1345) {
            const start = new Date(now);
            start.setHours(9, 0, 0, 0);
            return { type: 'Day', start, isNight: false };
        }

        // 夜盤: 15:00 ~ 05:00 (跨日)
        // 如果是 15:00 ~ 23:59
        if (time >= 1500) {
            const start = new Date(now);
            start.setHours(15, 0, 0, 0);
            return { type: 'Night', start, isNight: true };
        }

        // 如果是 00:00 ~ 05:00
        if (time <= 500) {
            const start = new Date(now);
            start.setDate(start.getDate() - 1); // 前一天的 15:00
            start.setHours(15, 0, 0, 0);
            return { type: 'Night', start, isNight: true };
        }

        // 非交易時間 (顯示模擬資料或其他處理，這裡暫時以當日 00:00 開始或保持最後狀態)
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { type: 'Closed', start, isNight: false };
    };

    // 載入歷史資料（首次載入時）
    const loadHistoryData = async () => {
        try {
            const session = getTradingSession();
            const dateStr = session.start.toISOString().split('T')[0];

            console.log(`[History] Loading history for ${session.type} session: ${dateStr}, isNight: ${session.isNight}`);

            const response = await fetch(
                `${config.API_BASE_URL}/api/history-data?date=${dateStr}&night=${session.isNight}`
            );
            const result = await response.json();

            if (result.data && result.data.length > 0) {
                console.log(`[History] Loaded ${result.data.length} historical data points`);
                // Ensure history data is sorted ascending and types are correct
                const sortedHistory = result.data
                    .map(d => ({
                        ...d,
                        timestamp: Number(d.timestamp),
                        close: Number(d.close)
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp);
                setData(sortedHistory);
                setIsHistoryLoaded(true);

                // 計算市場統計資訊
                const firstPoint = sortedHistory[0];
                const latestPoint = sortedHistory[sortedHistory.length - 1];
                const openPrice = firstPoint.close;
                const currentPrice = latestPoint.close;
                const change = currentPrice - openPrice;
                const changePercent = (change / openPrice) * 100;

                setMarketStats({
                    currentPrice,
                    openPrice,
                    change,
                    changePercent,
                    updateTime: latestPoint.timestamp
                });
            } else {
                console.log('[History] No historical data available');
                setIsHistoryLoaded(true);
            }
        } catch (error) {
            console.error("[History] Failed to load history:", error);
            setIsHistoryLoaded(true);
        }
    };

    // 首次載入歷史資料
    useEffect(() => {
        loadHistoryData();
    }, []);

    // Real-time data fetching
    useEffect(() => {
        const fetchRealtimeData = async () => {
            try {
                const response = await fetch(`${config.API_BASE_URL}/api/market-data`);
                const result = await response.json();

                if (result.status) {
                    setConnectionStatus(result.status.connected ? 'connected' : 'disconnected');
                }

                if (result.data && result.data.length > 0 && isHistoryLoaded) {
                    const session = getTradingSession();
                    const sessionStartTime = session.start.getTime();

                    setData(prevData => {
                        const lastTimestamp = prevData.length > 0 ? prevData[prevData.length - 1].timestamp : 0;

                        // Convert and filter new points
                        const newPoints = result.data
                            .map(d => ({
                                ...d,
                                timestamp: Number(d.timestamp),
                                close: Number(d.close)
                            }))
                            .filter(d => d.timestamp > lastTimestamp)
                            .filter(d => d.timestamp >= sessionStartTime); // Ensure data is within current session

                        if (newPoints.length === 0) return prevData;

                        // Merge and sort
                        const updatedData = [...prevData, ...newPoints].sort((a, b) => a.timestamp - b.timestamp);

                        // Update stats
                        const latestPoint = updatedData[updatedData.length - 1];
                        const openPrice = updatedData[0].close; // Use first point as open for now
                        const currentPrice = latestPoint.close;
                        const change = currentPrice - openPrice;
                        const changePercent = (change / openPrice) * 100;

                        setMarketStats({
                            currentPrice,
                            openPrice,
                            change,
                            changePercent,
                            updateTime: latestPoint.timestamp
                        });

                        // Check alerts on the newest point
                        const triggeredAlert = checkAlert(
                            updatedData,
                            latestPoint.close,
                            latestPoint.timestamp,
                            settings.threshold,
                            settings.timeWindow,
                            settings.direction
                        );

                        if (triggeredAlert) {
                            setAlerts(prevAlerts => {
                                const lastAlert = prevAlerts[prevAlerts.length - 1];
                                if (lastAlert && lastAlert.time === triggeredAlert.time && lastAlert.type === triggeredAlert.type) {
                                    return prevAlerts;
                                }

                                // Telegram Logic
                                if (settings.telegramEnabled && settings.telegramToken && settings.telegramChatId) {
                                    const now = Date.now();
                                    if (now - lastNotifyTime >= 600000 || triggeredAlert.type !== lastNotifyType) {
                                        const timeStr = new Date(triggeredAlert.time).toLocaleTimeString('zh-TW', { hour12: false });
                                        const typeStr = triggeredAlert.type === 'RISE' ? '急速上漲' : '急速下跌';
                                        const msg = `[警示] ${timeStr} ${typeStr} ${triggeredAlert.points} 點 (價格: ${triggeredAlert.toPrice})`;

                                        fetch(`${config.API_BASE_URL}/api/send-telegram`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                token: settings.telegramToken,
                                                chatId: settings.telegramChatId,
                                                message: msg
                                            })
                                        }).catch(err => console.error('Telegram Send Error:', err));

                                        setLastNotifyTime(now);
                                        setLastNotifyType(triggeredAlert.type);
                                    }
                                }
                                return [...prevAlerts, triggeredAlert];
                            });
                        }

                        return updatedData;
                    });
                }
            } catch (error) {
                console.error("Fetch error:", error);
                setConnectionStatus('error');
            }
        };

        const intervalId = setInterval(fetchRealtimeData, 1000);
        return () => clearInterval(intervalId);
    }, [isHistoryLoaded, settings, lastNotifyTime, lastNotifyType]);

    const getChangeColor = (val) => {
        if (val > 0) return 'price-up';
        if (val < 0) return 'price-down';
        return 'price-neutral';
    };

    const getChangeSymbol = (val) => {
        if (val > 0) return '▲';
        if (val < 0) return '▼';
        return '';
    };

    return (
        <div className="page-wrapper">
            <div className={`page-container with-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <header className="page-header-main">
                    <div className="market-summary">
                        <div className={`price-main ${getChangeColor(marketStats.change)}`}>{marketStats.currentPrice.toFixed(0)}</div>
                        <div className={`change-main ${getChangeColor(marketStats.change)}`}>
                            {getChangeSymbol(marketStats.change)} {Math.abs(marketStats.change).toFixed(0)} ({Math.abs(marketStats.changePercent).toFixed(2)}%)
                        </div>
                        <div className="time-main">
                            最後更新時間：{marketStats.updateTime ? new Date(marketStats.updateTime).toLocaleTimeString('zh-TW') : '--:--:--'}
                        </div>
                    </div>
                    <div className={`status-indicator ${connectionStatus === 'connected' ? 'active' : 'error'}`}>
                        <span className="status-dot"></span>
                        <span className="status-text">
                            {connectionStatus === 'connected' ? 'ON LINE' : 'OFFLINE'}
                        </span>
                    </div>
                </header>

                <ControlPanel
                    isReplayMode={false}
                    settings={settings}
                    onApplySettings={setSettings}
                />

                {/* 內容區域：根據載入狀態顯示 */}
                {!isHistoryLoaded ? (
                    <div className="loading-state" style={{
                        height: '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '1rem',
                        margin: '2rem 0'
                    }}>
                        資料讀取中...
                    </div>
                ) : (
                    <ChartDisplay
                        data={data}
                        settings={settings}
                        alerts={alerts}
                        openPrice={marketStats.openPrice}
                        sessionStartTime={getTradingSession().start.getTime()}
                    />
                )}
            </div>
            <AlertLog
                alerts={alerts}
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
        </div>
    );
};

export default RealTimePage;
