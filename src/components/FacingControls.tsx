import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/24/outline'
import { normalizeYawTurns } from '../modelOrientation'

type FacingControlsProps = {
  yawTurns: number
  onChange: (turns: number) => void
}

export function FacingControls({ yawTurns, onChange }: FacingControlsProps) {
  const turns = normalizeYawTurns(yawTurns)
  const degrees = turns * 90

  return (
    <div className="tour-option-row" role="group" aria-label="Rotate all models">
      <span className="tour-option-label" id="facing-label">
        Facing
      </span>
      <div className="facing-seg" role="group" aria-labelledby="facing-label">
        <button
          type="button"
          onClick={() => onChange(turns - 1)}
          title="Rotate all models 90° left"
          aria-label="Rotate all models 90° left"
        >
          <ArrowUturnLeftIcon aria-hidden="true" />
          <span>90°</span>
        </button>
        <span className="facing-deg" aria-live="polite">
          {degrees}°
        </span>
        <button
          type="button"
          onClick={() => onChange(turns + 1)}
          title="Rotate all models 90° right"
          aria-label="Rotate all models 90° right"
        >
          <span>90°</span>
          <ArrowUturnRightIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
