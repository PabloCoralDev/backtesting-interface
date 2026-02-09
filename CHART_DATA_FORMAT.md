# Chart Data Format Guide

## Overview

The frontend now supports interactive candlestick charts using `lightweight-charts`. The chart automatically displays when your backend provides candle data.

## Backend Response Format

Your backend returns the following structure:

```typescript
interface BacktestResponse {
  success: boolean
  strategy_name: string
  candles: BackendCandle[]  // Required for chart
  equity: EquityData[]      // Equity curve data
  metrics: {
    final_value: number
    initial_value: number
    max_drawdown: number
    sharpe_ratio: number
    total_return: number
  }
}
```

## Data Formats

### Candle Data (Required)

Array of candlestick data points with volume:

```typescript
interface BackendCandle {
  datetime: string    // ISO datetime string (e.g., "2024-01-01T00:00:00" or "2024-01-01")
  open: number       // Opening price
  high: number       // Highest price
  low: number        // Lowest price
  close: number      // Closing price
  volume: number     // Trading volume
}
```

**Example:**
```json
{
  "candles": [
    { "datetime": "2024-01-01", "open": 150.0, "high": 155.0, "low": 149.0, "close": 154.0, "volume": 1000000 },
    { "datetime": "2024-01-02", "open": 154.0, "high": 158.0, "low": 153.0, "close": 157.0, "volume": 1500000 },
    { "datetime": "2024-01-03", "open": 157.0, "high": 160.0, "low": 156.0, "close": 159.0, "volume": 1200000 }
  ]
}
```

### Equity Data (Required)

Array of equity curve points showing portfolio value over time:

```typescript
interface EquityData {
  datetime: string  // ISO datetime string matching candle dates
  value: number    // Portfolio value at this time
}
```

**Example:**
```json
{
  "equity": [
    { "datetime": "2024-01-01", "value": 10000.0 },
    { "datetime": "2024-01-02", "value": 10250.5 },
    { "datetime": "2024-01-03", "value": 10500.0 }
  ]
}
```

## Complete Backend Response Example

```json
{
  "success": true,
  "strategy_name": "SMACrossover",
  "candles": [
    { "datetime": "2024-01-01", "open": 150.0, "high": 155.0, "low": 149.0, "close": 154.0, "volume": 1000000 },
    { "datetime": "2024-01-02", "open": 154.0, "high": 158.0, "low": 153.0, "close": 157.0, "volume": 1500000 },
    { "datetime": "2024-01-03", "open": 157.0, "high": 160.0, "low": 156.0, "close": 159.0, "volume": 1200000 }
  ],
  "equity": [
    { "datetime": "2024-01-01", "value": 10000.0 },
    { "datetime": "2024-01-02", "value": 10250.5 },
    { "datetime": "2024-01-03", "value": 10500.0 }
  ],
  "metrics": {
    "final_value": 10500.0,
    "initial_value": 10000.0,
    "max_drawdown": -5.2,
    "sharpe_ratio": 1.45,
    "total_return": 5.0
  }
}
```

## How It Works

### Frontend Behavior

The frontend automatically converts your backend `candles` array into the format required by lightweight-charts:
- Extracts price data (open, high, low, close) for candlestick chart
- Extracts volume data for volume histogram overlay
- Displays both in an interactive chart

### Python Backend Example

Your backend should already be returning data in this format. The `candles` field should be a list of dictionaries:

```python
import pandas as pd

def format_backtest_response(result_df: pd.DataFrame, equity_df: pd.DataFrame, metrics: dict, strategy_name: str) -> dict:
    """
    Format backtest results for frontend

    Args:
        result_df: DataFrame with columns [Date, Open, High, Low, Close, Volume]
        equity_df: DataFrame with columns [Date, Value]
        metrics: Dict with metrics (final_value, initial_value, etc.)
        strategy_name: Name of the strategy

    Returns:
        dict: Response in the format expected by frontend
    """
    # Convert candles to list of dicts
    candles = []
    for idx, row in result_df.iterrows():
        candles.append({
            'datetime': row['Date'].strftime('%Y-%m-%d'),
            'open': float(row['Open']),
            'high': float(row['High']),
            'low': float(row['Low']),
            'close': float(row['Close']),
            'volume': float(row['Volume'])
        })

    # Convert equity to list of dicts
    equity = []
    for idx, row in equity_df.iterrows():
        equity.append({
            'datetime': row['Date'].strftime('%Y-%m-%d'),
            'value': float(row['Value'])
        })

    return {
        'success': True,
        'strategy_name': strategy_name,
        'candles': candles,
        'equity': equity,
        'metrics': metrics
    }
```

## Important Notes

1. **Datetime Format**: Use ISO date strings like 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM:SS' in the `datetime` field
2. **Data Order**: Ensure data points are in chronological order
3. **Matching Times**: Equity datetime values should align with candle datetime values
4. **Volume is Required**: Each candle must include a volume field
5. **Equity is Required**: The equity array is used to track portfolio performance over time

## Testing

Your backend should already be returning the correct format. If you need to test the frontend with mock data:

```typescript
// In runBacktest function (App.tsx), after receiving response:
const data = json as BacktestResponse

// Verify the data structure:
console.log('Candles:', data.candles)
console.log('Equity:', data.equity)

setResults(data)
```

## Need Help?

The chart component is in: `src/components/CandlestickChart.tsx`

You can customize:
- Colors (upColor, downColor)
- Height (pass height prop)
- Chart options (in CandlestickChart.tsx)
