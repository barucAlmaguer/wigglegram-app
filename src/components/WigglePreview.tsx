import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dimensions, LoadedImage } from '../types.ts'

interface WigglePreviewProps {
  images: LoadedImage[]
  crop: Dimensions
  intervalMs: number
  isPlaying: boolean
}

export function WigglePreview({
  images,
  crop,
  intervalMs,
  isPlaying,
}: WigglePreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [displaySize, setDisplaySize] = useState(() => ({
    width: crop.width,
    height: crop.height,
  }))

  useEffect(() => {
    if (!isPlaying || images.some((img) => !img.objectUrl)) return undefined

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length)
    }, Math.max(intervalMs, 40))

    return () => window.clearInterval(interval)
  }, [images, intervalMs, isPlaying])

  useEffect(() => {
    setActiveIndex(0)
  }, [intervalMs, images])

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

  const containerStyle = useMemo(
    () => ({
      width: '100%',
      aspectRatio:
        crop.height && crop.width ? `${crop.width} / ${crop.height}` : '1 / 1',
    }),
    [crop.height, crop.width],
  )

  if (images.every((img) => !img.objectUrl)) {
    return (
      <div
        className="wiggle-preview empty"
        ref={containerRef}
        style={containerStyle}
      >
        <span>Load both images to preview</span>
      </div>
    )
  }

  return (
    <div
      className="wiggle-preview"
      ref={containerRef}
      style={containerStyle}
    >
      {images.map((image, index) =>
        image.objectUrl ? (
          <img
            key={image.id}
            src={image.objectUrl}
            alt={`${image.label} wiggle frame`}
            className={[
              'wiggle-frame',
              index === activeIndex ? 'visible' : '',
            ].join(' ')}
            style={(() => {
              const { offsetX, offsetY, rotation, scale } = image.adjustments
              const baseWidth =
                (image.naturalWidth ?? crop.width) * displayScaleX || crop.width
              const baseHeight =
                (image.naturalHeight ?? crop.height) * displayScaleY ||
                crop.height
              const translateX = offsetX * displayScaleX
              const translateY = offsetY * displayScaleY
              return {
                width: `${baseWidth}px`,
                height: `${baseHeight}px`,
                transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) rotate(${rotation}deg) scale(${scale})`,
              }
            })()}
            draggable={false}
          />
        ) : null,
      )}
    </div>
  )
}
