# Indicators and Trade Markers Implementation

## Overview

This document explains how the frontend receives, processes, and displays indicator data and buy/sell trade markers from the backtesting backend.

---

## Backend Data Format

### Complete Backend Response

The backend now returns an enhanced response structure:

```typescript
interface BacktestResponse {
  success: boolean
  strategy_name: string
  metrics: { ... }
  candles: BackendCandle[]
  equity: EquityData[]
  indicators?: BackendIndicators    // NEW: Indicator data
  trades?: TradeSignal[]            // NEW: Buy/sell signals
}
```

### Indicators Format

Indicators are returned as an object where keys are indicator names and values are arrays of data points:

```json
{
  "indicators": {
    "sma": [
      {"datetime": "2023-01-01T00:00:00", "value": null},
      {"datetime": "2023-01-20T00:00:00", "value": 50234.5}
    ],
    "macd": [
      {"datetime": "2023-01-01T00:00:00", "macd": null, "signal": null, "histogram": null},
      {"datetime": "2023-01-26T00:00:00", "macd": 100.5, "signal": 95.2, "histogram": 5.3}
    ],
    "bollinger": [
      {"datetime": "2023-01-20T00:00:00", "top": 51000, "mid": 50000, "bot": 49000}
    ]
  }
}
```

**Key Points:**
- **Single-line indicators** (SMA, EMA, RSI): Use `"value"` field
- **Multi-line indicators** (MACD, Bollinger Bands): Use named fields for each line
- **Null values**: Present during warmup period before indicator can calculate
- **Datetime format**: ISO 8601 format matching candles and equity

### Trades Format

Trade signals mark buy and sell events:

```json
{
  "trades": [
    {"datetime": "2023-01-15T00:00:00", "type": "buy", "price": 150.5},
    {"datetime": "2023-02-10T00:00:00", "type": "sell", "price": 165.2},
    {"datetime": "2023-03-05T00:00:00", "type": "buy", "price": 162.0}
  ]
}
```

**Fields:**
- `datetime`: When the trade occurred
- `type`: Either `"buy"` or `"sell"`
- `price`: (Optional) Execution price

---

## Frontend Implementation

### 1. TypeScript Interfaces

#### Indicator Interfaces (App.tsx)

```typescript
// Flexible data point that can have different fields per indicator
interface IndicatorDataPoint {
  datetime: string
  [key: string]: string | number | null
}

// Object with indicator names as keys
interface BackendIndicators {
  [indicatorName: string]: IndicatorDataPoint[]
}

// Frontend chart format for indicator lines
interface LineData {
  time: Time
  value: number
}
```

#### Trade Interfaces (App.tsx)

```typescript
interface TradeSignal {
  datetime: string
  type: 'buy' | 'sell'
  price?: number
}

interface TradeMarker {
  time: Time
  type: 'buy' | 'sell'
  price?: number
}
```

### 2. Data Conversion Functions

#### Converting Indicators (App.tsx)

```typescript
const convertIndicatorsToChartData = (indicators: BackendIndicators) => {
  const result: { [indicatorName: string]: { [lineName: string]: LineData[] } } = {}

  for (const [indicatorName, dataPoints] of Object.entries(indicators)) {
    result[indicatorName] = {}

    // Get fields from sample point (excluding datetime)
    const samplePoint = dataPoints.find(p => p.datetime)
    if (!samplePoint) continue

    const fields = Object.keys(samplePoint).filter(key => key !== 'datetime')

    // Create a line series for each field
    for (const field of fields) {
      const lineData: LineData[] = dataPoints
        .filter(point => point.datetime && point[field] !== null)
        .map(point => {
          const dateStr = point.datetime.split('T')[0] as Time
          return {
            time: dateStr,
            value: point[field] as number
          }
        })

      result[indicatorName][field] = lineData
    }
  }

  return result
}
```

**Process:**
1. Iterate through each indicator
2. Find a sample data point to determine fields
3. For each field (excluding datetime), create a line series
4. Filter out null values (warmup period)
5. Convert datetime to date format
6. Return nested object: `indicator -> line -> data points`

**Example Output:**
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

#### Converting Trades (App.tsx)

```typescript
const convertTradesToMarkers = (trades: TradeSignal[]) => {
  return trades.map(trade => ({
    time: trade.datetime.split('T')[0] as Time,
    type: trade.type,
    price: trade.price
  }))
}
```

**Process:**
1. Extract date from datetime
2. Preserve type and price
3. Return array of markers

### 3. Chart Component Updates

#### Updated Props (CandlestickChart.tsx)

```typescript
interface CandlestickChartProps {
  priceData: CandleData[]
  volumeData?: VolumeData[]
  equityData?: EquityData[]
  indicatorsData?: IndicatorsData    // NEW
  trades?: TradeMarker[]             // NEW
  height?: number
}
```

#### Rendering Indicators

