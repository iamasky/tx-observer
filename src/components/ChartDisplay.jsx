// src/components/ChartDisplay.jsx
import React, { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Label,
    Scatter,
    Cell
} from 'recharts';
import './ChartDisplay.css';

const CustomLabel = (props) => {
    const { viewBox, value, fill, fontSize } = props;
    const { x, y } = viewBox;

    // Split value into lines if it contains a newline character or if we want to force split
    // Value format expected: "Text\\nNumber"
    const lines = value.split('\\n');

    return (
        <text x={x} y={y} fill={fill} fontSize={fontSize} textAnchor="start" dy={-10} dx={10}>
            {lines.map((line, index) => (
                <tspan x={x + 5} dy={index === 0 ? 0 : 14} key={index}>
                    {line}
                </tspan>
            ))}
        </text>
    );
};

const ChartDisplay = ({ data, settings, alerts = [] }) => {
    const { thresholdLines, domain, referencePrice, xDomain } = useMemo(() => {
        if (!data || data.length === 0 || !settings) {
            return { thresholdLines: [], domain: ['auto', 'auto'], referencePrice: null };
        }

        // 1. 找出最新的時間點
        const latestPoint = data[data.length - 1];
        const latestTime = latestPoint.timestamp;

        // 2. 計算目標基準時間 (最新時間 - 時間窗口)
        const timeWindowMinutes = settings.timeWindow || 60; // Default 60 if not set
        const targetTime = latestTime - (timeWindowMinutes * 60 * 1000);

        // 3. 在資料中尋找基準價格
        // 容許誤差 120 秒 (已放寬)
        const timeTolerance = 120 * 1000;
        let baselineData = null;

        // 從後往前找
        for (let i = data.length - 1; i >= 0; i--) {
            const point = data[i];
            if (point.timestamp <= targetTime) {
                if (targetTime - point.timestamp <= timeTolerance) {
                    baselineData = point;
                }
                break;
            }
        }

        // 如果找不到基準點 (例如資料不足)，則不顯示參考線
        const refPrice = baselineData ? baselineData.close : null;

        const lines = [];
        const { direction, threshold } = settings;

        if (refPrice !== null) {
            // 計算警示觸發價格（基於滾動基準價）
            // 上漲警示
            if (direction === 'RISE' || direction === 'BOTH') {
                lines.push({
                    y: refPrice + threshold,
                    label: `上漲觸發\\n${Math.round(refPrice + threshold)}`,
                    color: '#ef4444' // Red
                });
            }

            // 下跌警示
            if (direction === 'FALL' || direction === 'BOTH') {
                lines.push({
                    y: refPrice - threshold,
                    label: `下跌觸發\\n${Math.round(refPrice - threshold)}`,
                    color: '#22c55e' // Green
                });
            }
        }

        // Calculate Y-axis domain
        const prices = data.map(d => d.close);
        // Include refPrice and threshold lines in domain calculation
        let allValues = [...prices];
        if (refPrice !== null) {
            allValues.push(refPrice);
            lines.forEach(l => allValues.push(l.y));
        }

        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const padding = (maxVal - minVal) * 0.1;

        // Calculate X-axis domain explicitly
        const xMin = data.length > 0 ? data[0].timestamp : 'auto';
        const xMax = data.length > 0 ? data[data.length - 1].timestamp : 'auto';

        return {
            thresholdLines: lines,
            domain: [Math.floor(minVal - padding), Math.ceil(maxVal + padding)],
            xDomain: [xMin, xMax],
            referencePrice: refPrice
        };
    }, [data, settings]);

    // 合併警示資訊到主數據中
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // 創建警示點的 Map 以便快速查找
        const alertMap = new Map();
        if (alerts && alerts.length > 0) {
            alerts.forEach(alert => {
                alertMap.set(alert.time, {
                    type: alert.type,
                    points: alert.points,
                    toPrice: alert.toPrice
                });
            });
        }

        // 將警示資訊合併到數據中
        return data.map(point => {
            const alert = alertMap.get(point.timestamp);
            return {
                ...point,
                isAlert: !!alert,
                alertType: alert?.type,
                alertPoints: alert?.points,
                alertPrice: alert?.toPrice
            };
        });
    }, [data, alerts]);

    if (!data || data.length === 0) {
        return <div className="chart-placeholder">等待數據中...</div>;
    }

    return (
        <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ right: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={xDomain}
                        tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#94a3b8"
                        minTickGap={50}
                        allowDataOverflow={false}
                    />
                    <YAxis
                        domain={domain}
                        stroke="#94a3b8"
                        tickFormatter={(value) => value.toFixed(0)}
                    />
                    <Tooltip
                        shared={false}
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const point = payload[0].payload;

                                // 如果是警示點，顯示警示資訊
                                if (point.isAlert) {
                                    return (
                                        <div className="custom-tooltip" style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', padding: '10px', border: '1px solid', borderRadius: '4px' }}>
                                            <p className="label">{new Date(label).toLocaleTimeString()}</p>
                                            <p className="intro" style={{ color: point.alertType === 'RISE' ? '#ef4444' : '#22c55e' }}>
                                                {`警示點位: ${point.alertPrice} (波動 ${point.alertPoints}點)`}
                                            </p>
                                        </div>
                                    );
                                }

                                // 否則顯示價格資訊
                                return (
                                    <div className="custom-tooltip" style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', padding: '10px', border: '1px solid', borderRadius: '4px' }}>
                                        <p className="label">{new Date(label).toLocaleTimeString()}</p>
                                        <p className="intro" style={{ color: '#f1f5f9' }}>
                                            {`價格: ${point.close.toFixed(0)}`}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={(props) => {
                            const { cx, cy, payload } = props;
                            // 只在警示點顯示圓點
                            if (payload.isAlert) {
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={5}
                                        fill={payload.alertType === 'RISE' ? '#ef4444' : '#22c55e'}
                                        stroke="none"
                                    />
                                );
                            }
                            return null;
                        }}
                        animationDuration={300}
                        isAnimationActive={false}
                    />

                    {/* 基準參考線 (藍色) */}
                    {referencePrice !== null && (
                        <ReferenceLine
                            y={referencePrice}
                            stroke="#3b82f6"
                            strokeDasharray="3 3"
                            strokeWidth={1.5}
                        >
                            <Label
                                content={<CustomLabel value={`基準(${settings.timeWindow}分前)\\n${Math.round(referencePrice)}`} fill="#3b82f6" fontSize={12} />}
                            />
                        </ReferenceLine>
                    )}

                    {/* 警示觸發線 */}
                    {thresholdLines.map((line, index) => (
                        <ReferenceLine
                            key={index}
                            y={line.y}
                            stroke={line.color}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                        >
                            <Label
                                content={<CustomLabel value={line.label} fill={line.color} fontSize={12} />}
                            />
                        </ReferenceLine>
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ChartDisplay;
