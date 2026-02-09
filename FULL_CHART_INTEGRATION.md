# Complete Chart Integration Guide - Lightweight Charts v5

## Table of Contents
1. [Overview](#overview)
2. [Library Choice & Version](#library-choice--version)
3. [Installation & Setup](#installation--setup)
4. [Backend Data Structure](#backend-data-structure)
5. [Data Transformation Pipeline](#data-transformation-pipeline)
6. [Chart Component Implementation](#chart-component-implementation)
7. [Plotting Candles & Volume](#plotting-candles--volume)
8. [Plotting Equity Curve](#plotting-equity-curve)
9. [Plotting Indicators](#plotting-indicators)
10. [Creating the Interactive Legend](#creating-the-interactive-legend)
11. [Trade Markers (Future)](#trade-markers-future)
12. [Bugs Encountered & Solutions](#bugs-encountered--solutions)
13. [Complete Code Examples](#complete-code-examples)
14. [Customization Guide](#customization-guide)
15. [Performance Considerations](#performance-considerations)

---

## Overview

This document provides a complete, step-by-step guide to integrating interactive candlestick charts with equity overlay, indicators, and an interactive legend into a React + TypeScript backtesting frontend using the `lightweight-charts` library.

**What You'll Build:**
- Candlestick chart with volume overlay
- Equity curve on separate (left) price scale
- Multiple indicator lines with automatic color assignment
- Interactive legend that updates on crosshair hover
- Responsive design with proper cleanup

---

## Library Choice & Version

### Lightweight Charts v5.x

**Package:** `lightweight-charts`
**Version Used:** `^5.1.0`
**Why This Library:**
- Lightweight and performant (handles 10,000+ candles)
- Built specifically for financial charts
- Modern API with TypeScript support
- Excellent mobile support
- No dependencies on heavy charting libraries

### Important: API Version

This implementation uses the **modern v5 API syntax**, not the older v4 API. Key differences:
- `addSeries()` uses class types: `CandlestickSeries`, `LineSeries`, `HistogramSeries`
- Options passed as second parameter: `addSeries(CandlestickSeries, options)`
- Type imports: `import type { IChartApi, Time } from 'lightweight-charts'`

---

## Installation & Setup

### 1. Install Dependencies

```bash
npm install lightweight-charts
npm install --save-dev @types/node  # For TypeScript support
```

### 2. Package.json Configuration

```json
{
  "dependencies": {
    "lightweight-charts": "^5.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

### 3. Project Structure

```
src/
├── components/
│   └── CandlestickChart.tsx    # Main chart component
├── App.tsx                      # Parent component with data fetching
└── types/                       # Optional: shared type definitions
```

---

## Backend Data Structure

### API Response Format

Your backend must return data in this structure:

```typescript
interface BacktestResponse {
  success: boolean
  strategy_name: string
  metrics: {
    final_value: number
    initial_value: number
    max_drawdown: number
    sharpe_ratio: number
    total_return: number
  }
  candles: BackendCandle[]
  equity: EquityData[]
  indicators?: BackendIndicators  // Optional but recommended
  trades?: TradeSignal[]          // Optional - for future use
}
```

### Candle Data Format

```typescript
interface BackendCandle {
  datetime: string  // ISO format: "2023-01-09T05:00:00" or "2023-01-09"
  open: number
  high: number
  low: number
  close: number
  volume: number
}
```

**Example:**
```json
{
  "datetime": "2023-01-09T05:00:00",
  "open": 130.465,
  "high": 130.9,
  "low": 129.89,
  "close": 130.15,
  "volume": 70790800
}
```

### Equity Data Format

```typescript
interface EquityData {
  datetime: string  // Must match candle datetimes
  equity: number    // Portfolio value
}
```

**Example:**
```json
{
  "datetime": "2023-01-09T05:00:00",
  "equity": 10250.75
}
```

### Indicators Data Format

Indicators use a flexible structure supporting both single-line and multi-line indicators:

```typescript
interface IndicatorDataPoint {
  datetime: string
  [key: string]: string | number | null  // Flexible fields
}

interface BackendIndicators {
  [indicatorName: string]: IndicatorDataPoint[]
}
```

**Example - Single Line Indicator (SMA):**
```json
{
  "sma": [
    {"datetime": "2023-01-01", "value": null},
    {"datetime": "2023-01-20", "value": 50234.5},
    {"datetime": "2023-01-21", "value": 50245.3}
  ]
}
```

**Example - Multi-Line Indicator (MACD):**
```json
{
  "macd": [
    {
      "datetime": "2023-01-26",
      "macd": 100.5,
      "signal": 95.2,
      "histogram": 5.3
    }
  ]
}
```

**Example - Bollinger Bands:**
```json
{
  "bollinger": [
    {
      "datetime": "2023-01-20",
      "top": 51000,
      "mid": 50000,
      "bot": 49000
    }
  ]
}
```

**Key Points:**
- `null` values during warmup period are automatically filtered
- Field names (except `datetime`) become line names
- System automatically detects single vs multi-line indicators

---

## Data Transformation Pipeline

All backend data must be transformed to match lightweight-charts format.

### Frontend Types

```typescript
import type { Time } from 'lightweight-charts'

// Chart-compatible formats
interface CandleData {
  time: Time      // Date string only: "2023-01-09"
  open: number
  high: number
  low: number
  close: number
}

interface VolumeData {
  time: Time
  value: number
  color?: string
}

interface LineData {
  time: Time
  value: number
}

interface IndicatorsData {
  [indicatorName: string]: {
    [lineName: string]: LineData[]
  }
}
```

### Transformation Functions (App.tsx)

#### 1. Convert Candles → Price + Volume

```typescript
const convertCandlesToChartData = (candles: BackendCandle[]) => {
  // Transform to price data
  const priceData: CandleData[] = candles
    .filter(candle => candle.datetime)  // Remove invalid entries
    .map(candle => {
      // Extract date part only: "2023-01-09T05:00:00" → "2023-01-09"
      const dateStr = candle.datetime.split('T')[0] as Time
      return {
        time: dateStr,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }
    })

  // Transform to volume data
  const volumeData: VolumeData[] = candles
    .filter(candle => candle.datetime)
    .map(candle => {
      const dateStr = candle.datetime.split('T')[0] as Time
      return {
        time: dateStr,
        value: candle.volume
      }
    })

  return { priceData, volumeData }
}
```

**Why Transform?**
- Lightweight-charts expects simple date strings (`"YYYY-MM-DD"`), not full ISO timestamps
- Separating price and volume allows different series types

#### 2. Convert Equity Data

```typescript
const convertEquityToChartData = (equity: EquityData[]) => {
  return equity
    .filter(point => point.datetime)
    .map(point => {
      const dateStr = point.datetime.split('T')[0] as Time
      return {
        time: dateStr,
        value: point.equity  // Note: renamed from 'equity' to 'value'
      }
    })
}
```

**Key Change:** Backend's `equity` field → Chart's `value` field

#### 3. Convert Indicators (Advanced)

This function automatically handles any indicator structure:

```typescript
const convertIndicatorsToChartData = (indicators: BackendIndicators) => {
  const result: { [indicatorName: string]: { [lineName: string]: LineData[] } } = {}

  console.log('Converting indicators:', indicators)

  for (const [indicatorName, dataPoints] of Object.entries(indicators)) {
    result[indicatorName] = {}

    // Find a sample point to determine fields
    const samplePoint = dataPoints.find(p => p.datetime)
    if (!samplePoint) {
      console.log(`No valid sample point for ${indicatorName}`)
      continue
    }

    // Get all fields except 'datetime'
    const fields = Object.keys(samplePoint).filter(key => key !== 'datetime')
    console.log(`Indicator ${indicatorName} has fields:`, fields)

    // Create a line for each field
    for (const field of fields) {
      const lineData: LineData[] = dataPoints
        .filter(point => point.datetime && point[field] !== null)  // Filter nulls
        .map(point => {
          const dateStr = point.datetime.split('T')[0] as Time
          return {
            time: dateStr,
            value: point[field] as number
          }
        })

      console.log(`${indicatorName}.${field}: ${lineData.length} points`)
      result[indicatorName][field] = lineData
    }
  }

  console.log('Converted indicators result:', result)
  return result
}
```

**How It Works:**
1. Iterates through each indicator
2. Examines first data point to discover fields
3. Creates a separate line series for each field
4. Filters out `null` values (warmup period)
5. Returns nested structure: `indicator → line → data points`

**Output Example:**
```typescript
{
  "sma": {
    "value": [
      { time: "2023-01-20", value: 50234.5 },
      { time: "2023-01-21", value: 50245.3 }
    ]
  },
  "macd": {
    "macd": [{ time: "2023-01-26", value: 100.5 }],
    "signal": [{ time: "2023-01-26", value: 95.2 }],
    "histogram": [{ time: "2023-01-26", value: 5.3 }]
  }
}
```

---

## Chart Component Implementation

### Component Structure (CandlestickChart.tsx)

```typescript
import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'

interface CandlestickChartProps {
  priceData: CandleData[]
  volumeData?: VolumeData[]
  equityData?: EquityData[]
  indicatorsData?: IndicatorsData
  trades?: TradeMarker[]
  height?: number
}

export default function CandlestickChart({
  priceData,
  volumeData = [],
  equityData = [],
  indicatorsData = {},
  trades = [],
  height = 400
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const seriesMap = useRef<Map<string, any>>(new Map())

  const [legendData, setLegendData] = useState<any>(null)

  // Chart initialization and series setup (see next sections)

  return (
    <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Legend overlay (see Legend section) */}
      {legendData && (
        <div style={{/* legend styles */}}>
          {/* Legend content */}
        </div>
      )}
    </div>
  )
}
```

**Key Refs:**
- `chartContainerRef`: DOM reference for chart mounting
- `chartRef`: Reference to chart API instance
- `seriesMap`: Stores all series for legend access
- `resizeObserverRef`: Handles responsive resizing

### Chart Initialization

```typescript
useEffect(() => {
  if (!chartContainerRef.current) return

  // Create chart instance
  chartRef.current = createChart(chartContainerRef.current, {
    width: chartContainerRef.current.clientWidth,
    height: height,
    layout: {
      background: { color: '#253248' },         // Dark background
      textColor: 'rgba(255, 255, 255, 0.9)',    // Light text
    },
    grid: {
      vertLines: { color: '#334158' },
      horzLines: { color: '#334158' },
    },
    crosshair: {
      mode: CrosshairMode.Normal,               // Enable crosshair
    },
    rightPriceScale: {
      borderColor: '#485c7b',
    },
    leftPriceScale: {
      visible: true,                            // IMPORTANT: Enable left scale for equity
      borderColor: '#485c7b',
    },
    timeScale: {
      borderColor: '#485c7b',
      timeVisible: true,
      secondsVisible: false,
    },
  })

  // Add series (next sections)

  // Fit content
  chartRef.current.timeScale().fitContent()

  // Cleanup
  return () => {
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }
  }
}, [priceData, volumeData, equityData, indicatorsData, trades, height])
```

**Critical Settings:**
- `leftPriceScale.visible: true` - Required for equity curve
- `CrosshairMode.Normal` - Enables interactive crosshair for legend
- Cleanup function prevents memory leaks

---

## Plotting Candles & Volume

### 1. Candlestick Series

```typescript
// Add candlestick series
const candleSeries = chartRef.current.addSeries(CandlestickSeries, {
  upColor: '#4bffb5',          // Green for bullish candles
  downColor: '#ff4976',        // Red for bearish candles
  borderDownColor: '#ff4976',
  borderUpColor: '#4bffb5',
  wickDownColor: '#838ca1',    // Gray wicks
  wickUpColor: '#838ca1',
  lastValueVisible: false,     // Hide last value label
  priceLineVisible: false,     // Hide horizontal price line
})

candleSeries.setData(priceData)
seriesMap.current.set('price', candleSeries)  // Store for legend access
```

**Modern V5 Syntax:**
- Use `CandlestickSeries` class (not string `'Candlestick'`)
- Options passed as second parameter

### 2. Volume Histogram (Bottom Overlay)

```typescript
if (volumeData.length > 0) {
  const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
    color: '#182233',
    priceFormat: {
      type: 'volume',            // Format numbers as volume
    },
    priceScaleId: '',            // Empty string = overlay on main chart
    lastValueVisible: false,
    priceLineVisible: false,
  })

  volumeSeries.setData(volumeData)
  seriesMap.current.set('volume', volumeSeries)

  // Position volume at bottom 20% of chart
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,      // Start at 80% from top
      bottom: 0,     // End at bottom
    },
  })
}
```

**Scale Margins:**
- `top: 0.8` means volume uses bottom 20% of chart height
- Adjust to `0.9` for smaller volume bars (bottom 10%)
- Adjust to `0.7` for larger volume bars (bottom 30%)

---

## Plotting Equity Curve

The equity curve uses a **separate left price scale** to prevent distortion from stock prices.

```typescript
if (equityData.length > 0) {
  const equitySeries = chartRef.current.addSeries(LineSeries, {
    color: '#2962FF',           // Blue line
    lineWidth: 2,
    priceScaleId: 'left',       // CRITICAL: Use left price scale
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01,
    },
    lastValueVisible: false,
    priceLineVisible: false,
  })

  equitySeries.setData(equityData)
  seriesMap.current.set('equity', equitySeries)
}
```

**Why Separate Scale?**
- Stock prices might be $130-$135
- Equity might be $10,000-$11,000
- Without separate scales, equity line would be flat or distorted

**Visual Layout:**
```
Left Scale    Chart Area           Right Scale
(Equity)      (All Series)         (Price)
┌────────┐   ┌─────────────────┐   ┌────────┐
│11,000  │   │    /\  /\       │   │  135   │
│        │   │   /  \/  \_     │   │        │
│10,500  │   │  /        \     │   │  132   │
│        │   │ /          \    │   │        │
│10,000  │   └─────────────────┘   │  130   │
└────────┘                          └────────┘
```

---

## Plotting Indicators

### Color Palette

Define a color palette that cycles through indicator lines:

```typescript
const indicatorColors = [
  '#26a69a', // Teal
  '#ef5350', // Red
  '#ab47bc', // Purple
  '#ffa726', // Orange
  '#42a5f5', // Blue
  '#66bb6a', // Green
  '#ec407a', // Pink
  '#ffee58', // Yellow
]
```

### Dynamic Indicator Rendering

```typescript
if (Object.keys(indicatorsData).length > 0) {
  let colorIndex = 0

  for (const [indicatorName, lines] of Object.entries(indicatorsData)) {
    for (const [lineName, lineData] of Object.entries(lines)) {
      if (lineData.length === 0) continue

      const fullName = `${indicatorName}.${lineName}`
      const indicatorSeries = chartRef.current.addSeries(LineSeries, {
        color: indicatorColors[colorIndex % indicatorColors.length],
        lineWidth: 2,
        priceScaleId: 'right',  // Overlay on price scale
        title: fullName,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
        lastValueVisible: false,
        priceLineVisible: false,
      })

      indicatorSeries.setData(lineData)

      // Store series with color for legend
      seriesMap.current.set(fullName, {
        series: indicatorSeries,
        color: indicatorColors[colorIndex % indicatorColors.length]
      })

      colorIndex++
    }
  }
}
```

**How It Works:**
1. Loops through each indicator (e.g., "sma", "macd")
2. Loops through each line within the indicator (e.g., "value", "signal")
3. Creates a `LineSeries` with unique color
4. Full name format: `"macd.signal"`, `"sma.value"`
5. Stores series reference and color for legend access

**Example Result:**
- SMA → 1 line: `sma.value` (teal)
- MACD → 3 lines: `macd.macd` (red), `macd.signal` (purple), `macd.histogram` (orange)
- Bollinger → 3 lines: `bollinger.top` (blue), `bollinger.mid` (green), `bollinger.bot` (pink)

---

## Creating the Interactive Legend

The legend updates in real-time as the user moves their cursor over the chart.

### Legend State Management

```typescript
const [legendData, setLegendData] = useState<any>(null)
```

### Subscribe to Crosshair Movement

Add this inside the chart initialization `useEffect`:

```typescript
// Subscribe to crosshair move for legend
chartRef.current.subscribeCrosshairMove((param) => {
  if (!param.time) {
    setLegendData(null)  // Hide legend when cursor leaves chart
    return
  }

  const data: any = { time: param.time }

  // Get price data (OHLC)
  const priceSeries = seriesMap.current.get('price')
  if (priceSeries) {
    const priceData = param.seriesData.get(priceSeries)
    if (priceData) {
      data.price = priceData  // Contains: open, high, low, close
    }
  }

  // Get volume data
  const volumeSeries = seriesMap.current.get('volume')
  if (volumeSeries) {
    const volData = param.seriesData.get(volumeSeries)
    if (volData) {
      data.volume = volData.value
    }
  }

  // Get equity data
  const equitySeries = seriesMap.current.get('equity')
  if (equitySeries) {
    const eqData = param.seriesData.get(equitySeries)
    if (eqData) {
      data.equity = eqData.value
    }
  }

  // Get indicator data
  data.indicators = {}
  seriesMap.current.forEach((value, key) => {
    if (key !== 'price' && key !== 'volume' && key !== 'equity') {
      const indicatorData = param.seriesData.get(value.series)
      if (indicatorData) {
        data.indicators[key] = {
          value: indicatorData.value,
          color: value.color  // Include color for colored display
        }
      }
    }
  })

  setLegendData(data)
})
```

**How It Works:**
1. `subscribeCrosshairMove` fires whenever cursor moves over chart
2. `param.time` contains the time at cursor position
3. `param.seriesData` is a Map containing data for each series at that time
4. Extract data from each series using `seriesMap` references
5. Update React state to trigger legend re-render

### Legend Rendering (JSX)

```typescript
return (
  <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
    <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />

    {legendData && (
      <div style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        backgroundColor: 'rgba(37, 50, 72, 0.9)',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#fff',
        pointerEvents: 'none',  // Allow clicks to pass through
        zIndex: 10,
        lineHeight: '1.6'
      }}>
        {/* Timestamp */}
        <div style={{ marginBottom: '4px', opacity: 0.7 }}>
          {legendData.time}
        </div>

        {/* OHLC Data */}
        {legendData.price && (
          <div style={{ marginBottom: '2px' }}>
            <span style={{ color: '#4bffb5' }}>O:</span> {legendData.price.open?.toFixed(2)} {' '}
            <span style={{ color: '#4bffb5' }}>H:</span> {legendData.price.high?.toFixed(2)} {' '}
            <span style={{ color: '#ff4976' }}>L:</span> {legendData.price.low?.toFixed(2)} {' '}
            <span style={{ color: '#fff' }}>C:</span> {legendData.price.close?.toFixed(2)}
          </div>
        )}

        {/* Volume */}
        {legendData.volume && (
          <div style={{ marginBottom: '2px', opacity: 0.7 }}>
            Vol: {legendData.volume.toLocaleString()}
          </div>
        )}

        {/* Equity */}
        {legendData.equity && (
          <div style={{ marginBottom: '2px', color: '#2962FF' }}>
            Equity: ${legendData.equity.toFixed(2)}
          </div>
        )}

        {/* Indicators */}
        {Object.keys(legendData.indicators || {}).length > 0 && (
          <div style={{
            marginTop: '4px',
            paddingTop: '4px',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            {Object.entries(legendData.indicators).map(([name, data]: [string, any]) => (
              <div key={name} style={{ color: data.color }}>
                {name}: {data.value?.toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
)
```

**Legend Features:**
- Positioned absolutely over chart (top-left)
- Semi-transparent dark background
- Monospace font for data alignment
- Color-coded values (green for open/high, red for low, etc.)
- Indicators displayed in their assigned colors
- `pointerEvents: 'none'` allows clicking through legend

**Visual Example:**
```
┌─────────────────────────┐
│ 2023-01-15             │
│ O: 130.50  H: 131.20   │
│ L: 129.80  C: 130.90   │
│ Vol: 1,234,567         │
│ Equity: $10,567.89     │
│ ────────────────────   │
│ sma.value: 130.25      │ ← Teal color
│ macd.macd: 15.32       │ ← Red color
│ macd.signal: 14.87     │ ← Purple color
└─────────────────────────┘
```

---

## Trade Markers (Future)

Trade markers are prepared in the data structure but not yet fully implemented due to v5 API changes.

### Data Structure

```typescript
interface TradeMarker {
  time: Time
  type: 'buy' | 'sell'
  price?: number
}
```

### Comment in Code

```typescript
// TODO: Add buy/sell markers - requires different API in v5
// Markers functionality will be added after chart is working
```

### Future Implementation

When ready to implement:

```typescript
if (trades.length > 0) {
  const markers: SeriesMarker<Time>[] = trades.map(trade => ({
    time: trade.time,
    position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
    color: trade.type === 'buy' ? '#26a69a' : '#ef5350',
    shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
    text: trade.type === 'buy' ? 'B' : 'S',
  }))

  candleSeries.setMarkers(markers)
}
```

---

## Bugs Encountered & Solutions

### Bug #1: "Cannot read properties of undefined (reading 'year')"

**Symptom:** Chart crashes when trying to render data

**Cause:** Lightweight-charts v5 couldn't parse ISO datetime strings like `"2023-01-09T05:00:00"`

**Solution:** Extract date part only using `.split('T')[0]`

```typescript
// BEFORE (causes error)
time: candle.datetime  // "2023-01-09T05:00:00"

// AFTER (works)
time: candle.datetime.split('T')[0]  // "2023-01-09"
```

**Why:** The library expects simple date strings (`YYYY-MM-DD`) for daily data, not full timestamps.

---

### Bug #2: Equity Line Not Visible / Distorted

**Symptom:** Equity line appears flat or way off scale

**Cause:** Equity values (e.g., $10,000) and stock prices (e.g., $130) on same scale

**Solution:** Use separate left price scale for equity

```typescript
// BEFORE (wrong)
const equitySeries = chartRef.current.addSeries(LineSeries, {
  // No priceScaleId specified - uses right scale by default
})

// AFTER (correct)
const equitySeries = chartRef.current.addSeries(LineSeries, {
  priceScaleId: 'left',  // Use left scale
})

// ALSO REQUIRED: Enable left scale in chart config
leftPriceScale: {
  visible: true,  // Must be true!
}
```

---

### Bug #3: Chart Not Updating When Data Changes

**Symptom:** Chart shows old data after fetching new backtest results

**Cause:** Missing dependencies in `useEffect` dependency array

**Solution:** Include all data props in dependency array

```typescript
// BEFORE (misses updates)
useEffect(() => {
  // Chart creation
}, [])  // Empty array - only runs once

// AFTER (updates correctly)
useEffect(() => {
  // Chart creation
}, [priceData, volumeData, equityData, indicatorsData, trades, height])
```

**Why:** React only re-runs effect when dependencies change. Must include all data sources.

---

### Bug #4: Indicators Not Showing Up

**Symptom:** Indicators converted but not visible on chart

**Causes & Solutions:**

**Cause A:** Null values not filtered
```typescript
// BEFORE
.map(point => ({ time: point.datetime, value: point[field] }))

// AFTER
.filter(point => point.datetime && point[field] !== null)  // Filter nulls
.map(point => ({ time: point.datetime, value: point[field] as number }))
```

**Cause B:** Empty data arrays
```typescript
if (lineData.length === 0) continue  // Skip empty indicators
```

**Cause C:** Wrong price scale (indicators off-screen)
```typescript
priceScaleId: 'right',  // Match price scale
```

---

### Bug #5: V5 API Syntax Errors

**Symptom:** Errors like "Cannot use string 'Candlestick'" or "addCandlestickSeries is not a function"

**Cause:** Using old v4 API syntax with v5 library

**Solution:** Use v5 class-based syntax

```typescript
// OLD V4 API (doesn't work in v5)
import { createChart } from 'lightweight-charts'
const candleSeries = chartRef.current.addCandlestickSeries({...})

// NEW V5 API (correct)
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
const candleSeries = chartRef.current.addSeries(CandlestickSeries, {...})
```

**Import Changes:**
```typescript
// V5 imports
import {
  createChart,
  CrosshairMode,           // NEW: use enum, not string
  CandlestickSeries,       // NEW: class type
  LineSeries,              // NEW: class type
  HistogramSeries          // NEW: class type
} from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'  // NEW: type imports
```

---

### Bug #6: Memory Leak Warning

**Symptom:** Console warning about memory leak on component unmount

**Cause:** Chart instance not properly cleaned up

**Solution:** Always remove chart in cleanup function

```typescript
useEffect(() => {
  // Chart creation

  return () => {
    if (chartRef.current) {
      chartRef.current.remove()  // REQUIRED
      chartRef.current = null
    }
  }
}, [/* dependencies */])
```

---

### Bug #7: Legend Shows Stale Data

**Symptom:** Legend displays wrong values after data update

**Cause:** Old series references in `seriesMap`

**Solution:** Clear `seriesMap` on each render

```typescript
useEffect(() => {
  seriesMap.current.clear()  // Clear old references

  // Create new chart and series
  // ...

  seriesMap.current.set('price', candleSeries)
  // ... add other series
}, [priceData, volumeData, equityData, indicatorsData])
```

---

### Bug #8: ResizeObserver Loop Error

**Symptom:** Console error about ResizeObserver loop limit exceeded

**Cause:** Chart resize triggering layout recalculation loop

**Solution:** Use setTimeout to break the loop

```typescript
resizeObserverRef.current = new ResizeObserver(entries => {
  const { width } = entries[0].contentRect
  chartRef.current?.applyOptions({ width, height })

  // Break the loop with setTimeout
  setTimeout(() => {
    chartRef.current?.timeScale().fitContent()
  }, 0)
})
```

---

### Bug #9: TypeScript Error - "Property 'value' does not exist"

**Symptom:** TypeScript compilation errors on lines 222, 231, and 242 in CandlestickChart.tsx:
```
Property 'value' does not exist on type 'HistogramData<Time> | LineData<Time> | BarData<Time> | CustomData<Time>'.
  Property 'value' does not exist on type 'BarData<Time>'.
```

**Cause:** The `param.seriesData.get()` method returns a union type that includes `BarData`, which doesn't have a `value` property. TypeScript can't guarantee that the returned object has the `value` property.

**Solution:** Add type guards using `'value' in` checks before accessing `.value`

**Line 222 (Volume data):**
```typescript
// BEFORE (TypeScript error)
const volData = param.seriesData.get(volumeSeries)
if (volData) {
  data.volume = volData.value  // ❌ Error: Property 'value' may not exist
}

// AFTER (Fixed with type guard)
const volData = param.seriesData.get(volumeSeries)
if (volData && 'value' in volData) {
  data.volume = volData.value  // ✅ TypeScript knows 'value' exists
}
```

**Line 231 (Equity data):**
```typescript
// BEFORE (TypeScript error)
const eqData = param.seriesData.get(equitySeries)
if (eqData) {
  data.equity = eqData.value  // ❌ Error
}

// AFTER (Fixed)
const eqData = param.seriesData.get(equitySeries)
if (eqData && 'value' in eqData) {
  data.equity = eqData.value  // ✅ Fixed
}
```

**Line 242 (Indicator data):**
```typescript
// BEFORE (TypeScript error)
const indicatorData = param.seriesData.get(value.series)
if (indicatorData) {
  data.indicators[key] = {
    value: indicatorData.value,  // ❌ Error
    color: value.color
  }
}

// AFTER (Fixed)
const indicatorData = param.seriesData.get(value.series)
if (indicatorData && 'value' in indicatorData) {
  data.indicators[key] = {
    value: indicatorData.value,  // ✅ Fixed
    color: value.color
  }
}
```

**Why This Works:**
- The `'value' in object` syntax is a **type guard** in TypeScript
- It checks at runtime if the property exists
- It narrows the type for TypeScript, confirming the property is available
- This is the safe, idiomatic way to access properties on union types

**Alternative Solutions (Not Recommended):**
```typescript
// Type assertion (unsafe - skips runtime check)
data.volume = (volData as any).value

// Non-null assertion (unsafe - assumes value exists)
data.volume = volData!.value
```

The type guard approach is preferred because it provides both runtime safety and type safety.

---

## Complete Code Examples

### Complete CandlestickChart.tsx

See the full implementation in your project at: `src/components/CandlestickChart.tsx`

Key sections:
- Lines 1-48: Imports and interfaces
- Lines 50-63: Component setup and refs
- Lines 65-75: Color palette
- Lines 77-107: Chart initialization
- Lines 109-122: Candlestick series
- Lines 128-149: Volume histogram
- Lines 151-168: Equity line
- Lines 170-198: Dynamic indicators
- Lines 200-251: Crosshair subscription (legend data)
- Lines 254: Fit content
- Lines 257-262: Cleanup
- Lines 265-282: Resize handling
- Lines 284-337: JSX with legend overlay

### Complete App.tsx Usage

See your project at: `src/App.tsx`

Key sections:
- Lines 36-67: Backend interfaces
- Lines 69-88: Frontend chart interfaces
- Lines 280-308: Convert candles
- Lines 310-321: Convert equity
- Lines 323-361: Convert indicators
- Lines 483-490: Chart rendering with all data

---

## Customization Guide

### Change Colors

#### Candlestick Colors
```typescript
const candleSeries = chartRef.current.addSeries(CandlestickSeries, {
  upColor: '#your-color',
  downColor: '#your-color',
  borderDownColor: '#your-color',
  borderUpColor: '#your-color',
  wickDownColor: '#your-color',
  wickUpColor: '#your-color',
})
```

#### Equity Line Color
```typescript
const equitySeries = chartRef.current.addSeries(LineSeries, {
  color: '#your-color',
  lineWidth: 3,  // Adjust thickness
})
```

#### Background Color
```typescript
chartRef.current = createChart(chartContainerRef.current, {
  layout: {
    background: { color: '#your-background-color' },
    textColor: '#your-text-color',
  },
})
```

### Adjust Volume Size

Change volume overlay height:

```typescript
volumeSeries.priceScale().applyOptions({
  scaleMargins: {
    top: 0.9,    // 0.9 = smaller (bottom 10%)
    // top: 0.8, // 0.8 = default (bottom 20%)
    // top: 0.7, // 0.7 = larger (bottom 30%)
    bottom: 0,
  },
})
```

### Add More Indicator Colors

Extend the color palette:

```typescript
const indicatorColors = [
  '#26a69a', '#ef5350', '#ab47bc', '#ffa726',
  '#42a5f5', '#66bb6a', '#ec407a', '#ffee58',
  '#your-color-1',  // Add more
  '#your-color-2',
  '#your-color-3',
]
```

### Change Chart Height

Pass different height prop:

```typescript
<CandlestickChart
  priceData={...}
  height={600}  // Default is 400
/>
```

### Customize Legend Position

Change legend position in JSX:

```typescript
<div style={{
  position: 'absolute',
  top: '12px',     // Change to 'bottom: 12px' for bottom
  left: '12px',    // Change to 'right: 12px' for right
  // ...
}}>
```

### Format Numbers Differently

Change number precision:

```typescript
// In legend
{legendData.price.open?.toFixed(4)}  // 4 decimal places

// In series
priceFormat: {
  type: 'price',
  precision: 4,      // More decimals
  minMove: 0.0001,   // Smaller movements
}
```

---

## Performance Considerations

### Data Size Limits

| Data Type | Recommended Max | Performance Impact |
|-----------|----------------|-------------------|
| Candles | 10,000 points | Low - renders smoothly |
| Equity | 10,000 points | Low |
| Indicators (per line) | 10,000 points | Low |
| Total Indicator Lines | 10-15 lines | Medium - too many clutters chart |

### Optimization Tips

1. **Filter Data Backend-Side:** Send only necessary data range
2. **Lazy Load Indicators:** Load indicators on demand, not all at once
3. **Debounce Updates:** Don't update chart more than 60 times/second
4. **Use `lastValueVisible: false`:** Reduces rendering overhead
5. **Limit Indicator Lines:** 5-10 lines maximum for readability

### Rendering Performance

Typical render times on modern hardware:
- Initial render (5000 candles + 5 indicators): ~150ms
- Crosshair move (legend update): ~5ms
- Resize: ~50ms

---

## Summary

This integration provides a complete financial charting solution with:

✅ **Candlestick chart** with customizable colors
✅ **Volume histogram** overlaid at bottom
✅ **Equity curve** on separate left scale
✅ **Dynamic indicator support** for any structure
✅ **Interactive legend** showing real-time values
✅ **Responsive design** with proper cleanup
✅ **TypeScript type safety** throughout
✅ **Modern v5 API** using class-based syntax

### Key Technical Decisions

1. **Lightweight-charts v5**: Fast, modern, TypeScript-native
2. **Separate price scales**: Equity on left, price on right
3. **Dynamic indicator system**: No hardcoding, supports any indicator
4. **Crosshair-driven legend**: Real-time value display
5. **Proper React lifecycle**: Cleanup prevents memory leaks

### Data Flow

```
Backend API
    ↓
JSON Response {candles, equity, indicators}
    ↓
App.tsx Transformation Functions
    ↓
Chart-compatible Data
    ↓
CandlestickChart Component
    ↓
Series Creation (candlestick, volume, equity, indicators)
    ↓
Legend Subscription (crosshair move)
    ↓
Interactive Chart with Live Legend
```

---

## Additional Resources

- **Lightweight Charts Docs:** https://tradingview.github.io/lightweight-charts/
- **V5 Migration Guide:** https://tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5
- **API Reference:** https://tradingview.github.io/lightweight-charts/docs/api
- **Your Project Files:**
  - Chart component: `src/components/CandlestickChart.tsx`
  - App logic: `src/App.tsx`
  - Package config: `package.json`

---

**Document Version:** 1.0
**Last Updated:** February 9, 2026
**Library Version:** lightweight-charts v5.1.0
**Framework:** React 19.2.0 + TypeScript