```typescript
// Color palette for different indicator lines
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

// Add indicator lines if data provided
if (Object.keys(indicatorsData).length > 0) {
  let colorIndex = 0

  for (const [indicatorName, lines] of Object.entries(indicatorsData)) {
    for (const [lineName, lineData] of Object.entries(lines)) {
      if (lineData.length === 0) continue

      const indicatorSeries = chartRef.current.addSeries(LineSeries, {
        color: indicatorColors[colorIndex % indicatorColors.length],
        lineWidth: 2,
        priceScaleId: 'right',  // Overlay on price scale
        title: `${indicatorName}.${lineName}`,
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      })

      indicatorSeries.setData(lineData)
      colorIndex++
    }
  }
}
```

**Key Features:**
- **Color rotation**: Cycles through palette for different lines
- **Right scale**: Indicators overlay on price (same scale as candlesticks)
- **Title format**: `indicatorName.lineName` (e.g., "macd.signal")
- **Multiple lines**: Each indicator line rendered separately

**Example Chart Layers:**
```
┌─────────────────────────────────────┐
│  Equity Line (left scale, blue)    │ ← Portfolio value
│  Candlesticks (right scale)         │ ← Price
│  Volume Bars (bottom 20%)           │ ← Volume
│  SMA Line (right scale, teal)       │ ← Indicator
│  MACD Line (right scale, red)       │ ← Indicator
│  Signal Line (right scale, purple)  │ ← Indicator
│  Buy/Sell Markers                   │ ← Trade signals
└─────────────────────────────────────┘
```

#### Rendering Trade Markers

```typescript
// Add buy/sell markers if provided
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

**Marker Configuration:**

| Trade Type | Position   | Color           | Shape     | Text |
|------------|------------|-----------------|-----------|------|
| Buy        | belowBar   | #26a69a (Teal)  | arrowUp   | B    |
| Sell       | aboveBar   | #ef5350 (Red)   | arrowDown | S    |

**Visual Result:**
```
Price Chart:
     160 ─────────────────▼S────────
                         │
     155 ─────────────────┼────────
                         │
     150 ────────▲B───────┼────────
             │
```

### 4. Connecting to App Component

#### Chart Usage (App.tsx)

```typescript
<CandlestickChart
  priceData={convertCandlesToChartData(results.candles).priceData}
  volumeData={convertCandlesToChartData(results.candles).volumeData}
  equityData={results.equity ? convertEquityToChartData(results.equity) : []}
  indicatorsData={results.indicators ? convertIndicatorsToChartData(results.indicators) : {}}
  trades={results.trades ? convertTradesToMarkers(results.trades) : []}
  height={500}
/>
```

**Flow:**
1. Check if indicators exist in results
2. Convert using `convertIndicatorsToChartData()`
3. Pass to chart as `indicatorsData` prop
4. Same process for trades
5. Chart component renders all layers

---

## Data Flow Diagram

```
Backend API Response
    ↓
{
  candles: [...],
  equity: [...],
  indicators: {          ← NEW
    sma: [...],
    macd: [...]
  },
  trades: [...]          ← NEW
}
    ↓
App.tsx Conversion Functions
    ↓
convertIndicatorsToChartData()
    → { sma: { value: [...] }, macd: { macd: [...], signal: [...] } }
    ↓
convertTradesToMarkers()
    → [{ time: '2023-01-15', type: 'buy' }, ...]
    ↓
CandlestickChart Component
    ↓
For each indicator:
  For each line:
    → addSeries(LineSeries) with unique color
    → setData(lineData)
    ↓
For trades:
  → setMarkers(markers) on candlestick series
    ↓
Rendered Chart with:
  - Price candlesticks
  - Volume bars
  - Equity line (left scale)
  - Multiple indicator lines (right scale)
  - Buy/sell markers
