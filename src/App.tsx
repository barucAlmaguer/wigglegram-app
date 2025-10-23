import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type {
  Dimensions,
  ExportFormat,
  ExportQuality,
  ImageAdjustments,
  LoadedImage,
  Point,
} from './types.ts'
import { FrameCarousel } from './components/FrameCarousel.tsx'
import { ImageControls } from './components/ImageControls.tsx'
import { ImageViewport } from './components/ImageViewport.tsx'
import { WigglePreview } from './components/WigglePreview.tsx'
import { generateFrames, makeGif, makeMp4 } from './lib/rendering.ts'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const MINIMUM_FRAMES = 2
const MIN_CROP_SIZE = 50
const MAX_CROP_SIZE = 4096
const CROSSHAIR_DEFAULT_ALPHA = 0.5
const DEFAULT_REFERENCE_OPACITY = 0.35

const DEFAULT_CROP: Dimensions = {
  width: 640,
  height: 480,
}

const DEFAULT_CROSSHAIR: Point = {
  x: DEFAULT_CROP.width / 2,
  y: DEFAULT_CROP.height / 2,
}

const QUALITY_LABELS: Record<ExportQuality, string> = {
  low: 'Smaller file',
  medium: 'Balanced',
  high: 'Best quality',
}

const PRESET_SIZES: Array<{ id: string; label: string; width: number; height: number }> = [
  { id: 'square', label: 'Square · 1080 × 1080', width: 1080, height: 1080 },
  { id: 'four-three', label: '4:3 · 1280 × 960', width: 1280, height: 960 },
  { id: 'hd', label: 'Landscape · 1920 × 1080', width: 1920, height: 1080 },
  { id: 'story', label: 'Story · 1080 × 1920', width: 1080, height: 1920 },
  { id: 'reel', label: 'Reel · 1080 × 1350', width: 1080, height: 1350 },
]

const EXPORT_FORMAT_OPTIONS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'gif', label: 'GIF' },
  { value: 'mp4', label: 'MP4' },
]

interface ExportResult {
  url: string
  format: ExportFormat
  fileName: string
}

const createBlankImage = (): LoadedImage => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `frame-${Math.random().toString(16).slice(2)}`,
  label: '',
  objectUrl: undefined,
  fileName: undefined,
  naturalWidth: undefined,
  naturalHeight: undefined,
  adjustments: {
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scale: 1,
  },
  isLoaded: false,
})

const relabelImages = (images: LoadedImage[]): LoadedImage[] =>
  images.map((image, index) => ({
    ...image,
    label: `Frame ${index + 1}`,
  }))

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'light') {
    return stored
  }
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
  return mediaQuery?.matches ? 'dark' : 'light'
}

