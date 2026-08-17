type ShadowControlsProps = {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function ShadowControls({ enabled, onChange }: ShadowControlsProps) {
  return (
    <div className="ground-plate-dock shadow-dock" role="group" aria-label="Shadows">
      <span className="facing-overlay-label">Shadows</span>
      <div className="facing-seg ground-plate-seg">
        <button
          type="button"
          className={enabled ? 'is-active' : ''}
          onClick={() => onChange(true)}
          aria-pressed={enabled}
        >
          On
        </button>
        <button
          type="button"
          className={!enabled ? 'is-active' : ''}
          onClick={() => onChange(false)}
          aria-pressed={!enabled}
        >
          Off
        </button>
      </div>
    </div>
  )
}
