// src/components/ControlPanel.jsx
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Settings, Check, ArrowUp, ArrowDown, ArrowUpDown, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import config from '../config';
import './ControlPanel.css';

const ControlPanel = ({
    isReplayMode,
    isPlaying,
    onPlayPause,
    onReset,
    settings,
    onApplySettings,
    currentDate,
    onDateChange,
    isNightSession,
    onSessionChange,
    playbackSpeed,
    onPlaybackSpeedChange
}) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [localSpeed, setLocalSpeed] = useState(playbackSpeed || { value: 5, unit: 'SECONDS' });
    const [isTesting, setIsTesting] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Sync local settings if props change
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    // Sync local speed if props change
    useEffect(() => {
        if (playbackSpeed) {
            setLocalSpeed(playbackSpeed);
        }
    }, [playbackSpeed]);

    const handleApply = () => {
        onApplySettings(localSettings);
    };

    const handleSpeedChange = (key, value) => {
        const newSpeed = { ...localSpeed, [key]: value };
        setLocalSpeed(newSpeed);
        if (onPlaybackSpeedChange) {
            onPlaybackSpeedChange(newSpeed);
        }
    };

    const handleTestTelegram = async () => {
        if (!localSettings.telegramToken || !localSettings.telegramChatId) {
            alert('請先輸入 Bot Token 和 Chat ID');
            return;
        }

        setIsTesting(true);
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/send-telegram`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: localSettings.telegramToken,
                    chatId: localSettings.telegramChatId,
                    message: '這是來自於「台指期指數觀測平台(BOY)」的測試訊息。'
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert('測試訊息發送成功！請檢查您的 Telegram。');
            } else {
                alert(`發送失敗：${data.error || '未知錯誤'}`);
            }
        } catch (error) {
            console.error('Test Telegram Error:', error);
            alert('無法連接到後端伺服器。請確認您已執行 `python server/app.py`。');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className={`control-panel ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="panel-toggle-container">
                <button
                    className="panel-toggle-btn"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? "展開面板" : "收起面板"}
                >
                    {isCollapsed ? (
                        <>
                            <Settings size={16} />
                            <span>展開設定面板</span>
                            <ChevronDown size={16} />
                        </>
                    ) : (
                        <>
                            <ChevronUp size={16} />
                            <span>收起面板</span>
                        </>
                    )}
                </button>
            </div>

            {!isCollapsed && (
                <>
                    <div className="panel-section settings-section">
                        <div className="section-header">
                            <Settings size={16} />
                            <span>警示設定</span>
                        </div>

                        <div className="input-group">
                            <label>監控方向</label>
                            <div className="direction-toggle">
                                <button
                                    className={localSettings.direction === 'RISE' ? 'active rise' : ''}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, direction: 'RISE' }))}
                                    title="只監控上漲"
                                >
                                    <ArrowUp size={18} /> 上漲
                                </button>
                                <button
                                    className={localSettings.direction === 'FALL' ? 'active fall' : ''}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, direction: 'FALL' }))}
                                    title="只監控下跌"
                                >
                                    <ArrowDown size={18} /> 下跌
                                </button>
                                <button
                                    className={localSettings.direction === 'BOTH' ? 'active both' : ''}
                                    onClick={() => setLocalSettings(prev => ({ ...prev, direction: 'BOTH' }))}
                                    title="雙向監控"
                                >
                                    <ArrowUpDown size={18} /> 雙向
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>波動點數 (點)</label>
                            <input
                                type="number"
                                min="0"
                                value={localSettings.threshold}
                                onChange={(e) => setLocalSettings(prev => ({ ...prev, threshold: Math.max(0, parseInt(e.target.value) || 0) }))}
                                placeholder="輸入點數"
                            />
                        </div>

                        <div className="input-group">
                            <label>時間範圍 (分鐘)</label>
                            <input
                                type="number"
                                min="1"
                                value={localSettings.timeWindow}
                                onChange={(e) => setLocalSettings(prev => ({ ...prev, timeWindow: Math.max(1, parseInt(e.target.value) || 1) }))}
                            />
                        </div>

                        <div className="divider" style={{ margin: '1.5rem 0', borderTop: '1px solid var(--border)' }}></div>

                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={localSettings.telegramEnabled || false}
                                    onChange={(e) => setLocalSettings(prev => ({ ...prev, telegramEnabled: e.target.checked }))}
                                    style={{ width: 'auto' }}
                                />
                                啟用 Telegram 通知
                            </label>
                        </div>

                        {localSettings.telegramEnabled && (
                            <>
                                <div className="input-group">
                                    <label>Bot Token</label>
                                    <input
                                        type="text"
                                        value={localSettings.telegramToken || ''}
                                        onChange={(e) => setLocalSettings(prev => ({ ...prev, telegramToken: e.target.value }))}
                                        placeholder="123456789:ABCdef..."
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Chat ID</label>
                                    <input
                                        type="text"
                                        value={localSettings.telegramChatId || ''}
                                        onChange={(e) => setLocalSettings(prev => ({ ...prev, telegramChatId: e.target.value }))}
                                        placeholder="123456789"
                                    />
                                    <div className="hint-text" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        * 10分鐘內連續警示只會通知一次
                                    </div>
                                </div>

                                <button
                                    className="btn-secondary"
                                    style={{ width: '100%', marginTop: '0.5rem', marginBottom: '1rem' }}
                                    onClick={handleTestTelegram}
                                    disabled={isTesting}
                                >
                                    {isTesting ? '發送中...' : '測試發送'}
                                </button>
                            </>
                        )}

                        <button className="btn-primary apply-btn" onClick={handleApply} style={{ marginTop: '1rem' }}>
                            <Check size={16} />
                            設定生效
                        </button>
                    </div>

                    {isReplayMode && (
                        <div className="panel-section replay-controls">
                            <div className="section-header">
                                <span>回放控制</span>
                            </div>

                            <div className="date-controls">
                                <input
                                    type="date"
                                    value={currentDate}
                                    onChange={(e) => onDateChange(e.target.value)}
                                />
                                <div className="session-toggle">
                                    <button
                                        className={!isNightSession ? 'active' : ''}
                                        onClick={() => onSessionChange(false)}
                                    >
                                        日盤
                                    </button>
                                    <button
                                        className={isNightSession ? 'active' : ''}
                                        onClick={() => onSessionChange(true)}
                                    >
                                        夜盤
                                    </button>
                                </div>
                            </div>

                            <div className="speed-controls">
                                <div className="section-header small">
                                    <Clock size={14} />
                                    <span>播放速度</span>
                                </div>
                                <div className="speed-inputs">
                                    <input
                                        type="number"
                                        min="1"
                                        value={localSpeed.value}
                                        onChange={(e) => handleSpeedChange('value', Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                    <div className="unit-toggle">
                                        <button
                                            className={localSpeed.unit === 'SECONDS' ? 'active' : ''}
                                            onClick={() => handleSpeedChange('unit', 'SECONDS')}
                                        >
                                            秒
                                        </button>
                                        <button
                                            className={localSpeed.unit === 'MINUTES' ? 'active' : ''}
                                            onClick={() => handleSpeedChange('unit', 'MINUTES')}
                                        >
                                            分
                                        </button>
                                    </div>
                                </div>
                                <div className="speed-hint">
                                    每 5 秒播放 {localSpeed.value} {localSpeed.unit === 'SECONDS' ? '秒' : '分鐘'} 的走勢
                                </div>
                            </div>

                            <div className="playback-buttons">
                                <button className="btn-primary" onClick={onPlayPause}>
                                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                    {isPlaying ? '暫停' : '播放'}
                                </button>
                                <button className="btn-secondary" onClick={onReset}>
                                    <RotateCcw size={20} />
                                    重置
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )
            }
        </div >
    );
};

export default ControlPanel;
