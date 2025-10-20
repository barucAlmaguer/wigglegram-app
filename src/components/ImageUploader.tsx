import type { ChangeEvent } from 'react'
import type { LoadedImage } from '../types.ts'

interface ImageUploaderProps {
  image: LoadedImage
  onSelect: (file: File) => void
}

export function ImageUploader({ image, onSelect }: ImageUploaderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onSelect(file)
    }
  }

  return (
    <label className="panel image-uploader">
      <div className="panel-header">
        <h3>{image.label}</h3>
        {image.fileName ? (
          <span className="filename">{image.fileName}</span>
        ) : (
          <span className="filename muted">No file selected</span>
        )}
      </div>
      <div className="panel-body">
        <p className="hint">
          Drop or pick a photo. Aim for matching subject framing between both
          shots.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          aria-label={`Upload ${image.label}`}
        />
      </div>
    </label>
  )
}
