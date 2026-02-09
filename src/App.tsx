import { useState } from 'react'
import './App.css'
import bollingerBands from './strats/bollinger_bands.txt?raw'
import rsiOversold from './strats/rsi_oversold.txt?raw'
import smaCrossover from './strats/sma_crossover.txt?raw' //important step to extract actual content
import CandlestickChart from './components/CandlestickChart'
import type { Time } from 'lightweight-charts'

const STOCK_SYMBOLS = [
  'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM',
  'V', 'WMT', 'JNJ', 'PG', 'DIS', 'NFLX', 'INTC', 'AMD',
  'CSCO', 'PEP', 'KO', 'NKE', 'BA', 'IBM', 'GE', 'F', 'SPY'
].sort()

const STRATEGIES = [
  { id: 'sma_crossover', 
    name: 'SMACrossover', //once more, name has to match class name (see python to see why)
    desc: 'Moving average cross',
    code: smaCrossover,
    params: {fast: 10, slow: 30} }, //params are based on python 'params' field so string of key MUST match --> look at strats dir & the params declaration there

  { id: 'bollinger_bands', 
    name: 'BollingerMeanReversion', //name MATTERS & must match code class name 
    desc: 'Mean reversion', 
    code: bollingerBands,
    params: {period: 20, devfactor: 2.0} },

  { id: 'rsi_oversold', 
    name: 'RSIOversold', 
    desc: 'RSI momentum', 
    code: rsiOversold,
    params: {period: 14, oversold: 30, overbought: 70} }
]