```

---

## Example Use Cases

### Single Indicator (SMA 20)

**Backend Response:**
```json
{
  "indicators": {
    "sma": [
      {"datetime": "2023-01-01", "value": null},
      {"datetime": "2023-01-20", "value": 50234.5},
      {"datetime": "2023-01-21", "value": 50245.3}
    ]
  }
}
```

**Chart Display:**
- One teal line labeled "sma.value"
- Overlaid on price candlesticks
- Starts at 2023-01-20 (after warmup)

### Multi-line Indicator (MACD)

**Backend Response:**
```json
{
  "indicators": {
    "macd": [
      {"datetime": "2023-01-26", "macd": 100.5, "signal": 95.2, "histogram": 5.3},
      {"datetime": "2023-01-27", "macd": 102.1, "signal": 96.8, "histogram": 5.3}
    ]
  }
}
```

**Chart Display:**
- Three lines:
  - "macd.macd" (teal)
  - "macd.signal" (red)
  - "macd.histogram" (purple)
- All overlaid on price scale

### Multiple Indicators + Trades

**Backend Response:**
```json
{
  "indicators": {
    "sma": [...],
    "rsi": [...],
    "macd": [...]
  },
  "trades": [
    {"datetime": "2023-01-15", "type": "buy"},
    {"datetime": "2023-02-10", "type": "sell"}
  ]
}
```

**Chart Display:**
- 5 indicator lines (colors rotated):
  - sma.value (teal)
  - rsi.value (red)
  - macd.macd (purple)
  - macd.signal (orange)
  - macd.histogram (blue)
- Buy marker (up arrow, teal) on 2023-01-15
- Sell marker (down arrow, red) on 2023-02-10

---

## Customization Options

### Indicator Colors

Edit the color palette in `CandlestickChart.tsx`:

```typescript
const indicatorColors = [
  '#26a69a', // Your custom color
  '#ef5350',
  // ... add more colors
]
```

### Indicator Line Width

Change the `lineWidth` property:

```typescript
const indicatorSeries = chartRef.current.addSeries(LineSeries, {
  lineWidth: 3,  // Thicker line
  // ...
})
```

### Trade Marker Appearance

Modify marker properties in the conversion:

```typescript
{
  position: 'belowBar',
  color: '#your-color',
  shape: 'circle',      // Options: circle, square, arrowUp, arrowDown
  text: 'BUY',          // Custom text
  size: 2,              // Marker size
}
```

### Indicator Scale

To display an indicator on a separate scale (like RSI 0-100):

```typescript
const indicatorSeries = chartRef.current.addSeries(LineSeries, {
  priceScaleId: '',  // Empty string = separate overlay scale
  // ...
})

indicatorSeries.priceScale().applyOptions({
  scaleMargins: {
    top: 0.1,    // Position on chart
    bottom: 0.7,
  },
})
```

---

## Troubleshooting

### Indicators Not Showing

**Check:**
1. Backend returns `indicators` field: `console.log(results.indicators)`
2. Conversion produces data: `console.log(convertIndicatorsToChartData(...))`
3. No errors in browser console

**Debug:**
```typescript
console.log('Indicators received:', results.indicators)
console.log('Converted indicators:', convertIndicatorsToChartData(results.indicators))
```

### Markers Not Appearing

**Possible causes:**
1. Backend not returning `trades` field
2. Datetime format mismatch
3. Trade times outside candle data range

**Debug:**
```typescript
console.log('Trades received:', results.trades)
console.log('Converted markers:', convertTradesToMarkers(results.trades))
```

### Too Many Lines (Cluttered Chart)

**Solutions:**
1. Reduce number of indicators in strategy
2. Use separate charts for different indicator types
3. Toggle indicator visibility (future enhancement)

### Colors Don't Match Expectations

**Cause:** Color palette cycles through indicators/lines

**Solution:** Reorder indicators in backend response or customize color palette

---

## Performance Considerations

### Large Datasets

- Lightweight-charts handles 10,000+ candles efficiently
- Multiple indicators (5-10 lines) have minimal impact
- Rendering time: ~100-300ms for typical backtest

### Optimization Tips

1. **Filter null values**: Already done in conversion (prevents rendering gaps)
2. **Limit indicator data**: Backend should align indicator length with candles
3. **Lazy loading**: Load indicators on demand (future enhancement)

---

## Future Enhancements

### Indicator Legend

Add a legend showing indicator names and colors:

```typescript
<div className="indicator-legend">
  {Object.entries(indicatorsData).map(([name, lines]) => (
    <div key={name}>
      {Object.keys(lines).map((lineName, idx) => (
        <span style={{ color: indicatorColors[idx] }}>
          {name}.{lineName}
        </span>
      ))}
    </div>
  ))}
</div>
```

### Toggle Indicator Visibility

Add checkboxes to show/hide specific indicators:

```typescript
const [visibleIndicators, setVisibleIndicators] = useState<Set<string>>(new Set())

// Only render if visible
if (visibleIndicators.has(`${indicatorName}.${lineName}`)) {
  chartRef.current.addSeries(...)
}
```

### Separate Indicator Panes

Create dedicated panes for non-price indicators (RSI, volume):

```typescript
// Create second chart for RSI
const rsiChart = createChart(rsiContainerRef.current, {
  height: 150,
  // ...
})
```

---

## Summary

The indicator and trade marker implementation:

1. **Receives** flexible indicator data from backend (single/multi-line)
2. **Converts** to lightweight-charts format, handling null values
3. **Renders** each indicator line with unique colors
4. **Displays** buy/sell markers on candlestick series
5. **Overlays** everything on a unified chart

**Key Benefits:**
- Automatic detection of single vs multi-line indicators
- No hardcoding of indicator names or fields
- Clear visual separation with color palette
- Trade signals marked directly on price bars

**Result:** A comprehensive backtesting chart that visualizes price, equity, indicators, and trade signals in a single view, similar to professional platforms like TradingView.
