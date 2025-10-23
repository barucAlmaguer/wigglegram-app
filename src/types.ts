export interface Dimensions {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface ImageAdjustments {
  offsetX: number
  offsetY: number
  rotation: number
  scale: number
}

export interface LoadedImage {
  id: string
  label: string
  objectUrl?: string
  fileName?: string
  naturalWidth?: number
  naturalHeight?: number
  adjustments: ImageAdjustments
  isLoaded: boolean
  error?: string
}

export interface FrameRenderOptions {
  crop: Dimensions
}

export type ExportFormat = 'gif' | 'mp4'

export type ExportQuality = 'low' | 'medium' | 'high'
