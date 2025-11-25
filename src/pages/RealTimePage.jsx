// src/pages/RealTimePage.jsx
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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connected, error
    const [marketStats, setMarketStats] = useState({
        currentPrice: 0,
        openPrice: 0,
        change: 0,
        changePercent: 0,
        updateTime: null
    });

    // 判斷交易時段
    const getTradingSession = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const time = hours * 100 + minutes;

        // 日盤: 09:00 ~ 13:45 (使用者指定)
        if (time >= 900 && time <= 1345) {
            const start = new Date(now);
            start.setHours(9, 0, 0, 0);
            return { type: 'Day', start };
        }

        // 夜盤: 15:00 ~ 05:00 (跨日)
        // 如果是 15:00 ~ 23:59
        if (time >= 1500) {
            const start = new Date(now);
            start.setHours(15, 0, 0, 0);
            return { type: 'Night', start };
        }

        // 如果是 00:00 ~ 05:00
        if (time <= 500) {
            const start = new Date(now);
            start.setDate(start.getDate() - 1); // 前一天的 15:00
            start.setHours(15, 0, 0, 0);
            return { type: 'Night', start };
        }

        // 非交易時間 (顯示模擬資料或其他處理，這裡暫時以當日 00:00 開始或保持最後狀態)
        // 為確保有資料顯示，預設回傳當日 00:00
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { type: 'Closed', start };
    };

    // Real-time data fetching
    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`${config.API_BASE_URL}/api/market-data`);
                const result = await response.json();

                if (result.status) {
                    setConnectionStatus(result.status.connected ? 'connected' : 'disconnected');
                }

                if (result.data && result.data.length > 0) {
                    const session = getTradingSession();
                    const sessionStartTime = session.start.getTime();

                    // 篩選出本時段的資料
                    // 注意：如果是在非交易時間，這裡可能會顯示所有資料或模擬資料
                    // 這裡假設 API 回傳的是持續的資料流，我們只取時段內的
                    let sessionData = result.data.filter(d => d.timestamp >= sessionStartTime);

                    // 如果篩選後沒資料 (例如剛開盤或非交易時段無新資料)，至少顯示最近的資料以避免空白
                    if (sessionData.length === 0 && result.data.length > 0) {
                        // Fallback: 顯示最近 1 小時
                        sessionData = result.data.slice(-3600);
                    }

                    setData(sessionData);

                    if (sessionData.length > 0) {
                        const firstPoint = sessionData[0];
                        const latestPoint = sessionData[sessionData.length - 1];
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

                        // Check alerts on the newest point
                        const triggeredAlert = checkAlert(
                            sessionData,
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
                    }
                }
            } catch (error) {
                console.error("Failed to fetch market data:", error);
                setConnectionStatus('error');
            }
        };

        // Poll every 1 second
        const interval = setInterval(fetchData, 1000);
        return () => clearInterval(interval);
    }, [settings, lastNotifyTime, lastNotifyType]);

    const getChangeColor = (val) => {
        if (val > 0) return 'text-red-500';
        if (val < 0) return 'text-green-500';
        return 'text-gray-500';
    };

    return (
        <div className="page-wrapper">
            <div className={`page-container with-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <header className="page-header">
                    <div className="header-left">
                        <h1>台指期即時盤勢</h1>
                        <div className="market-info">
                            <span className="current-price">{marketStats.currentPrice.toFixed(0)}</span>
                            <span className={`price-change ${getChangeColor(marketStats.change)}`}>
                                {marketStats.change > 0 ? '▲' : marketStats.change < 0 ? '▼' : ''} {Math.abs(marketStats.change).toFixed(0)} ({Math.abs(marketStats.changePercent).toFixed(2)}%)
                            </span>
                            <span className="update-time">
                                {marketStats.updateTime ? new Date(marketStats.updateTime).toLocaleTimeString('zh-TW') : '--:--:--'}
                            </span>
                        </div>
                    </div>
                    <div className="live-indicator">
                        <span className={`dot ${connectionStatus === 'connected' ? 'active' : 'error'}`}></span>
                        {connectionStatus === 'connected' ? '即時連線中' : connectionStatus === 'error' ? '連線錯誤' : '等待連線...'}
                    </div>
                </header>

                <ControlPanel
                    isReplayMode={false}
                    settings={settings}
                    onApplySettings={setSettings}
                />

                <ChartDisplay
                    data={data}
                    settings={settings}
                    alerts={alerts}
                    openPrice={marketStats.openPrice} // 傳遞 openPrice
                />
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
