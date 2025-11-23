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
                    setData(prev => {
                        // If we have no previous data, just use the new data
                        if (prev.length === 0) return result.data;

                        // Append new points that are newer than what we have
                        const lastTimestamp = prev[prev.length - 1].timestamp;
                        const newPoints = result.data.filter(p => p.timestamp > lastTimestamp);

                        if (newPoints.length === 0) return prev;

                        const newData = [...prev, ...newPoints].slice(-3600); // Keep last 3600 (1 hour)

                        // Check alerts on the newest point
                        const latestPoint = newData[newData.length - 1];
                        const triggeredAlert = checkAlert(
                            newData,
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
                                    // Notify if:
                                    // 1. It's been more than 10 minutes since last notification
                                    // 2. OR the alert type (RISE/FALL) has changed (Reversal)
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

                        return newData;
                    });
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

    return (
        <div className="page-wrapper">
            <div className={`page-container with-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <header className="page-header">
                    <div>
                        <h1>台指期即時盤勢</h1>
                        <p className="date-display">
                            {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                        </p>
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

                <ChartDisplay data={data} settings={settings} alerts={alerts} />
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
