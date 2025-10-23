import type { PointerEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dimensions, LoadedImage, Point } from '../types.ts'

interface ImageViewportProps {
  image: LoadedImage
  referenceImage?: LoadedImage | null
  crop: Dimensions
  crosshair: Point
  onCrosshairChange: (point: Point) => void
  showCrosshair: boolean
  crosshairOpacity?: number
  referenceOpacity?: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function ImageViewport({
  image,
  referenceImage,
  crop,
  crosshair,
  onCrosshairChange,
  showCrosshair,
  crosshairOpacity = 0.5,
  referenceOpacity = 0.32,
}: ImageViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [displaySize, setDisplaySize] = useState(() => ({
    width: crop.width,
    height: crop.height,
  }))

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setDisplaySize({ width: rect.width, height: rect.height })
    }

    updateSize()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateSize())
      observer.observe(element)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateSize)
    return () => {
      window.removeEventListener('resize', updateSize)
    }
  }, [crop.height, crop.width])

  const displayScaleX = crop.width ? displaySize.width / crop.width : 1
  const displayScaleY = crop.height ? displaySize.height / crop.height : 1

  const handlePointerPosition = useCallback(
    (clientX: number, clientY: number) => {
      const element = containerRef.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const scaleX = crop.width !== 0 ? crop.width / rect.width : 1
      const scaleY = crop.height !== 0 ? crop.height / rect.height : 1

      const x = clamp((clientX - rect.left) * scaleX, 0, crop.width)
      const y = clamp((clientY - rect.top) * scaleY, 0, crop.height)

      onCrosshairChange({ x, y })
    },
    [crop.height, crop.width, onCrosshairChange],
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      setIsDragging(true)
      handlePointerPosition(event.clientX, event.clientY)
    },
    [handlePointerPosition],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return
      event.preventDefault()
      handlePointerPosition(event.clientX, event.clientY)
    },
    [handlePointerPosition, isDragging],
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handlePointerCancel = useCallback(() => {
    setIsDragging(false)
  }, [])

  const crosshairStyle = useMemo(() => {
    if (!showCrosshair) return undefined
    const left = crop.width ? (crosshair.x / crop.width) * 100 : 0
    const top = crop.height ? (crosshair.y / crop.height) * 100 : 0
    return {
      left: `${left}%`,
      top: `${top}%`,
      opacity: crosshairOpacity,
    }
  }, [crosshair.x, crosshair.y, crop.height, crop.width, crosshairOpacity, showCrosshair])

  const makeTransform = useCallback(
    (target: LoadedImage) => {
      const referenceWidth = target.naturalWidth ?? crop.width
      const referenceHeight = target.naturalHeight ?? crop.height
      const translateX = target.adjustments.offsetX * displayScaleX
      const translateY = target.adjustments.offsetY * displayScaleY
      const baseWidth = referenceWidth * displayScaleX || crop.width
      const baseHeight = referenceHeight * displayScaleY || crop.height
      return {
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) rotate(${target.adjustments.rotation}deg) scale(${target.adjustments.scale})`,
      }
    },
    [crop.height, crop.width, displayScaleX, displayScaleY],
  )

  const transformStyle = useMemo(
    () => makeTransform(image),
    [image, makeTransform],
  )

  const referenceTransformStyle = useMemo(() => {
    if (!referenceImage) return undefined
    return {
      ...makeTransform(referenceImage),
      opacity: referenceOpacity,
    }
  }, [makeTransform, referenceImage, referenceOpacity])

  const containerStyle = useMemo(
    () => ({
      width: '100%',
      aspectRatio:
        crop.height && crop.width ? `${crop.width} / ${crop.height}` : '1 / 1',
    }),
    [crop.height, crop.width],
  )

  return (
    <div className="panel viewport-panel">
      <div className="viewport-header">
        <span>{image.label}</span>
        {image.naturalWidth && image.naturalHeight ? (
          <span className="viewport-meta">
            {image.naturalWidth} × {image.naturalHeight}
          </span>
        ) : (
          <span className="viewport-meta muted">Awaiting image</span>
        )}
      </div>
      <div
        ref={containerRef}
        className={[
          'viewport-canvas',
          image.objectUrl ? '' : 'is-empty',
        ].join(' ')}
        style={containerStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        role="presentation"
      >
        {image.objectUrl ? (
          <img
            src={image.objectUrl}
            alt={`${image.label} preview`}
            className="viewport-image primary-frame"
            draggable={false}
            style={transformStyle}
          />
        ) : (
          <div className="viewport-placeholder">Drop image here</div>
        )}
        {referenceImage?.objectUrl ? (
          <img
            src={referenceImage.objectUrl}
            alt={`${referenceImage.label} reference`}
            className="viewport-image reference-frame"
            draggable={false}
            style={referenceTransformStyle}
          />
        ) : null}

        {showCrosshair && (
          <div className="crosshair" style={crosshairStyle}>
            <div className="crosshair-vertical" />
            <div className="crosshair-horizontal" />
            <div className="crosshair-center" />
          </div>
        )}
      </div>
    </div>
  )
}
