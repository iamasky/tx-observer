// src/components/AlertModal.jsx
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './AlertModal.css';

const AlertModal = ({ alert, onClose }) => {
    if (!alert) return null;

    const isRise = alert.type === 'RISE';

    return (
        <div className="modal-overlay">
            <div className={`modal-content ${isRise ? 'rise' : 'fall'}`}>
                <button className="close-btn" onClick={onClose}>
                    <X size={24} />
                </button>
                <div className="modal-header">
                    <AlertTriangle size={48} />
                    <h2>{isRise ? '行情上漲警示！' : '行情下跌警示！'}</h2>
                </div>
                <div className="modal-body">
                    <p className="highlight">
                        區間波動 <strong>{alert.points.toFixed(0)}</strong> 點
                    </p>
                    <div className="details">
                        <p>比較基準: {alert.timeWindow ? `${alert.timeWindow} 分鐘前` : '開盤價'}</p>
                        <p>
                            基準價: {alert.fromPrice.toFixed(0)}
                            <span className="time-hint"> ({new Date(alert.baselineTime).toLocaleTimeString()})</span>
                        </p>
                        <p>
                            目前價: {alert.toPrice.toFixed(0)}
                            <span className="time-hint"> ({new Date(alert.time).toLocaleTimeString()})</span>
                        </p>
                        <p>觸發時間: {new Date(alert.time).toLocaleTimeString()}</p>
                    </div>
                    <div className="recommendation">
                        建議方向：{isRise ? '做多 (Long)' : '做空 (Short)'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
