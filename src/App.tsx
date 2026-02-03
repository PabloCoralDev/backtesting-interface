import { useState } from 'react'
import './App.css'

const STOCK_SYMBOLS = [
  'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM',
  'V', 'WMT', 'JNJ', 'PG', 'DIS', 'NFLX', 'INTC', 'AMD',
  'CSCO', 'PEP', 'KO', 'NKE', 'BA', 'IBM', 'GE', 'F'
].sort()

const STRATEGIES = [
  { id: 'momentum', name: 'Momentum', desc: 'Buy high, sell higher' },
  { id: 'meanReversion', name: 'Mean Reversion', desc: 'Buy low, sell high' },
  { id: 'breakout', name: 'Breakout', desc: 'Trade on breakouts' }
]

function App() {
  const [selectedStrategy, setSelectedStrategy] = useState('')
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [stock, setStock] = useState('')
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(false)

  const handleAmount = (val: string) => {
    const clean = val.replace(/[$\s,]/g, '')
    if (!clean) { setAmount(''); setError(''); return }
    /^\d*\.?\d*$/.test(clean) ? (setAmount(clean), setError('')) : setError('Invalid number')
  }

  const isValid = selectedStrategy && amount && startDate && endDate && stock && !error

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>Backtesting Dashboard</h1>
          <p>Configure parameters and analyze results</p>
        </header>

        {/* Controls - Horizontal Layout */}
        <div className="controls-horizontal">
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

          {/* Investment */}
          <div className="control-section">
            <label className="label">Investment</label>
            <div className="input-wrapper">
              <span className="dollar-sign">$</span>
              <input
                type="text"
                value={amount}
                onChange={e => handleAmount(e.target.value)}
                placeholder="10000"
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

          {/* Start Date */}
          <div className="control-section">
            <label className="label">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="input"
            />
          </div>

          {/* End Date */}
          <div className="control-section">
            <label className="label">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate}
              className="input"
            />
          </div>

          {/* Run Button */}
          <div className="control-section">
            <label className="label">&nbsp;</label>
            <button
              disabled={!isValid}
              onClick={() => setShowResults(true)}
              className={`run-btn ${isValid ? 'active' : ''}`}
            >
              {isValid ? 'Run Backtest' : 'Complete all fields'}
            </button>
          </div>
        </div>

        <div className="grid">

          {/* Right Column */}
          <div className="results">
            {showResults ? (
              <>
                <div className="card">
                  <label className="label">Performance Chart</label>
                  <div className="chart-placeholder">
                    Chart placeholder
                  </div>
                </div>

                <div className="card">
                  <label className="label">Results</label>
                  <div className="results-log">
                    <pre>{`Strategy: ${STRATEGIES.find(s => s.id === selectedStrategy)?.name}
Stock: ${stock}
Period: ${startDate} to ${endDate}
Initial Capital: $${amount}

Total Return: ...
Sharpe Ratio: ...
Max Drawdown: ...
Win Rate: ...`}</pre>
                  </div>
                </div>
              </>
            ) : (
              <div className="card empty-state">
                <p>Configure parameters and run backtest to see results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
