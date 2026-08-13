import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/24/outline'
import { normalizeYawTurns } from '../modelOrientation'

type FacingControlsProps = {
  yawTurns: number
  onChange: (turns: number) => void
  variant?: 'sidebar' | 'overlay'
}

export function FacingControls({
  yawTurns,
  onChange,
  variant = 'sidebar',
}: FacingControlsProps) {
  const turns = normalizeYawTurns(yawTurns)
  const degrees = turns * 90

  return (
    <div
      className={variant === 'overlay' ? 'facing-dock' : 'tour-option-row'}
      role="group"
      aria-label="Rotate all models"
    >
      {variant === 'overlay' && (
        <span className="facing-overlay-label">Facing</span>
      )}
      {variant === 'sidebar' && (
        <span className="tour-option-label" id="facing-label">
          Facing
        </span>
      )}
      <div className="facing-seg" role="group" aria-labelledby={variant === 'sidebar' ? 'facing-label' : undefined}>
        <button
          type="button"
          onClick={() => onChange(turns - 1)}
          title="Rotate all models 90° left"
          aria-label="Rotate all models 90 degrees left"
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
          aria-label="Rotate all models 90 degrees right"
        >
          <span>90°</span>
          <ArrowUturnRightIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
