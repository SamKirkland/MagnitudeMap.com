import { useEffect, useRef, useState } from 'react'
import type { DetonationMode } from '../data/blastEffects'

type DetonateControlsProps = {
  visible: boolean
  mode: DetonationMode
  onDetonate: (mode: 'ground' | 'air') => void
  onReset: () => void
}

type Phase = 'armed' | 'flashing' | 'detonated'

const FLASH_MS = 720

export function DetonateControls({
  visible,
  mode,
  onDetonate,
  onReset,
}: DetonateControlsProps) {
  const [phase, setPhase] = useState<Phase>(mode === 'casing' ? 'armed' : 'detonated')
  const phaseRef = useRef(phase)
  const pendingRef = useRef<'ground' | 'air' | null>(null)
  const flashTimerRef = useRef<number | null>(null)
  phaseRef.current = phase

  useEffect(() => {
    if (!visible) {
      pendingRef.current = null
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = null
      }
      setPhase('armed')
      return
    }
    if (phaseRef.current === 'flashing') return
    setPhase(mode === 'casing' ? 'armed' : 'detonated')
  }, [visible, mode])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current)
    }
  }, [])

  if (!visible) return null

  function startDetonation(next: 'ground' | 'air') {
    if (phaseRef.current === 'flashing') return
    pendingRef.current = next
    setPhase('flashing')
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current)
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) onDetonate(pending)
      setPhase('detonated')
    }, FLASH_MS)
  }

  function handleReset() {
    if (phaseRef.current === 'flashing') return
    onReset()
    setPhase('armed')
  }

  return (
    <>
      {phase === 'flashing' && (
        <div className="detonate-flash" aria-hidden="true" />
      )}

      <div className="detonate-dock" role="region" aria-label="Detonation controls">
        {phase === 'armed' && (
          <div className="detonate-armed">
            <button
              type="button"
              className="detonate-btn detonate-btn-ground"
              onClick={() => startDetonation('ground')}
            >
              <GroundBurstIcon />
              Detonate ground
            </button>
            <button
              type="button"
              className="detonate-btn detonate-btn-air"
              onClick={() => startDetonation('air')}
            >
              <AirBurstIcon />
              Detonate air
            </button>
          </div>
        )}

        {phase === 'detonated' && (
          <button type="button" className="detonate-reset" onClick={handleReset}>
            Reset
          </button>
        )}
      </div>
    </>
  )
}

function GroundBurstIcon() {
  return (
    <svg className="detonate-btn-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 20h18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M6.4 20a5.6 5.6 0 0 1 11.2 0Z" fill="currentColor" />
      <path
        d="M12 9.2V5.6M8.1 11.2 6.4 9.2M15.9 11.2l1.7-2"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AirBurstIcon() {
  return (
    <svg className="detonate-btn-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 20h18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.15" r="2.5" fill="currentColor" />
      <circle cx="12" cy="7.15" r="4.4" stroke="currentColor" strokeWidth="1.45" />
      <path
        d="M6 20c1.55-2.85 3.6-4.25 6-4.25S16.45 17.15 18 20"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  )
}
