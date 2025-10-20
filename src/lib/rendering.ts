import gifshot from 'gifshot'
import type {
  Dimensions,
  FrameRenderOptions,
  LoadedImage,
} from '../types.ts'

interface GifOptions {
  intervalMs: number
  size: Dimensions
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
    throw new Error('Both images must be loaded before rendering.')
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

export const makeGif = async (
  frames: string[],
  { intervalMs, size }: GifOptions,
): Promise<string> =>
  new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        images: frames,
        gifWidth: size.width,
        gifHeight: size.height,
        interval: intervalMs / 1000,
        numFrames: frames.length,
        sampleInterval: 2,
      },
      (result) => {
        if (result.error || !result.image) {
          reject(new Error('Unable to generate GIF.'))
        } else {
          resolve(result.image)
        }
      },
    )
  })
