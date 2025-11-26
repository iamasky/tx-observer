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

const ChartDisplay = ({ data, settings, alerts = [], openPrice = null, sessionStartTime = null }) => {
    const { thresholdLines, domain, rollingBasePrice, xDomain, xTicks, yMin, yMax } = useMemo(() => {
        if (!data || data.length === 0 || !settings) {
            return { thresholdLines: [], domain: ['auto', 'auto'], rollingBasePrice: null, xDomain: ['auto', 'auto'], xTicks: [], yMin: 0, yMax: 0 };
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
        // Use sessionStartTime if provided, otherwise fallback to data start
        const xMin = sessionStartTime ? sessionStartTime : (data.length > 0 ? data[0].timestamp : 'auto');
        const xMax = data.length > 0 ? data[data.length - 1].timestamp : 'auto';

        // Generate ticks every 60 minutes (1 hour)
        const xTicks = [];
        if (typeof xMin === 'number' && typeof xMax === 'number') {
            const interval = 60 * 60 * 1000; // 1 Hour

            // Start from the exact hour of xMin (or xMin itself if it's on the hour)
            // Actually, if xMin is 15:00, we want 15:00.
            // If xMin is 15:05, we probably still want 15:00 or 16:00?
            // User wants "Leftmost time is 3:00 PM", so we should include xMin.

            let tick = xMin;

            // Align to the next full hour if not already on full hour?
            // But user wants 15:00. 15:00 is a full hour.
            // Let's just start from xMin and increment by interval.
            // But to be safe for "hours unit", let's align to hour boundaries.

            // Align to nearest hour (floor)
            let currentTick = Math.floor(xMin / interval) * interval;
            if (currentTick < xMin) {
                // If floor is before xMin, we might want to include it if xMin is close, 
                // or just start from xMin. 
                // But for clean axis, let's start from the aligned hour <= xMin.
                // Wait, if xMin is 15:00, currentTick is 15:00.
                // If xMin is 15:00, we want 15:00.
            }

            // Simply: Start from xMin (which should be 15:00 for night session)
            // And add 1 hour steps.

            // Re-evaluating: If we want nice "15:00, 16:00" ticks, we should align to hours.
            // If sessionStartTime is passed as 15:00:00, it is aligned.

            currentTick = Math.ceil(xMin / interval) * interval;
            // If xMin is exactly 15:00, ceil is 15:00.

            // Ensure we cover the range
            // If we want the first tick to be exactly xMin (15:00), we push it first.
            if (xMin % interval === 0) {
                currentTick = xMin;
            } else {
                // If xMin is not on hour, find next hour? 
                // Or maybe we want previous hour?
                // Let's stick to "on the hour" ticks.
            }

            // Let's just generate hourly ticks covering [xMin, xMax]
            // Start from the hour of xMin
            let startHour = Math.floor(xMin / interval) * interval;

            for (let t = startHour; t <= xMax; t += interval) {
                if (t >= xMin) {
                    xTicks.push(t);
                } else if (t === startHour && Math.abs(t - xMin) < 60000) {
                    // If it's very close to xMin, include it (e.g. 15:00:01)
                    xTicks.push(t);
                }
            }

            // Force include xMin if it's not in ticks (e.g. if it's 15:30 and we want start)
            // But user said "Leftmost is 3:00 PM". So xMin IS 15:00.
            if (xTicks.length > 0 && xTicks[0] > xMin) {
                xTicks.unshift(xMin);
            }
            if (xTicks.length === 0 && xMin <= xMax) {
                xTicks.push(xMin);
            }
        }

        return {
            thresholdLines: lines,
            domain: [yMin, yMax],
            xDomain: [xMin, xMax],
            xTicks, // Return ticks
            rollingBasePrice: refPrice,
            yMin,
            yMax
        };
    }, [data, settings, openPrice, sessionStartTime]);

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
        return data.map((point, index) => {
            const alert = alertMap.get(point.timestamp);
            const isHigh = point.close === maxPrice;
            const isLow = point.close === minPrice;
            const isCurrent = index === data.length - 1;

            return {
                ...point,
                isAlert: !!alert,
                alertType: alert?.type,
                alertPoints: alert?.points,
                alertPrice: alert?.toPrice,
                // 只在最高/最低點且沒有警示時顯示 High/Low 標記，避免重疊 (可選)
                isHighest: isHigh,
                isLowest: isLow,
                isCurrent: isCurrent,
                // 用於 Scatter 顯示的數值
                highLowValue: (isHigh || isLow) ? point.close : null,
                currentValue: isCurrent ? point.close : null,
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
                        ticks={xTicks} // Use fixed ticks
                        tickFormatter={(time) => new Date(time).getHours()}
                        stroke="#94a3b8"
                        interval={0} // Force show all ticks provided
                        allowDataOverflow={false}
                        angle={0} // Reset angle as requested numbers are short
                        textAnchor="middle"
                        height={30}
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
                        isAnimationActive={false}
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
                    <Scatter dataKey="highLowValue" fill="#fbbf24" shape="circle" isAnimationActive={false}>
                        <LabelList
                            dataKey="close"
                            position="top"
                            offset={10}
                            formatter={(val, entry) => {
                                if (!entry) return val;
                                const item = entry.payload || entry;
                                if (!item) return val;
                                if (item.isHighest) return `High: ${val}`;
                                if (item.isLowest) return `Low: ${val}`;
                                return val;
                            }}
                            style={{ fill: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}
                        />
                    </Scatter>

                    {/* 當前價格標示 - 僅顯示點，不顯示文字以免遮擋 */}
                    <Scatter dataKey="currentValue" fill="#ffffff" shape="circle" isAnimationActive={false} />

                    {/* 警示點標示 */}
                    <Scatter dataKey="alertValue" shape="circle" isAnimationActive={false}>
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