const createInitialState = () => {
  const frames = relabelImages([createBlankImage(), createBlankImage()])
  return {
    frames,
    activeId: frames[0]?.id ?? '',
  }
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const initialTheme = getInitialTheme()
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initialTheme)
    }
    return initialTheme
  })

  const initialSetup = useMemo(() => createInitialState(), [])

  const [images, setImages] = useState<LoadedImage[]>(initialSetup.frames)
  const [activeImageId, setActiveImageId] = useState<string>(initialSetup.activeId)
  const [pinnedImageId, setPinnedImageId] = useState<string | null>(null)
  const [crop, setCrop] = useState<Dimensions>(DEFAULT_CROP)
  const [crosshair, setCrosshair] = useState<Point>(DEFAULT_CROSSHAIR)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [wiggleSpeed, setWiggleSpeed] = useState(160)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('gif')
  const [gifQuality, setGifQuality] = useState<ExportQuality>('medium')
  const [videoQuality, setVideoQuality] = useState<ExportQuality>('medium')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [crosshairOpacity, setCrosshairOpacity] = useState(CROSSHAIR_DEFAULT_ALPHA)
  const [referenceOpacity, setReferenceOpacity] = useState(DEFAULT_REFERENCE_OPACITY)
  const frameManagerRef = useRef<HTMLElement | null>(null)
  const [isCarouselFloating, setIsCarouselFloating] = useState(false)
  const [isCarouselCollapsed, setIsCarouselCollapsed] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme)
    }
  }, [theme])

  const activeImage = useMemo(
    () => images.find((image) => image.id === activeImageId) ?? images[0],
    [activeImageId, images],
  )

  const pinnedImage = useMemo(() => {
    if (!pinnedImageId) return null
    return images.find((image) => image.id === pinnedImageId) ?? null
  }, [images, pinnedImageId])

  const referenceImage =
    activeImage && pinnedImage && activeImage.id !== pinnedImage.id
      ? pinnedImage
      : null

  useEffect(() => {
    if (!images.length) return
    if (!images.some((image) => image.id === activeImageId)) {
      setActiveImageId(images[0].id)
    }
  }, [activeImageId, images])

  useEffect(() => {
    if (!pinnedImageId) return
    if (!images.some((image) => image.id === pinnedImageId)) {
      setPinnedImageId(null)
    }
  }, [images, pinnedImageId])

  const imagesRef = useRef(images)
  const exportResultRef = useRef(exportResult)

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    exportResultRef.current = exportResult
  }, [exportResult])

  useEffect(() => {
    const handleScroll = () => {
      const element = frameManagerRef.current
      if (!element) return
      const { top } = element.getBoundingClientRect()
      const shouldFloat = top <= 20
      setIsCarouselFloating((previous) =>
        previous === shouldFloat ? previous : shouldFloat,
      )
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => {
        if (image.objectUrl) {
          URL.revokeObjectURL(image.objectUrl)
        }
      })
      const result = exportResultRef.current
      if (result?.url) {
        URL.revokeObjectURL(result.url)
      }
    }
  }, [])

  const cropLimits = useMemo(() => {
    const loaded = images.filter(
      (image) => image.naturalWidth && image.naturalHeight,
    )
    if (!loaded.length) {
      return {
        width: MAX_CROP_SIZE,
        height: MAX_CROP_SIZE,
      }
    }
    return {
      width: Math.min(
        ...loaded.map((image) => image.naturalWidth || MAX_CROP_SIZE),
      ),
      height: Math.min(
        ...loaded.map((image) => image.naturalHeight || MAX_CROP_SIZE),
      ),
    }
  }, [images])

  useEffect(() => {
    setCrop((previous: Dimensions) => ({
      width: clamp(previous.width, MIN_CROP_SIZE, cropLimits.width),
      height: clamp(previous.height, MIN_CROP_SIZE, cropLimits.height),
    }))
  }, [cropLimits.height, cropLimits.width])

  useEffect(() => {
    setCrosshair((previous: Point) => ({
      x: clamp(previous.x, 0, crop.width),
      y: clamp(previous.y, 0, crop.height),
    }))
  }, [crop.height, crop.width])

  const updateImage = useCallback(
    (id: string, updater: (image: LoadedImage) => LoadedImage) => {
      setImages((previous: LoadedImage[]) =>
        previous.map((image) => (image.id === id ? updater(image) : image)),
      )
    },
    [],
  )

  const handleFrameFileSelect = useCallback(
    (id: string, file: File) => {
      const objectUrl = URL.createObjectURL(file)
      setImages((previous: LoadedImage[]) =>
        previous.map((image) => {
          if (image.id !== id) return image
          if (image.objectUrl) {
            URL.revokeObjectURL(image.objectUrl)
          }
          return {
            ...image,
            objectUrl,
            fileName: file.name,
            naturalWidth: undefined,
            naturalHeight: undefined,
            isLoaded: false,
            error: undefined,
          }
        }),
      )

      const loader = new Image()
      loader.onload = () => {
        updateImage(id, (image) => ({
          ...image,
          naturalWidth: loader.naturalWidth,
          naturalHeight: loader.naturalHeight,
          isLoaded: true,
        }))
      }
      loader.onerror = () => {
        updateImage(id, (image) => ({
          ...image,
          error: 'Unable to read image',
          isLoaded: false,
        }))
      }
      loader.src = objectUrl
      setActiveImageId(id)
    },
    [updateImage],
  )

  const handleAddFrame = useCallback(() => {
    const nextFrame = createBlankImage()
    setImages((previous: LoadedImage[]) =>
      relabelImages([...previous, nextFrame]),
    )
    setActiveImageId(nextFrame.id)
  }, [])

  const handleRemoveFrame = useCallback(
    (id: string) => {
      setImages((previous: LoadedImage[]) => {
        if (previous.length <= MINIMUM_FRAMES) return previous

        const target = previous.find((image) => image.id === id)
        if (!target) return previous

        if (target.objectUrl) {
          URL.revokeObjectURL(target.objectUrl)
        }

        const filtered = previous.filter((image) => image.id !== id)
        const relabeled = relabelImages(filtered)

        if (!relabeled.length) {
          setActiveImageId('')
        } else if (
          id === activeImageId ||
          !relabeled.some((image) => image.id === activeImageId)
        ) {
          setActiveImageId(relabeled[0].id)
        }

        if (id === pinnedImageId) {
          setPinnedImageId(null)
        }

        return relabeled
      })
    },
    [activeImageId, pinnedImageId],
  )

  const handlePinToggle = useCallback(
    (id: string) => {
      setPinnedImageId((previous) => (previous === id ? null : id))
    },
    [],
  )

  const handleAdjustmentChange = useCallback(
    (id: string, key: keyof ImageAdjustments, value: number) => {
      updateImage(id, (image) => ({
        ...image,
        adjustments: {
          ...image.adjustments,
          [key]: value,
        },
      }))
    },
    [updateImage],
  )

  const handleResetAdjustments = useCallback(
    (id: string) => {
      updateImage(id, (image) => ({
        ...image,
        adjustments: {
          offsetX: 0,
          offsetY: 0,
          rotation: 0,
          scale: 1,
        },
      }))
    },
    [updateImage],
  )

  const setCropDimension = useCallback(
    (dimension: keyof Dimensions, value: number) => {
      setCrop((previous: Dimensions) => ({
        ...previous,
        [dimension]: clamp(
          Math.round(value),
          MIN_CROP_SIZE,
          dimension === 'width' ? cropLimits.width : cropLimits.height,
        ),
      }))
    },
    [cropLimits.height, cropLimits.width],
  )

  const adjustCropDimension = useCallback(
    (dimension: keyof Dimensions, delta: number) => {
      setCrop((previous: Dimensions) => {
        const current = previous[dimension]
        const nextValue = current + delta
        return {
          ...previous,
          [dimension]: clamp(
            Math.round(nextValue),
            MIN_CROP_SIZE,
            dimension === 'width' ? cropLimits.width : cropLimits.height,
          ),
        }
      })
    },
    [cropLimits.height, cropLimits.width],
  )

  const handleCrosshairInput = useCallback(
    (axis: keyof Point, value: number) => {
      setCrosshair((previous: Point) => {
        const max = axis === 'x' ? crop.width : crop.height
        return {
          ...previous,
          [axis]: clamp(value, 0, max),
        }
      })
    },
    [crop.height, crop.width],
  )

  const handleCrosshairChange = useCallback((point: Point) => {
    setCrosshair(point)
  }, [])

  const loadedCount = useMemo(
    () => images.filter((image) => image.objectUrl).length,
    [images],
  )

  const loadedImages = useMemo(
    () => images.filter((image) => image.objectUrl),
    [images],
  )

  const canExport =
    loadedImages.length >= MINIMUM_FRAMES &&
    loadedImages.length === images.length &&
    !isExporting &&
    crop.width > 0

  const qualityOptions = useMemo(
    () =>
      (Object.keys(QUALITY_LABELS) as ExportQuality[]).map((value) => ({
        value,
        label: QUALITY_LABELS[value],
      })),
    [],
  )

  const currentQuality =
    exportFormat === 'gif' ? gifQuality : videoQuality

  const handleExport = useCallback(async () => {
    if (!canExport) return
    if (!loadedImages.length) return
    setIsExporting(true)
    setErrorMessage(null)

    try {
      const frames = await generateFrames(images, crop)
      const interval = Math.max(wiggleSpeed, 60)

      const blob =
        exportFormat === 'gif'
          ? await makeGif(frames, {
              intervalMs: interval,
              size: crop,
              quality: gifQuality,
            })
          : await makeMp4(frames, {
              intervalMs: interval,
              size: crop,
              quality: videoQuality,
            })

      const objectUrl = URL.createObjectURL(blob)
      if (exportResult?.url) {
        URL.revokeObjectURL(exportResult.url)
      }
      setExportResult({
        url: objectUrl,
        format: exportFormat,
        fileName: `wigglegram.${exportFormat}`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to render export'
      setErrorMessage(message)
    } finally {
      setIsExporting(false)
    }
  }, [
    canExport,
    crop,
    exportFormat,
    exportResult?.url,
    gifQuality,
    images,
    loadedImages.length,
    videoQuality,
    wiggleSpeed,
  ])

  const handleClearExport = useCallback(() => {
    if (exportResult?.url) {
      URL.revokeObjectURL(exportResult.url)
    }
    setExportResult(null)
  }, [exportResult])

  const toggleTheme = useCallback(() => {
    setTheme((previous: 'light' | 'dark') =>
      previous === 'light' ? 'dark' : 'light',
    )
  }, [])

  const handlePresetApply = useCallback(
    (width: number, height: number) => {
      setCropDimension('width', width)
      setCropDimension('height', height)
    },
    [setCropDimension],
  )

  const toggleCarouselCollapsed = useCallback(() => {
    setIsCarouselCollapsed((previous) => !previous)
  }, [])

  if (!activeImage) {
    return null
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-top">
          <h1>Wigglegram Studio</h1>
          <button
            type="button"
            className={`theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'dark'}
          >
            <span className="toggle-track">
              <span className="toggle-icon sun" aria-hidden="true">
                ☀️
              </span>
              <span className="toggle-icon moon" aria-hidden="true">
                🌙
              </span>
              <span className="toggle-thumb" aria-hidden="true" />
            </span>
          </button>
        </div>
        <p>
          Load multiple frames, align them, and craft smooth wigglegrams or
          short loops.
        </p>
      </header>

      <section
        className={[
          'frame-manager',
          isCarouselFloating ? 'is-floating' : '',
          isCarouselCollapsed ? 'is-collapsed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        ref={frameManagerRef}
      >
        <div className="panel">
          <div className="panel-header">
            <h3>Frames</h3>
            <div className="frame-header-actions">
              <span className="frame-count">
                {loadedCount} / {images.length} loaded
              </span>
              {isCarouselFloating || isCarouselCollapsed ? (
                <button
                  type="button"
                  className="chip carousel-toggle"
                  onClick={toggleCarouselCollapsed}
                  aria-pressed={isCarouselCollapsed}
                >
                  {isCarouselCollapsed ? 'Expand ▾' : 'Collapse ▴'}
                </button>
              ) : null}
            </div>
          </div>
          <div className="panel-body">
            <FrameCarousel
              frames={images}
              activeId={activeImage.id}
              pinnedId={pinnedImageId}
              isFloating={isCarouselFloating}
              isCollapsed={isCarouselCollapsed}
              onSelect={setActiveImageId}
              onPinToggle={handlePinToggle}
              onReplace={handleFrameFileSelect}
              onRemove={handleRemoveFrame}
              onAddFrame={handleAddFrame}
              minimumFrames={MINIMUM_FRAMES}
            />
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="panel canvas-toolbar">
          <div className="panel-header">
            <h3>Viewport</h3>
          </div>
          <div className="panel-body">
            <div className="toolbar-grid">
              <label className="control-row">
                <span>Width</span>
                <div className="number-input">
                  <input
                    type="number"
                    value={crop.width}
                    min={MIN_CROP_SIZE}
                    max={cropLimits.width}
                    step={1}
                    onChange={(event) =>
                      setCropDimension('width', Number(event.target.value))
                    }
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'ArrowUp'
                      ) {
                        event.preventDefault()
                        adjustCropDimension('width', 100)
                      }
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'ArrowDown'
                      ) {
                        event.preventDefault()
                        adjustCropDimension('width', -100)
                      }
                    }}
                  />
                  <span>px</span>
                </div>
              </label>
              <label className="control-row">
                <span>Height</span>
                <div className="number-input">
                  <input
                    type="number"
                    value={crop.height}
                    min={MIN_CROP_SIZE}
                    max={cropLimits.height}
                    step={1}
                    onChange={(event) =>
                      setCropDimension('height', Number(event.target.value))
                    }
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'ArrowUp'
                      ) {
                        event.preventDefault()
                        adjustCropDimension('height', 100)
                      }
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'ArrowDown'
                      ) {
                        event.preventDefault()
                        adjustCropDimension('height', -100)
                      }
                    }}
                  />
                  <span>px</span>
                </div>
              </label>
              <label className="control-row">
                <span>Crosshair X</span>
                <div className="number-input">
                  <input
                    type="number"
                    value={Math.round(crosshair.x)}
                    min={0}
                    max={crop.width}
                    step={1}
                    onChange={(event) =>
                      handleCrosshairInput('x', Number(event.target.value))
                    }
                  />
                  <span>px</span>
                </div>
              </label>
              <label className="control-row">
                <span>Crosshair Y</span>
                <div className="number-input">
                  <input
                    type="number"
                    value={Math.round(crosshair.y)}
                    min={0}
                    max={crop.height}
                    step={1}
                    onChange={(event) =>
                      handleCrosshairInput('y', Number(event.target.value))
                    }
                  />
                  <span>px</span>
                </div>
              </label>
              <label className="control-row checkbox">
                <input
                  type="checkbox"
                  checked={showCrosshair}
                  onChange={(event) => setShowCrosshair(event.target.checked)}
                />
                <span>Show crosshair</span>
              </label>
              <label className="control-row">
                <span>Crosshair opacity</span>
                <div className="number-input">
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={crosshairOpacity}
                    onChange={(event) =>
                      setCrosshairOpacity(Number(event.target.value))
                    }
                  />
                  <span>{Math.round(crosshairOpacity * 100)}%</span>
                </div>
              </label>
              <label className="control-row">
                <span>Reference opacity</span>
                <div className="number-input">
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={referenceOpacity}
                    onChange={(event) =>
                      setReferenceOpacity(Number(event.target.value))
                    }
                  />
                  <span>{Math.round(referenceOpacity * 100)}%</span>
                </div>
              </label>
              <div className="preset-buttons">
                {PRESET_SIZES.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className="chip"
                    onClick={() => handlePresetApply(preset.width, preset.height)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setCrosshair({
                    x: crop.width / 2,
                    y: crop.height / 2,
                  })
                }
              >
                Center crosshair
              </button>
            </div>
          </div>
        </div>

        <div className="editor-grid">
          <div className="editor-viewport">
            <ImageViewport
              image={activeImage}
              referenceImage={referenceImage}
              crop={crop}
              crosshair={crosshair}
              onCrosshairChange={handleCrosshairChange}
              showCrosshair={showCrosshair}
              crosshairOpacity={crosshairOpacity}
              referenceOpacity={referenceOpacity}
            />
          </div>
          <div className="editor-controls">
            <ImageControls
              image={activeImage}
              onAdjustmentChange={(key, value) =>
                handleAdjustmentChange(activeImage.id, key, value)
              }
              onReset={() => handleResetAdjustments(activeImage.id)}
            />
          </div>
        </div>

        <div className="panel playback">
          <div className="panel-header">
            <h3>Playback & Export</h3>
          </div>
          <div className="panel-body">
            <label className="control-row">
              <span>Frame interval</span>
              <div className="number-input">
                <input
                  type="number"
                  min={40}
                  max={1000}
                  step={10}
                  value={wiggleSpeed}
                  onChange={(event) =>
                    setWiggleSpeed(Number(event.target.value))
                  }
                />
                <span>ms</span>
              </div>
            </label>
            <div className="export-controls">
              <label className="control-row">
                <span>Format</span>
                <select
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(event.target.value as ExportFormat)
                  }
                >
                  {EXPORT_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="control-row">
                <span>Quality</span>
                <select
                  value={currentQuality}
                  onChange={(event) => {
                    const value = event.target.value as ExportQuality
                    if (exportFormat === 'gif') {
                      setGifQuality(value)
                    } else {
                      setVideoQuality(value)
                    }
                  }}
                >
                  {qualityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="primary"
                onClick={() => setIsPlaying((previous: boolean) => !previous)}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!canExport}
                onClick={handleExport}
              >
                {isExporting
                  ? 'Rendering…'
                  : exportFormat === 'gif'
                    ? 'Export GIF'
                    : 'Export MP4'}
              </button>
            </div>
            {errorMessage ? (
              <p className="error-message">{errorMessage}</p>
            ) : null}
            {exportResult ? (
              <div className="export-output">
                {exportResult.format === 'gif' ? (
                  <img src={exportResult.url} alt="Generated wigglegram" />
                ) : (
                  <video
                    src={exportResult.url}
                    controls
                    loop
                    playsInline
                    muted
                  />
                )}
                <div className="button-row">
                  <a
                    className="primary"
                    href={exportResult.url}
                    download={exportResult.fileName}
                  >
                    Download {exportResult.format.toUpperCase()}
                  </a>
                  <button
                    type="button"
                    className="link"
                    onClick={handleClearExport}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="preview-section">
        <WigglePreview
          images={images}
          crop={crop}
          intervalMs={wiggleSpeed}
          isPlaying={isPlaying}
        />
      </section>
    </div>
  )
}

export default App
