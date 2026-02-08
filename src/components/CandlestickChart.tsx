import { useEffect, useRef } from 'react'
import { createChart, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
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

interface CandlestickChartProps {
  priceData: CandleData[]
  volumeData?: VolumeData[]
  equityData?: EquityData[]
  height?: number
}

export default function CandlestickChart({
  priceData,
  volumeData = [],
  equityData = [],
  height = 400
}: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

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
    })

    candleSeries.setData(priceData)

    // Add volume series if data provided
    if (volumeData.length > 0) {
      const volumeSeries = chartRef.current.addSeries(HistogramSeries, {
        color: '#182233',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      })

      volumeSeries.setData(volumeData)

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
      })

      equitySeries.setData(equityData)
    }

    // Fit content to show all data
    chartRef.current.timeScale().fitContent()

    // Cleanup function
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [priceData, volumeData, equityData, height])

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

  return <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />
}
