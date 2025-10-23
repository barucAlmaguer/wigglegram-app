import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, MouseEvent } from 'react'
import type { LoadedImage } from '../types.ts'

interface FrameCarouselProps {
  frames: LoadedImage[]
  activeId: string
  pinnedId: string | null
  isFloating: boolean
  isCollapsed: boolean
  onSelect: (id: string) => void
  onPinToggle: (id: string) => void
  onReplace: (id: string, file: File) => void
  onRemove: (id: string) => void
  onAddFrame: () => void
  minimumFrames: number
}

const ACCEPTED_TYPES = 'image/*'

interface FrameCardProps {
  frame: LoadedImage
  isActive: boolean
  isPinned: boolean
  isFloating: boolean
  isCollapsed: boolean
  onSelect: (id: string) => void
  onPinToggle: (id: string) => void
  onReplace: (id: string, file: File) => void
  onRemove: (id: string) => void
  disableRemove: boolean
}

const FrameCard = ({
  frame,
  isActive,
  isPinned,
  onSelect,
  onPinToggle,
  onReplace,
  onRemove,
  disableRemove,
  isFloating,
  isCollapsed,
}: FrameCardProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        onReplace(frame.id, file)
      }
      // Reset value so selecting the same file triggers change
      event.target.value = ''
    },
    [frame.id, onReplace],
  )

  const handlePickClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleCardClick = useCallback(() => {
    onSelect(frame.id)
    if (!frame.objectUrl) {
      handlePickClick()
    }
  }, [frame.id, frame.objectUrl, handlePickClick, onSelect])

  const handleRemoveClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      if (!disableRemove) {
        onRemove(frame.id)
      }
    },
    [disableRemove, frame.id, onRemove],
  )

  const handlePinClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onPinToggle(frame.id)
    },
    [frame.id, onPinToggle],
  )

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragOver(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) {
        onReplace(frame.id, file)
      }
    },
    [frame.id, onReplace],
  )

  return (
    <div
      className={[
        'frame-card',
        isActive ? 'is-active' : '',
        isPinned ? 'is-pinned' : '',
        isFloating ? 'is-floating' : '',
        frame.objectUrl ? '' : 'is-empty',
        isDragOver ? 'is-drag-over' : '',
        isCollapsed ? 'is-compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(frame.id)
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="frame-card-preview">
        {frame.objectUrl ? (
          <img src={frame.objectUrl} alt={`${frame.label} preview`} />
        ) : (
          <span>Drop or pick image</span>
        )}
      </div>
      <div className="frame-card-body">
        <div className="frame-card-meta">
          <span className="frame-card-title">{frame.label}</span>
          {frame.fileName ? (
            <span className="frame-card-filename" title={frame.fileName}>
              {frame.fileName}
            </span>
          ) : (
            <span className="frame-card-filename muted">No file selected</span>
          )}
        </div>
        <div className="frame-card-actions">
          <button
            type="button"
            className="chip"
            onClick={(event) => {
              event.stopPropagation()
              handlePickClick()
            }}
          >
            {frame.objectUrl ? 'Replace' : 'Upload'}
          </button>
          <button
            type="button"
            className={`chip ${isPinned ? 'is-active' : ''}`}
            onClick={handlePinClick}
            aria-pressed={isPinned}
          >
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            className="chip danger"
            onClick={handleRemoveClick}
            disabled={disableRemove}
            aria-disabled={disableRemove}
          >
            Remove
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="frame-card-input"
        aria-hidden="true"
      />
    </div>
  )
}

export function FrameCarousel({
  frames,
  activeId,
  pinnedId,
  isFloating,
  isCollapsed,
  onSelect,
  onPinToggle,
  onReplace,
  onRemove,
  onAddFrame,
  minimumFrames,
}: FrameCarouselProps) {
  const orderedFrames = useMemo(() => {
    const pinnedFrame = frames.find((frame) => frame.id === pinnedId)
    const remaining = frames.filter((frame) => frame.id !== pinnedId)
    return pinnedFrame ? [pinnedFrame, ...remaining] : remaining
  }, [frames, pinnedId])

  const disableRemove = frames.length <= minimumFrames

  return (
    <div
      className={[
        'frame-carousel',
        isCollapsed ? 'is-collapsed' : '',
        isFloating ? 'is-floating' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Frames"
    >
      <div className="frame-carousel-track">
        {orderedFrames.map((frame) => (
          <FrameCard
            key={frame.id}
            frame={frame}
            isActive={frame.id === activeId}
            isPinned={frame.id === pinnedId}
            isFloating={isFloating}
            onSelect={onSelect}
            onPinToggle={onPinToggle}
            onReplace={onReplace}
            onRemove={onRemove}
            disableRemove={disableRemove}
            isCollapsed={isCollapsed}
          />
        ))}
        <button
          type="button"
          className={[
            'frame-card',
            'add-frame',
            isCollapsed ? 'is-compact' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onAddFrame}
        >
          <span className="add-frame-icon">＋</span>
          <span>Add frame</span>
        </button>
      </div>
    </div>
  )
}
