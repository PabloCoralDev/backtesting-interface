# Chart Integration Guide

## Overview

This document explains the complete process of integrating candlestick charts with equity overlay into the backtesting frontend, from backend data reception to final chart rendering.

---

## 1. Backend Data Format

### API Response Structure

The backend returns a JSON response with the following structure:

```typescript
interface BacktestResponse {
  success: boolean
  strategy_name: string
  candles: BackendCandle[]
  equity: EquityData[]
  metrics: {
    final_value: number
    initial_value: number
    max_drawdown: number
    sharpe_ratio: number
    total_return: number
  }
}
```

### Candle Data Format

Each candle contains OHLCV (Open, High, Low, Close, Volume) data:

```typescript
interface BackendCandle {
  datetime: string  // ISO datetime string (e.g., "2023-01-09T05:00:00")
  open: number      // Opening price
  high: number      // Highest price
  low: number       // Lowest price
  close: number     // Closing price
  volume: number    // Trading volume
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

Each equity point tracks portfolio value over time:

```typescript
interface EquityData {
  datetime: string  // ISO datetime string matching candle datetimes
  equity: number    // Portfolio value at this point
}
```

**Example:**
```json
{
  "datetime": "2023-01-09T05:00:00",
  "equity": 10000
}
```

---

## 2. API Communication

### Making the Request

Location: `src/App.tsx` in `runBacktest()` function

```typescript
const response = await fetch('https://backtesting-mini-engine-v1-hc8o.onrender.com/backtest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload)
})

