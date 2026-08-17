import { GROUND_PLATES, type GroundPlateId } from '../data/groundPlates'

type GroundPlateControlsProps = {
  plateId: GroundPlateId
  onChange: (id: GroundPlateId) => void
}

export function GroundPlateControls({ plateId, onChange }: GroundPlateControlsProps) {
  return (
    <div className="ground-plate-dock" role="group" aria-label="Ground">
      <span className="facing-overlay-label">Ground</span>
      <div className="facing-seg ground-plate-seg">
        {GROUND_PLATES.map((plate) => (
          <button
            key={plate.id}
            type="button"
            className={plateId === plate.id ? 'is-active' : ''}
            onClick={() => onChange(plate.id)}
            aria-pressed={plateId === plate.id}
            title={
              plate.id === 'manhattan'
                ? 'Manhattan photogrammetry at true scale'
                : 'Suburban blocks at true scale'
            }
          >
            {plate.name}
          </button>
        ))}
      </div>
    </div>
  )
}
