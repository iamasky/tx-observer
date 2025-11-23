// src/pages/ReplayPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChartDisplay from '../components/ChartDisplay';
import ControlPanel from '../components/ControlPanel';
import AlertLog from '../components/AlertLog';
import { generateMarketData } from '../utils/marketGenerator';
import { checkAlert } from '../utils/alertEngine';
import config from '../config';

const ReplayPage = () => {
    const [fullData, setFullData] = useState([]);
    const [displayedData, setDisplayedData] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [alerts, setAlerts] = useState([]);

    // Helper to get yesterday's date (Local Time)
    const getLastTradingDay = () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        // Format as YYYY-MM-DD using local time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [currentDate, setCurrentDate] = useState(getLastTradingDay());
    const [isNightSession, setIsNightSession] = useState(false);

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

    const [playbackSpeed, setPlaybackSpeed] = useState({
        value: 10,
        unit: 'MINUTES'
    });

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // ... (rest of the code)

    // Inside checkAlert logic (need to find where it is called)
    // It's inside useEffect for playback

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const timerRef = useRef(null);

    // Load data when date/session changes
    useEffect(() => {
        const fetchHistory = async () => {
            setIsPlaying(false);
            setAlerts([]);
            setIsLoading(true);
            setError(null);
            setFullData([]);
            setDisplayedData([]);

            try {
                // Fetch from backend
                const response = await fetch(`${config.API_BASE_URL}/api/history-data?date=${currentDate}&night=${isNightSession}`);
                const result = await response.json();

                if (result.data && result.data.length > 0) {
                    setFullData(result.data);
                    setDisplayedData([result.data[0]]);
                    setCurrentIndex(0);
                } else {
                    setError('該日期無交易資料或無法取得資料');
                }
            } catch (error) {
                console.error('Failed to fetch history:', error);
                setError('無法連接伺服器，請確認後端是否已啟動');
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [currentDate, isNightSession]);

    // Playback logic
    useEffect(() => {
        if (isPlaying && fullData.length > 0) {
            // Fixed update interval: 5 seconds
            const updateInterval = 5000;

            timerRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    if (prev >= fullData.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }

                    // Calculate step size based on user settings
                    // Data resolution is 10 seconds (assuming, but real data might differ)
                    // We should calculate time difference ideally, but for now simple index step
                    const dataResolutionSeconds = 60; // K-bars are 1 minute usually

                    const userStepSeconds = playbackSpeed.unit === 'MINUTES'
                        ? playbackSpeed.value * 60
                        : playbackSpeed.value;

                    const stepPoints = Math.max(1, Math.floor(userStepSeconds / dataResolutionSeconds));

                    const nextIndex = Math.min(prev + stepPoints, fullData.length - 1);
                    const nextPoint = fullData[nextIndex];

                    // Update displayed data
                    setDisplayedData(prevData => {
                        // Append the new history chunk
                        const newChunk = fullData.slice(prev + 1, nextIndex + 1);
                        return [...prevData, ...newChunk];
                    });

                    // Check alerts for the new chunk
                    const currentHistory = fullData.slice(0, nextIndex + 1);

                    // Check alert on the latest point
                    const triggeredAlert = checkAlert(
                        currentHistory,
                        nextPoint.close,
                        nextPoint.timestamp,
                        settings.threshold,
                        settings.timeWindow,
                        settings.direction
                    );

                    if (triggeredAlert) {
                        setAlerts(prev => {
                            const lastAlert = prev[prev.length - 1];
                            if (lastAlert && lastAlert.time === triggeredAlert.time && lastAlert.type === triggeredAlert.type) {
                                return prev;
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
                                    const msg = `[回放警示] ${timeStr} ${typeStr} ${triggeredAlert.points} 點 (價格: ${triggeredAlert.toPrice})`;

                                    // Call Backend API
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

                            return [...prev, triggeredAlert];
                        });
                    }

                    return nextIndex;
                });
            }, updateInterval);
        } else {
            clearInterval(timerRef.current);
        }

        return () => clearInterval(timerRef.current);
    }, [isPlaying, fullData, settings, playbackSpeed, lastNotifyTime]);

    const handleReset = () => {
        setIsPlaying(false);
        setCurrentIndex(0);
        if (fullData.length > 0) {
            setDisplayedData([fullData[0]]);
        }
        setAlerts([]);
    };


    return (
        <div className="page-wrapper">
            <div className={`page-container with-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <header className="page-header">
                    <h1>歷史盤勢回放</h1>
                    <div className="status-indicator">
                        {isLoading ? '資料讀取中...' :
                            error ? '連線錯誤' :
                                isPlaying ? '播放中...' : '已暫停'}
                    </div>
                </header>

                <ControlPanel
                    isReplayMode={true}
                    isPlaying={isPlaying}
                    onPlayPause={() => setIsPlaying(!isPlaying)}
                    onReset={handleReset}
                    settings={settings}
                    onApplySettings={setSettings}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    isNightSession={isNightSession}
                    onSessionChange={setIsNightSession}
                    playbackSpeed={playbackSpeed}
                    onPlaybackSpeedChange={setPlaybackSpeed}
                />

                {isLoading ? (
                    <div className="loading-state" style={{
                        height: '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        border: '1px dashed var(--border)',
                        borderRadius: '1rem'
                    }}>
                        資料讀取中...
                    </div>
                ) : error ? (
                    <div className="error-state" style={{
                        height: '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        border: '1px dashed var(--border)',
                        borderRadius: '1rem',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div>{error}</div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>請確認後端伺服器已啟動，且該日期有交易資料</div>
                    </div>
                ) : (
                    <ChartDisplay
                        data={displayedData}
                        settings={settings}
                        alerts={alerts}
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

export default ReplayPage;
