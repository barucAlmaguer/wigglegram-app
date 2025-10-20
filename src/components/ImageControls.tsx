import type { LoadedImage } from '../types.ts'

interface ControlInputProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  suffix?: string
}

const ControlInput = ({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: ControlInputProps) => (
  <label className="control-row" htmlFor={id}>
    <span>{label}</span>
    <div className="control-inputs">
      <input
        id={`${id}-range`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="number-input">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span>{suffix}</span> : null}
      </div>
    </div>
  </label>
)

interface ImageControlsProps {
  image: LoadedImage
  onAdjustmentChange: (
    key: keyof LoadedImage['adjustments'],
    value: number,
  ) => void
  onReset: () => void
}

export function ImageControls({
  image,
  onAdjustmentChange,
  onReset,
}: ImageControlsProps) {
  const { offsetX, offsetY, rotation, scale } = image.adjustments

  return (
    <div className="panel image-controls">
      <div className="panel-header">
        <h3>{image.label} Adjustments</h3>
        <button type="button" className="link" onClick={onReset}>
          Reset
        </button>
      </div>
      <div className="panel-body">
        <div className="control-grid">
          <ControlInput
            id={`${image.id}-offset-x`}
            label="Offset X"
            value={offsetX}
            min={-300}
            max={300}
            step={1}
            onChange={(value) => onAdjustmentChange('offsetX', value)}
            suffix="px"
          />
          <ControlInput
            id={`${image.id}-offset-y`}
            label="Offset Y"
            value={offsetY}
            min={-300}
            max={300}
            step={1}
            onChange={(value) => onAdjustmentChange('offsetY', value)}
            suffix="px"
          />
          <ControlInput
            id={`${image.id}-rotation`}
            label="Rotation"
            value={rotation}
            min={-25}
            max={25}
            step={0.1}
            onChange={(value) => onAdjustmentChange('rotation', value)}
            suffix="°"
          />
          <ControlInput
            id={`${image.id}-scale`}
            label="Scale"
            value={scale}
            min={0.5}
            max={2}
            step={0.01}
            onChange={(value) => onAdjustmentChange('scale', value)}
            suffix="×"
          />
        </div>
      </div>
    </div>
  )
}
