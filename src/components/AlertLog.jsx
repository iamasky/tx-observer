// src/components/AlertLog.jsx
import React, { useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ChevronRight, ChevronLeft } from 'lucide-react';
import './AlertLog.css';

const AlertLog = ({ alerts, isCollapsed, onToggle }) => {
    const endRef = useRef(null);

    // Auto-scroll to bottom when new alerts arrive
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [alerts]);

    return (
        <div className={`alert-log-container ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="alert-log-header">
                {!isCollapsed && <h3>警示紀錄</h3>}
                {!isCollapsed && <span className="badge">{alerts.length}</span>}
                <button className="toggle-btn" onClick={onToggle} title={isCollapsed ? "展開" : "收合"}>
                    {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>
            </div>
            <div className="alert-list">
                {alerts.length === 0 ? (
                    <div className="empty-state">
                        {!isCollapsed && "尚無警示觸發"}
                    </div>
                ) : (
                    alerts.map((alert, index) => {
                        const isRise = alert.type === 'RISE';
                        return (
                            <div key={index} className={`alert-item ${isRise ? 'rise' : 'fall'}`} title={isCollapsed ? `${isRise ? '上漲' : '下跌'} ${alert.points.toFixed(0)}點 (${new Date(alert.time).toLocaleTimeString()})` : ''}>
                                <div className="alert-icon">
                                    {isRise ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
                                </div>
                                <div className="alert-content">
                                    <div className="alert-title">
                                        {isRise ? '行情上漲' : '行情下跌'}
                                        <span className="alert-time">
                                            {new Date(alert.time).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="alert-details">
                                        波動 <strong>{alert.points.toFixed(0)}</strong> 點
                                        <br />
                                        <span className="price-flow">
                                            <span className="time-tag">({new Date(alert.baselineTime).toLocaleTimeString()})</span>
                                            {alert.fromPrice.toFixed(0)}
                                            ➜
                                            <span className="time-tag">({new Date(alert.time).toLocaleTimeString()})</span>
                                            {alert.toPrice.toFixed(0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={endRef} />
            </div>
        </div>
    );
};

export default AlertLog;
