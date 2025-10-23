declare module 'gifshot' {
  interface CreateGIFOptions {
    images: string[]
    gifWidth: number
    gifHeight: number
    interval: number
    numFrames?: number
    sampleInterval?: number
    gifQuality?: number
    numWorkers?: number
  }

  interface CreateGIFResult {
    image?: string
    error?: boolean
  }

  type CreateGIFCallback = (result: CreateGIFResult) => void

  interface Gifshot {
    createGIF(options: CreateGIFOptions, callback: CreateGIFCallback): void
  }

  const gifshot: Gifshot
  export default gifshot
}