const json = await response.json()
const data = json as BacktestResponse
setResults(data)
```

### Payload Structure

```typescript
{
  strategy_code: string,        // Python strategy code
  strategy_name: string,        // Class name of strategy
  strategy_params: object,      // Strategy parameters
  data_source: string,          // Stock ticker symbol
  start_date: string,           // YYYY-MM-DD format
  end_date: string,             // YYYY-MM-DD format
  initial_cash: number          // Starting portfolio value
}
```

---

## 3. Data Transformation

### Why Transformation is Needed

The `lightweight-charts` library requires:
1. **Time format:** Simple date strings ('YYYY-MM-DD') instead of full ISO datetime
2. **Specific field names:** The library expects certain property names
3. **Type safety:** Data must conform to TypeScript types

### Candle Data Transformation

Location: `src/App.tsx` - `convertCandlesToChartData()`

```typescript
const convertCandlesToChartData = (candles: BackendCandle[]) => {
  // Transform price data for candlestick series
  const priceData: CandleData[] = candles
    .filter(candle => candle.datetime)  // Remove invalid entries
    .map(candle => {
      // Extract date part only (YYYY-MM-DD)
      const dateStr = candle.datetime.split('T')[0] as Time
      return {
        time: dateStr,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }
    })

  // Transform volume data for histogram series
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

**Key Steps:**
1. Filter out invalid candles (missing datetime field)
2. Split ISO datetime to extract date part: `"2023-01-09T05:00:00"` → `"2023-01-09"`
3. Map to chart-compatible format
4. Return separate price and volume datasets

### Equity Data Transformation

Location: `src/App.tsx` - `convertEquityToChartData()`

```typescript
const convertEquityToChartData = (equity: EquityData[]) => {
  return equity
    .filter(point => point.datetime)  // Remove invalid entries
    .map(point => {
      const dateStr = point.datetime.split('T')[0] as Time
      return {
        time: dateStr,
        value: point.equity  // Note: 'equity' field → 'value' field
      }
    })
}
```

**Key Steps:**
1. Filter invalid equity points
2. Extract date from ISO datetime
3. Rename `equity` field to `value` (required by line series)

---

## 4. Chart Component

### Component Structure

Location: `src/components/CandlestickChart.tsx`

The component accepts three data arrays:
- `priceData`: Candlestick price data
- `volumeData`: Volume histogram data (optional)
- `equityData`: Equity line data (optional)

```typescript
interface CandlestickChartProps {
  priceData: CandleData[]
  volumeData?: VolumeData[]
  equityData?: EquityData[]
  height?: number
}
```

### Chart Initialization

```typescript
// Create chart instance
chartRef.current = createChart(chartContainerRef.current, {
  width: chartContainerRef.current.clientWidth,
  height: height,
  layout: {
    background: { color: '#253248' },
    textColor: 'rgba(255, 255, 255, 0.9)',
  },
  rightPriceScale: {
    borderColor: '#485c7b',
  },
  leftPriceScale: {
    visible: true,           // Enable left scale for equity
    borderColor: '#485c7b',
  },
  // ... more config
})
```

### Adding Series to Chart

#### 1. Candlestick Series (Price Data)

```typescript
const candleSeries = chartRef.current.addSeries(CandlestickSeries, {
  upColor: '#4bffb5',          // Green for up candles
  downColor: '#ff4976',        // Red for down candles
  borderDownColor: '#ff4976',
  borderUpColor: '#4bffb5',
  wickDownColor: '#838ca1',
  wickUpColor: '#838ca1',
})

candleSeries.setData(priceData)
```

#### 2. Volume Histogram

```typescript
if (volumeData.length > 0) {
  const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
    color: '#182233',
    priceFormat: { type: 'volume' },
    priceScaleId: '',  // Empty = overlay on price chart
  })

  volumeSeries.setData(volumeData)

  // Position at bottom 20% of chart
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  })
}
```

#### 3. Equity Line

```typescript
if (equityData.length > 0) {
  const equitySeries = chartRef.current.addSeries(LineSeries, {
    color: '#2962FF',           // Blue line
    lineWidth: 2,
    priceScaleId: 'left',       // Use left price scale
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01,
    },
  })

  equitySeries.setData(equityData)
}
```

### Price Scales Explained

The chart uses **two separate price scales**:

1. **Right Scale (default):** Stock prices (candlesticks)
   - Shows stock price range (e.g., $130-$135)
   - Used by candlestick and volume series

2. **Left Scale:** Portfolio equity value
   - Shows portfolio value (e.g., $10,000-$11,000)
   - Used by equity line series
   - Prevents equity line from being distorted by stock prices

---

## 5. Rendering the Chart

### Usage in App Component

Location: `src/App.tsx` - Results section

```typescript
{results.candles && results.candles.length > 0 ? (
  <CandlestickChart
    priceData={convertCandlesToChartData(results.candles).priceData}
    volumeData={convertCandlesToChartData(results.candles).volumeData}
    equityData={results.equity ? convertEquityToChartData(results.equity) : []}
    height={500}
  />
) : (
  <div className="empty-state">
    <p>No chart data available</p>
  </div>
)}
```

**Process:**
1. Check if candle data exists
2. Convert candles to price and volume data
3. Convert equity data if available
4. Pass all data to CandlestickChart component
5. Chart renders with all three series overlaid

---

## 6. Data Flow Summary

```
Backend API
    ↓
JSON Response { candles: [...], equity: [...], metrics: {...} }
    ↓
App.tsx: setResults(data)
    ↓
convertCandlesToChartData(candles)
    → priceData (OHLC)
    → volumeData (histogram)
    ↓
convertEquityToChartData(equity)
    → equityData (line)
    ↓
CandlestickChart Component
    → candleSeries.setData(priceData)
    → volumeSeries.setData(volumeData)  [right scale, bottom 20%]
    → equitySeries.setData(equityData)  [left scale]
    ↓
Rendered Chart
```

---

## 7. Key Technical Details

### Date Format Handling

**Backend sends:** `"2023-01-09T05:00:00"`
**Chart expects:** `"2023-01-09"`
**Solution:** `candle.time.split('T')[0]`

This extracts only the date part, which lightweight-charts can parse correctly.

### Field Name Mapping

| Backend Field | Chart Field | Series Type    |
|---------------|-------------|----------------|
| `datetime`    | `time`      | All            |
| `open`        | `open`      | Candlestick    |
| `high`        | `high`      | Candlestick    |
| `low`         | `low`       | Candlestick    |
| `close`       | `close`     | Candlestick    |
| `volume`      | `value`     | Histogram      |
| `equity`      | `value`     | Line           |

### React Dependencies

The chart re-renders when these props change:

```typescript
useEffect(() => {
  // Chart creation logic
}, [priceData, volumeData, equityData, height])
```

This ensures the chart updates when:
- New backtest results arrive
- User changes chart height
- Data is modified

### Cleanup

```typescript
return () => {
  if (chartRef.current) {
    chartRef.current.remove()  // Destroy chart instance
    chartRef.current = null
  }
}
```

Prevents memory leaks by removing the chart when component unmounts.

---

## 8. Troubleshooting

### Chart Not Displaying

**Check:**
1. Backend is returning data: `console.log(results.candles)`
2. Data is being transformed: Add logs in conversion functions
3. Arrays are not empty: Check `priceData.length > 0`

### "Cannot read properties of undefined (reading 'year')" Error

**Cause:** Invalid datetime format or missing datetime field

**Solution:**
- Ensure backend returns `datetime` field
- Verify date extraction: `candle.datetime.split('T')[0]`

### Equity Line Not Visible

**Possible causes:**
1. Equity data not being passed to component
2. Backend returning empty equity array
3. Equity values outside visible range

**Debug:**
```typescript
console.log('Equity data:', convertEquityToChartData(results.equity))
```

### Volume Bars Too Large/Small

Adjust the volume scale margins in `CandlestickChart.tsx`:

```typescript
scaleMargins: {
  top: 0.8,    // Increase for smaller volume bars
  bottom: 0,
}
```

---

## 9. Customization Options

### Colors

In `CandlestickChart.tsx`:

```typescript
// Candlestick colors
upColor: '#4bffb5',        // Green
downColor: '#ff4976',      // Red

// Equity line
color: '#2962FF',          // Blue

// Background
background: { color: '#253248' }
```

### Chart Height

Pass height prop when using the component:

```typescript
<CandlestickChart height={600} ... />
```

### Price Format

Adjust precision for equity line:

```typescript
priceFormat: {
  type: 'price',
  precision: 2,      // Number of decimal places
  minMove: 0.01,     // Minimum price movement
}
```

---

## 10. Dependencies

The chart integration relies on:

- **lightweight-charts**: Chart rendering library
  - Install: `npm install lightweight-charts`
  - Import: `import { createChart, ... } from 'lightweight-charts'`

- **React hooks**: `useEffect`, `useRef` for lifecycle management

- **TypeScript**: Type safety for data transformation

---

## Summary

The chart integration follows a clear pipeline:

1. **Fetch** data from backend API
2. **Receive** JSON with candles and equity arrays
3. **Transform** data to match chart requirements (date format, field names)
4. **Pass** transformed data to CandlestickChart component
5. **Render** three series: candlesticks (right), volume (bottom), equity (left)

This architecture separates concerns:
- **App.tsx**: Data fetching and transformation
- **CandlestickChart.tsx**: Chart rendering logic
- Clear interfaces for type safety

The result is a robust, maintainable chart integration that visualizes both price action and portfolio performance in a single view.
