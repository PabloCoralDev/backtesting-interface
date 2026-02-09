import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'

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

interface EquityData {
  time: Time
  value: number
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

interface TradeMarker {
  time: Time
  type: 'buy' | 'sell'
  price?: number
}

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

  // Color palette for indicators
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

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart
    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#253248' },
        textColor: 'rgba(255, 255, 255, 0.9)',
      },
      grid: {
        vertLines: { color: '#334158' },
        horzLines: { color: '#334158' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#485c7b',
      },
      leftPriceScale: {
        visible: true,
        borderColor: '#485c7b',
      },
      timeScale: {
        borderColor: '#485c7b',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // Add candlestick series
    const candleSeries = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#4bffb5',
      downColor: '#ff4976',
      borderDownColor: '#ff4976',
      borderUpColor: '#4bffb5',
      wickDownColor: '#838ca1',
      wickUpColor: '#838ca1',
      lastValueVisible: false,
      priceLineVisible: false,
    })

    candleSeries.setData(priceData)
    seriesMap.current.set('price', candleSeries)

    // TODO: Add buy/sell markers - requires different API in v5
    // Markers functionality will be added after chart is working

    // Add volume series if data provided
    if (volumeData.length > 0) {
      const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
        color: '#182233',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      })

      volumeSeries.setData(volumeData)
      seriesMap.current.set('volume', volumeSeries)

      // Apply scale margins to make volume overlay at bottom
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      })
    }

    // Add equity line series if data provided
    if (equityData.length > 0) {
      const equitySeries = chartRef.current.addSeries(LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        priceScaleId: 'left',
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

    // Add indicator lines if data provided
    if (Object.keys(indicatorsData).length > 0) {
      let colorIndex = 0

      for (const [indicatorName, lines] of Object.entries(indicatorsData)) {
        for (const [lineName, lineData] of Object.entries(lines)) {
          if (lineData.length === 0) continue

          const fullName = `${indicatorName}.${lineName}`
          const indicatorSeries = chartRef.current.addSeries(LineSeries, {
            color: indicatorColors[colorIndex % indicatorColors.length],
            lineWidth: 2,
            priceScaleId: 'right',
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
          seriesMap.current.set(fullName, { series: indicatorSeries, color: indicatorColors[colorIndex % indicatorColors.length] })
          colorIndex++
        }
      }
    }

    // Subscribe to crosshair move for legend
    chartRef.current.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setLegendData(null)
        return
      }

      const data: any = { time: param.time }

      // Get price data
      const priceSeries = seriesMap.current.get('price')
      if (priceSeries) {
        const priceData = param.seriesData.get(priceSeries)
        if (priceData) {
          data.price = priceData
        }
      }

      // Get volume data
      const volumeSeries = seriesMap.current.get('volume')
      if (volumeSeries) {
        const volData = param.seriesData.get(volumeSeries)
        if (volData && 'value' in volData) {
          data.volume = volData.value
        }
      }

      // Get equity data
      const equitySeries = seriesMap.current.get('equity')
      if (equitySeries) {
        const eqData = param.seriesData.get(equitySeries)
        if (eqData && 'value' in eqData) {
          data.equity = eqData.value
        }
      }

      // Get indicator data
      data.indicators = {}
      seriesMap.current.forEach((value, key) => {
        if (key !== 'price' && key !== 'volume' && key !== 'equity') {
          const indicatorData = param.seriesData.get(value.series)
          if (indicatorData && 'value' in indicatorData) {
            data.indicators[key] = {
              value: indicatorData.value,
              color: value.color
            }
          }
        }
      })

      setLegendData(data)
    })

    // Fit content to show all data
    chartRef.current.timeScale().fitContent()

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [priceData, volumeData, equityData, indicatorsData, trades, height])

  // Handle resize
  useEffect(() => {
    if (!chartContainerRef.current || !chartRef.current) return

    resizeObserverRef.current = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      chartRef.current?.applyOptions({ width, height })
      setTimeout(() => {
        chartRef.current?.timeScale().fitContent()
      }, 0)
    })

    resizeObserverRef.current.observe(chartContainerRef.current)

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [height])

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
          pointerEvents: 'none',
          zIndex: 10,
          lineHeight: '1.6'
        }}>
          <div style={{ marginBottom: '4px', opacity: 0.7 }}>{legendData.time}</div>

          {legendData.price && (
            <div style={{ marginBottom: '2px' }}>
              <span style={{ color: '#4bffb5' }}>O:</span> {legendData.price.open?.toFixed(2)} {' '}
              <span style={{ color: '#4bffb5' }}>H:</span> {legendData.price.high?.toFixed(2)} {' '}
              <span style={{ color: '#ff4976' }}>L:</span> {legendData.price.low?.toFixed(2)} {' '}
              <span style={{ color: '#fff' }}>C:</span> {legendData.price.close?.toFixed(2)}
            </div>
          )}

          {legendData.volume && (
            <div style={{ marginBottom: '2px', opacity: 0.7 }}>
              Vol: {legendData.volume.toLocaleString()}
            </div>
          )}

          {legendData.equity && (
            <div style={{ marginBottom: '2px', color: '#2962FF' }}>
              Equity: ${legendData.equity.toFixed(2)}
            </div>
          )}

          {Object.keys(legendData.indicators || {}).length > 0 && (
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
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
}
