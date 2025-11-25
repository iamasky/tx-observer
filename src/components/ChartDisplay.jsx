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
    LabelList,
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

const ChartDisplay = ({ data, settings, alerts = [], openPrice = null }) => {
    const { thresholdLines, domain, rollingBasePrice, xDomain, yMin, yMax } = useMemo(() => {
        if (!data || data.length === 0 || !settings) {
            return { thresholdLines: [], domain: ['auto', 'auto'], rollingBasePrice: null, xDomain: ['auto', 'auto'], yMin: 0, yMax: 0 };
        }
        const latestPoint = data[data.length - 1];
        const latestTime = latestPoint.timestamp;

        // 2. 計算目標基準時間 (最新時間 - 時間窗口)
        const timeWindowMinutes = settings.timeWindow || 60; // Default 60 if not set
        const targetTime = latestTime - (timeWindowMinutes * 60 * 1000);

        // 3. 在資料中尋找基準價格
        // 容許誤差 120 秒
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

        // Fallback: 如果找不到精確點，但資料長度已經接近 timeWindow (例如 > 90%)，則使用最舊的點
        if (!baselineData && data.length > 0) {
            const oldestPoint = data[0];
            const dataDuration = latestTime - oldestPoint.timestamp;
            const targetDuration = timeWindowMinutes * 60 * 1000;

            // 如果資料長度至少有目標窗口的 90%，就用最舊點當基準
            if (dataDuration >= targetDuration * 0.9) {
                baselineData = oldestPoint;
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
        // Include refPrice, openPrice and threshold lines in domain calculation
        let allValues = [...prices];
        if (refPrice !== null) {
            allValues.push(refPrice);
            lines.forEach(l => allValues.push(l.y));
        }
        if (openPrice !== null) {
            allValues.push(openPrice);
        }

        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const padding = (maxVal - minVal) * 0.1;
        const yMin = Math.floor(minVal - padding);
        const yMax = Math.ceil(maxVal + padding);

        // Calculate X-axis domain explicitly
        const xMin = data.length > 0 ? data[0].timestamp : 'auto';
        const xMax = data.length > 0 ? data[data.length - 1].timestamp : 'auto';

        return {
            thresholdLines: lines,
            domain: [yMin, yMax],
            xDomain: [xMin, xMax],
            rollingBasePrice: refPrice,
            yMin,
            yMax
        };
    }, [data, settings, openPrice]);

    // 計算漸層 offset - 只使用 openPrice 作為基準
    const gradientOffset = () => {
        // 只使用 openPrice，不使用 rollingBasePrice
        if (openPrice === null || openPrice === undefined || yMax <= yMin) {
            return 0.5; // 如果沒有開盤價，使用中間值
        }
        if (openPrice >= yMax) return 0;
        if (openPrice <= yMin) return 1;

        return (yMax - openPrice) / (yMax - yMin);
    };

    const off = gradientOffset();

    // 合併警示資訊到主數據中
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // 找出最高點和最低點的價格（使用 close）
        const allClosePrices = data.map(d => d.close);
        const maxPrice = Math.max(...allClosePrices);
        const minPrice = Math.min(...allClosePrices);

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

        // 合併警示資訊與最高/最低點標記
        return data.map(point => {
            const alert = alertMap.get(point.timestamp);
            const isHigh = point.close === maxPrice;
            const isLow = point.close === minPrice;

            return {
                ...point,
                isAlert: !!alert,
                alertType: alert?.type,
                alertPoints: alert?.points,
                alertPrice: alert?.toPrice,
                // 只在最高/最低點且沒有警示時顯示 High/Low 標記，避免重疊 (可選)
                isHighest: isHigh,
                isLowest: isLow,
                // 用於 Scatter 顯示的數值
                highLowValue: (isHigh || isLow) ? point.close : null,
                alertValue: !!alert ? point.close : null
            };
        });
    }, [data, alerts]);

    if (!data || data.length === 0) {
        return <div className="chart-placeholder">等待數據中...</div>;
    }

    return (
        <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ right: 60, left: 100, top: 20, bottom: 20 }}>
                    <defs>
                        <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
                            <stop offset={off} stopColor="#22c55e" stopOpacity={1} />
                        </linearGradient>
                    </defs>
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
                        orientation="right"
                    />
                    <Tooltip
                        shared={false}
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const point = payload[0].payload;
                                // 優先顯示警示資訊
                                if (point.isAlert) {
                                    return (
                                        <div className="custom-tooltip alert-tooltip">
                                            <p className="label">{new Date(label).toLocaleTimeString()}</p>
                                            <p className="intro" style={{ color: point.alertType === 'RISE' ? '#ef4444' : '#22c55e' }}>
                                                {`警示: ${point.alertPrice} (${point.alertType === 'RISE' ? '▲' : '▼'}${point.alertPoints})`}
                                            </p>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="custom-tooltip">
                                        <p className="label">{new Date(label).toLocaleTimeString()}</p>
                                        <p className="intro">
                                            {`價格: ${point.close.toFixed(0)}`}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />

                    {/* 主價格線 - 使用 splitColor 實現紅綠變色 */}
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="url(#splitColor)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6 }}
                        animationDuration={500}
                    />

                    {/* 開盤價參考線 (白色虛線) - 移到 Line 之後 */}
                    {openPrice && (
                        <ReferenceLine
                            y={Number(openPrice)}
                            stroke="#ffffff"
                            strokeDasharray="3 3"
                            strokeWidth={2}
                            isFront={true}
                            label={{ position: 'left', value: '基線', fill: '#ffffff', fontSize: 12 }}
                        />
                    )}

                    {/* 滾動基準價參考線 (藍色虛線 - 前XX分基準) - 移到 Line 之後 */}
                    {rollingBasePrice && (
                        <ReferenceLine
                            y={Number(rollingBasePrice)}
                            stroke="#3b82f6"
                            strokeDasharray="3 3"
                            strokeWidth={2}
                            isFront={true}
                            label={{
                                position: 'left',
                                value: `${settings.timeWindow || 60}分內的基準線`,
                                fill: '#3b82f6',
                                fontSize: 12
                            }}
                        />
                    )}

                    {/* 警示觸發線 */}
                    {thresholdLines.map((line, index) => (
                        <ReferenceLine
                            key={index}
                            y={line.y}
                            stroke={line.color}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            isFront={true}
                        >
                            <Label
                                content={<CustomLabel value={line.label} fill={line.color} fontSize={12} />}
                            />
                        </ReferenceLine>
                    ))}

                    {/* 最高/最低點標示 */}
                    <Scatter dataKey="highLowValue" fill="#fbbf24" shape="circle">
                        <LabelList
                            dataKey="close"
                            position="top"
                            offset={10}
                            formatter={(val) => val}
                            style={{ fill: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}
                        />
                    </Scatter>

                    {/* 警示點標示 */}
                    <Scatter dataKey="alertValue" shape="circle">
                        {
                            chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.alertType === 'RISE' ? '#ef4444' : '#22c55e'} />
                            ))
                        }
                    </Scatter>

                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ChartDisplay;
