import gifshot from 'gifshot'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import type {
  Dimensions,
  ExportQuality,
  FrameRenderOptions,
  LoadedImage,
} from '../types.ts'

interface RenderOptions {
  intervalMs: number
  size: Dimensions
  quality: ExportQuality
}

const ensureImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image.'))
    image.src = src
  })

const renderFrame = async (
  image: LoadedImage,
  { crop }: FrameRenderOptions,
): Promise<string> => {
  if (!image.objectUrl) {
    throw new Error('All frames must be loaded before rendering.')
  }

  const element = await ensureImageElement(image.objectUrl)
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to render frame.')
  }

  context.clearRect(0, 0, crop.width, crop.height)
  context.save()
  context.translate(
    crop.width / 2 + image.adjustments.offsetX,
    crop.height / 2 + image.adjustments.offsetY,
  )
  context.rotate((image.adjustments.rotation * Math.PI) / 180)
  context.scale(image.adjustments.scale, image.adjustments.scale)
  context.drawImage(
    element,
    -element.naturalWidth / 2,
    -element.naturalHeight / 2,
  )
  context.restore()

  return canvas.toDataURL('image/png')
}

export const generateFrames = async (
  images: LoadedImage[],
  crop: Dimensions,
) => Promise.all(images.map((image) => renderFrame(image, { crop })))

const GIF_QUALITY_SETTINGS: Record<
  ExportQuality,
  { sampleInterval: number; gifQuality: number }
> = {
  high: {
    sampleInterval: 1,
    gifQuality: 1,
  },
  medium: {
    sampleInterval: 2,
    gifQuality: 5,
  },
  low: {
    sampleInterval: 4,
    gifQuality: 10,
  },
}

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, data] = dataUrl.split(',')
  if (!header || !data) {
    throw new Error('Invalid image data.')
  }
  const mimeMatch = header.match(/data:(.*);base64/)
  const mimeType = mimeMatch?.[1] ?? 'image/gif'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

const dataUrlToUint8Array = async (dataUrl: string): Promise<Uint8Array> => {
  const blob = dataUrlToBlob(dataUrl)
  const buffer = await blob.arrayBuffer()
  return new Uint8Array(buffer)
}

export const makeGif = async (
  frames: string[],
  { intervalMs, size, quality }: RenderOptions,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const settings = GIF_QUALITY_SETTINGS[quality]
    gifshot.createGIF(
      {
        images: frames,
        gifWidth: size.width,
        gifHeight: size.height,
        interval: intervalMs / 1000,
        numFrames: frames.length,
        sampleInterval: settings.sampleInterval,
        gifQuality: settings.gifQuality,
        numWorkers: 4,
      },
      (result) => {
        if (result.error || !result.image) {
          reject(new Error('Unable to generate GIF.'))
        } else {
          try {
            resolve(dataUrlToBlob(result.image))
          } catch (conversionError) {
            reject(
              conversionError instanceof Error
                ? conversionError
                : new Error('Unable to process GIF output.'),
            )
          }
        }
      },
    )
  })

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoadingPromise: Promise<void> | null = null

const VIDEO_QUALITY_SETTINGS: Record<
  ExportQuality,
  { crf: string; preset: string }
> = {
  high: {
    crf: '18',
    preset: 'slow',
  },
  medium: {
    crf: '23',
    preset: 'medium',
  },
  low: {
    crf: '28',
    preset: 'faster',
  },
}

const getFfmpeg = async () => {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg()
  }

  if (!ffmpegInstance.loaded) {
    if (!ffmpegLoadingPromise) {
      ffmpegLoadingPromise = ffmpegInstance
        .load()
        .then(() => undefined)
        .finally(() => {
          ffmpegLoadingPromise = null
        })
    }
    await ffmpegLoadingPromise
  }

  return ffmpegInstance
}

export const makeMp4 = async (
  frames: string[],
  { intervalMs, quality }: RenderOptions,
): Promise<Blob> => {
  if (!frames.length) {
    throw new Error('No frames available for video rendering.')
  }

  const ffmpeg = await getFfmpeg()
  const fpsValue = Math.max(1, 1000 / Math.max(intervalMs, 40))
  const fps = fpsValue.toFixed(2)
  const { crf, preset } = VIDEO_QUALITY_SETTINGS[quality]

  try {
    for (let index = 0; index < frames.length; index += 1) {
      const fileName = `frame_${index.toString().padStart(3, '0')}.png`
      const fileData = await dataUrlToUint8Array(frames[index])
      await ffmpeg.writeFile(fileName, fileData)
    }

    const exitCode = await ffmpeg.exec([
      '-framerate',
      fps,
      '-i',
      'frame_%03d.png',
      '-c:v',
      'libx264',
      '-preset',
      preset,
      '-crf',
      crf,
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      'output.mp4',
    ])

    if (exitCode !== 0) {
      throw new Error('Video rendering failed.')
    }

    const fileData = await ffmpeg.readFile('output.mp4')
    if (!(fileData instanceof Uint8Array)) {
      throw new Error('Unexpected data returned from encoder.')
    }
    const buffer = fileData.slice().buffer
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('libx264')) {
      error.message =
        'MP4 export requires H.264 support. Please try a different browser.'
    }
    throw error
  } finally {
    for (let index = 0; index < frames.length; index += 1) {
      const fileName = `frame_${index.toString().padStart(3, '0')}.png`
      try {
        await ffmpeg.deleteFile(fileName)
      } catch {
        // Ignore missing file cleanup
      }
    }
    try {
      await ffmpeg.deleteFile('output.mp4')
    } catch {
      // Ignore missing output cleanup
    }
  }
}