// Backend candle format
interface BackendCandle {
  datetime: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Backend equity point format
interface EquityData {
  datetime: string
  equity: number
}

// Backend indicator data point (can have different fields per indicator)
interface IndicatorDataPoint {
  datetime: string
  [key: string]: string | number | null  // Flexible for different indicator fields
}

// Backend indicators (object with indicator names as keys)
interface BackendIndicators {
  [indicatorName: string]: IndicatorDataPoint[]
}

// Backend trade signal
interface TradeSignal {
  datetime: string
  type: 'buy' | 'sell'
  price?: number
}

// Frontend chart format (for lightweight-charts)
interface CandleData {
  time: Time
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

// Backend response
interface BacktestResponse {
  success: boolean
  metrics: {
    final_value: number
    initial_value: number
    max_drawdown: number
    sharpe_ratio: number
    total_return: number
  }
  strategy_name: string
  candles: BackendCandle[]
  equity: EquityData[]
  indicators?: BackendIndicators
  trades?: TradeSignal[]
}

function App() {
  const [selectedStrategy, setSelectedStrategy] = useState('')
  const [amount, setAmount] = useState('')
  const [displayAmount, setDisplayAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BacktestResponse | null>(null)
  const [apiError, setApiError] = useState('')

  // Calculate max date (2 months ago from today)
  const getMaxDate = () => {
    const today = new Date()
    today.setMonth(today.getMonth() - 2)
    return today.toISOString().split('T')[0]
  }

  const maxDate = getMaxDate()

  // Validate date is not within past 2 months
  const isDateValid = (dateStr: string) => {
    if (!dateStr) return true
    const selectedDate = new Date(dateStr)
    const maxAllowedDate = new Date(maxDate)
    return selectedDate <= maxAllowedDate
  }

  const handleStartDate = (dateStr: string) => {
    if (isDateValid(dateStr)) {
      setStartDate(dateStr)
    }
  }

  const handleEndDate = (dateStr: string) => {
    if (isDateValid(dateStr)) {
      setEndDate(dateStr)
    }
  }

  const handleAmount = (val: string) => {
    const clean = val.replace(/[$\s,]/g, '')

    if (!clean) {
      setAmount('')
      setDisplayAmount('')
      setError('')
      return
    }

    if (/^\d*\.?\d*$/.test(clean)) { 
      setAmount(clean)
      setError('')

      // Format the display value
      const parts = clean.split('.')
      const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      const formatted = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart
      setDisplayAmount(formatted)
    } else {
      setError('Invalid number')
    }
  }

  const isValid = selectedStrategy && amount && startDate && endDate && stock && !error

  const runBacktest = async () => {
    if (!isValid) return

    setLoading(true)
    setApiError('')
    setShowResults(false)
    setResults(null)

    try {
      const strategy = STRATEGIES.find(s => s.id === selectedStrategy)
      if (!strategy) throw new Error('Strategy not found')

      // Build the payload by merging the strategy config with user inputs 

      /*
      const payload = {

        strategy_code: strategy.code,
        strategy_name: strategy.name,
        strategy_params: {"period": 10, "devfactor": 2.0}, //ALL need to have params field!!!
        data_source: stock,
        start_date: startDate,
        end_date: endDate,
        initial_cash: parseFloat(amount)

      }
*/

      //in react, ' vs "" make a huge difference bc of escape chars ==> TO FIX BACKEND QUIRK : normalize BEFORE accepting JSON
      /*
      correct fix (TODO in backend!!)
      
      strategy_code = data["strategy_code"]
      strategy_code = strategy_code.encode("utf-8").decode("unicode_escape")

      */
      const payload = {

        strategy_code: strategy.code.replace(/\\n/g, '\n'),
        strategy_name: strategy.name, //NEEDS TO MATCH CLASS NAME (look at structure above)
        strategy_params: strategy.params, //ALL need to have params field (request structure above)!!!
        data_source: stock,
        start_date: startDate,
        end_date: endDate,
        initial_cash: parseFloat(amount)

      }

      //another 'quirk', randomly some dates don't work?

      console.log('Backtest payload:', payload)

      const PROD_API_URL = 'https://backtesting-mini-engine-v1-hc8o.onrender.com/backtest'
      const TEST_API_URL = 'http://127.0.0.1:8000/backtest'

      // Choose which API to use
      const API_URL = PROD_API_URL  // Change to PROD_API_URL for production

      console.log('🌐 Calling backend at:', TEST_API_URL)

      const response = await fetch(TEST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      console.log('✅ Response status:', response.status, response.statusText)

      if (!response.ok) {
        // Try to get error details from response
        let errorDetail = `${response.status} ${response.statusText}`
        try {
          const errorJson = await response.json()
          console.error('❌ Backend error details:', errorJson)
          errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson)
        } catch (e) {
          const errorText = await response.text()
          console.error('❌ Backend error text:', errorText)
          errorDetail = errorText || errorDetail
        }
        throw new Error(`API Error: ${errorDetail}`)
      }

      const json = await response.json()
      const data = json as BacktestResponse
      console.log('📦 Raw backend response:', json)
      console.log('📊 Backtest results:', data)
      console.log('📈 Indicators received:', data.indicators)
      console.log('💰 Trades received:', data.trades)

      setResults(data)
      setShowResults(true)
    } 
    
    catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to run backtest')
      console.error('Backtest error:', err)

    } finally {
      setLoading(false)
    }
  }

  // Convert backend candle data to frontend chart format
  const convertCandlesToChartData = (candles: BackendCandle[]) => {
    // Filter out any candles with invalid datetime and convert to proper format
    const priceData: CandleData[] = candles
      .filter(candle => candle.datetime)
      .map(candle => {
        // Extract just the date part (YYYY-MM-DD) from datetime string
        // This handles both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SS' formats
        const dateStr = candle.datetime.split('T')[0] as Time
        return {
          time: dateStr,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close
        }
      })

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

  // Convert backend equity data to frontend chart format
  const convertEquityToChartData = (equity: EquityData[]) => {
    return equity
      .filter(point => point.datetime)
      .map(point => {
        const dateStr = point.datetime.split('T')[0] as Time
        return {
          time: dateStr,
          value: point.equity
        }
      })
  }

  // Convert backend indicators to frontend chart format
  const convertIndicatorsToChartData = (indicators: BackendIndicators) => {
    const result: { [indicatorName: string]: { [lineName: string]: LineData[] } } = {}

    console.log('Converting indicators:', indicators)

    for (const [indicatorName, dataPoints] of Object.entries(indicators)) {
      result[indicatorName] = {}

      // Determine what fields this indicator has (excluding datetime)
      const samplePoint = dataPoints.find(p => p.datetime)
      if (!samplePoint) {
        console.log(`No valid sample point for ${indicatorName}`)
        continue
      }

      const fields = Object.keys(samplePoint).filter(key => key !== 'datetime')
      console.log(`Indicator ${indicatorName} has fields:`, fields)

      // For each field, create a line series
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

        console.log(`${indicatorName}.${field}: ${lineData.length} points`)
        result[indicatorName][field] = lineData
      }
    }

    console.log('Converted indicators result:', result)
    return result
  }

  // Convert backend trades to frontend chart markers
  const convertTradesToMarkers = (trades: TradeSignal[]) => {
    return trades.map(trade => ({
      time: trade.datetime.split('T')[0] as Time,
      type: trade.type,
      price: trade.price
    }))
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>Backtesting Interface</h1>
          <p>Test with prebuilt strategies. Only use data up to July 2025.</p>
        </header>

        {/* Controls - Horizontal Layout */}
        <div className="controls-horizontal">
          {/* Investment */}
          <div className="control-section">
            <label className="label">Investment</label>
            <div className="input-wrapper">
              <span className="dollar-sign">$</span>
              <input
                type="text"
                value={displayAmount}
                onChange={e => handleAmount(e.target.value)}
                placeholder="10,000"
                className={`input ${error ? 'error' : ''}`}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
          </div>

          {/* Stock */}
          <div className="control-section">
            <label className="label">Stock</label>
            <select
              value={stock}
              onChange={e => setStock(e.target.value)}
              className="input"
            >
              <option value="">Select symbol</option>
              {STOCK_SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
            </select>
          </div>

          {/* Strategy */}
          <div className="control-section">
            <label className="label">Strategy</label>
            <div className="button-group">
              {STRATEGIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStrategy(s.id)}
                  className={`strategy-btn ${selectedStrategy === s.id ? 'active' : ''}`}
                >
                  <div className="btn-title">{s.name}</div>
                  <div className="btn-desc">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div className="control-section">
            <label className="label">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => handleStartDate(e.target.value)}
              max={endDate || maxDate}
              className="input"
            />
          </div>

          {/* End Date */}
          <div className="control-section">
            <label className="label">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => handleEndDate(e.target.value)}
              min={startDate || undefined}
              max={maxDate}
              className="input"
            />
          </div>

          {/* Run Button */}
          <div className="control-section">
            <label className="label">&nbsp;</label>
            <button
              disabled={!isValid || loading}
              onClick={runBacktest}
              className={`run-btn ${isValid && !loading ? 'active' : ''}`}
            >
              {loading ? 'Running...' : isValid ? 'Run Backtest' : 'Complete all fields'}
            </button>
          </div>
        </div>

        {/* API Error */}
        {apiError && (
          <div className="error-banner">
            {apiError}
          </div>
        )}

        <div className="grid">

          {/* Right Column */}
          <div className="results">
            {showResults && results ? (
              <>
                <div className="card">
                  <label className="label">Performance Chart</label>
                  <div className="chart-container">
                    {results.candles && results.candles.length > 0 ? (
                      <CandlestickChart
                        priceData={convertCandlesToChartData(results.candles).priceData}
                        volumeData={convertCandlesToChartData(results.candles).volumeData}
                        equityData={results.equity ? convertEquityToChartData(results.equity) : []}
                        indicatorsData={results.indicators ? convertIndicatorsToChartData(results.indicators) : {}}
                        trades={results.trades ? convertTradesToMarkers(results.trades) : []}
                        height={500}
                      />
                    ) : (
                      <div className="empty-state">
                        <p>No chart data available</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <label className="label">Results</label>
                  <div className="results-metrics">
                    <div className="metric">
                      <span className="metric-label">Total Return</span>
                      <span className={`metric-value ${results.metrics.total_return >= 0 ? 'positive' : 'negative'}`}>
                        {results?.metrics.total_return.toFixed(2)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Sharpe Ratio</span>
                      <span className="metric-value">
                        {results.metrics.sharpe_ratio.toFixed(3)}
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Max Drawdown</span>
                      <span className="metric-value negative">
                        {results.metrics.max_drawdown.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="results-summary">
                    <pre>{`Strategy: ${STRATEGIES.find(s => s.id === selectedStrategy)?.name}
                      Stock: ${stock}
                      Period: ${startDate} to ${endDate}
                      Initial Capital: $${displayAmount || amount}`}</pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="card empty-state">
                <p>{loading ? 'Running backtest...' : 'Configure parameters and run backtest to see results'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
