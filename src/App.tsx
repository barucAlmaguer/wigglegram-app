import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import type {
  Dimensions,
  ImageAdjustments,
  LoadedImage,
  Point,
} from './types.ts'
import { ImageUploader } from './components/ImageUploader.tsx'
import { ImageControls } from './components/ImageControls.tsx'
import { ImageViewport } from './components/ImageViewport.tsx'
import { WigglePreview } from './components/WigglePreview.tsx'
import { generateFrames, makeGif } from './lib/rendering.ts'

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const makeInitialImage = (id: 'a' | 'b', label: string): LoadedImage => ({
  id,
  label,
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

const DEFAULT_CROP: Dimensions = {
  width: 640,
  height: 480,
}

const DEFAULT_CROSSHAIR: Point = {
  x: DEFAULT_CROP.width / 2,
  y: DEFAULT_CROP.height / 2,
}

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'light') {
    return stored
  }
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
  return mediaQuery?.matches ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const initialTheme = getInitialTheme()
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initialTheme)
    }
    return initialTheme
  })
  const [images, setImages] = useState<LoadedImage[]>([
    makeInitialImage('a', 'Left Frame'),
    makeInitialImage('b', 'Right Frame'),
  ])
  const [crop, setCrop] = useState<Dimensions>(DEFAULT_CROP)
  const [crosshair, setCrosshair] = useState<Point>(DEFAULT_CROSSHAIR)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [activeViewport, setActiveViewport] = useState<'a' | 'b'>('a')
  const [wiggleSpeed, setWiggleSpeed] = useState(160)
  const [isPlaying, setIsPlaying] = useState(true)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [isGeneratingGif, setIsGeneratingGif] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme)
    }
  }, [theme])

  const updateImage = useCallback(
    (id: 'a' | 'b', updater: (image: LoadedImage) => LoadedImage) => {
      setImages((previous: LoadedImage[]) =>
        previous.map((image) => (image.id === id ? updater(image) : image)),
      )
    },
    [],
  )

  const handleImageSelect = useCallback(
    (id: 'a' | 'b', file: File) => {
      const objectUrl = URL.createObjectURL(file)

      updateImage(id, (image) => {
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
      })

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
    },
    [updateImage],
  )

  useEffect(() => {
    const loaded = images.filter(
      (image) => image.naturalWidth && image.naturalHeight,
    )
    if (!loaded.length) return

    const minWidth = Math.min(
      ...loaded.map((image) => image.naturalWidth || crop.width),
    )
    const minHeight = Math.min(
      ...loaded.map((image) => image.naturalHeight || crop.height),
    )

    setCrop((previous: Dimensions) => ({
      width: clamp(previous.width, 100, minWidth),
      height: clamp(previous.height, 100, minHeight),
    }))
  }, [images])

  useEffect(() => {
    setCrosshair((previous: Point) => ({
      x: clamp(previous.x, 0, crop.width),
      y: clamp(previous.y, 0, crop.height),
    }))
  }, [crop.height, crop.width])

  const handleAdjustmentChange = useCallback(
    (id: 'a' | 'b', key: keyof ImageAdjustments, value: number) => {
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
    (id: 'a' | 'b') => {
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

  const handleCropChange = useCallback(
    (dimension: keyof Dimensions, value: number) => {
      setCrop((previous: Dimensions) => {
        const next = {
          ...previous,
          [dimension]: clamp(Math.round(value), 50, 4096),
        }
        return next
      })
    },
    [],
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

  const canGenerateGif =
    loadedCount === images.length && !isGeneratingGif && crop.width > 0

  const handleGenerateGif = useCallback(async () => {
    if (!canGenerateGif) return
    setIsGeneratingGif(true)
    setErrorMessage(null)
    try {
      const frames = await generateFrames(images, crop)
      const result = await makeGif(frames, {
        intervalMs: Math.max(wiggleSpeed, 60),
        size: crop,
      })
      setGifUrl(result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to render GIF'
      setErrorMessage(message)
    } finally {
      setIsGeneratingGif(false)
    }
  }, [canGenerateGif, crop, images, wiggleSpeed])

  const handleClearGif = useCallback(() => {
    setGifUrl(null)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((previous: 'light' | 'dark') =>
      previous === 'light' ? 'dark' : 'light',
    )
  }, [])

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
          Load two offset photos, align them, and preview the animated depth
          effect.
        </p>
      </header>

      <section className="upload-grid">
        {images.map((image) => (
          <ImageUploader
            key={image.id}
            image={image}
            onSelect={(file: File) => handleImageSelect(image.id, file)}
          />
        ))}
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
                    min={50}
                    max={4096}
                    step={1}
                    onChange={(event) =>
                      handleCropChange('width', Number(event.target.value))
                    }
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
                    min={50}
                    max={4096}
                    step={1}
                    onChange={(event) =>
                      handleCropChange('height', Number(event.target.value))
                    }
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

        <div className="viewport-row">
          {images.map((image) => (
            <div className="viewport-column" key={image.id}>
              <ImageViewport
                image={image}
                crop={crop}
                crosshair={crosshair}
                onCrosshairChange={handleCrosshairChange}
                showCrosshair={showCrosshair}
                isActive={activeViewport === image.id}
                onActivate={() => setActiveViewport(image.id)}
              />
              <ImageControls
                image={image}
                onAdjustmentChange={(
                  key: keyof ImageAdjustments,
                  value: number,
                ) => handleAdjustmentChange(image.id, key, value)}
                onReset={() => handleResetAdjustments(image.id)}
              />
            </div>
          ))}
        </div>

        <div className="panel playback">
          <div className="panel-header">
            <h3>Wiggle Preview</h3>
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
                disabled={!canGenerateGif}
                onClick={handleGenerateGif}
              >
                {isGeneratingGif ? 'Rendering…' : 'Create GIF'}
              </button>
            </div>
            {errorMessage ? (
              <p className="error-message">{errorMessage}</p>
            ) : null}
            {gifUrl ? (
              <div className="gif-output">
                <img src={gifUrl} alt="Generated wigglegram" />
                <div className="button-row">
                  <a
                    className="primary"
                    href={gifUrl}
                    download="wigglegram.gif"
                  >
                    Download GIF
                  </a>
                  <button
                    type="button"
                    className="link"
                    onClick={handleClearGif}
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
