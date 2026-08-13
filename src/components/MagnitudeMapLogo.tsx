type MagnitudeMapLogoProps = {
  className?: string
}

/** Wordmark + scale mark for MagnitudeMap. */
export function MagnitudeMapLogo({ className }: MagnitudeMapLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 268 36"
      role="img"
      aria-label="MagnitudeMap"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor" aria-hidden="true">
        <rect x="0" y="24" width="4.5" height="9" rx="1" opacity="0.4" />
        <rect x="7" y="16" width="4.5" height="17" rx="1" opacity="0.55" />
        <rect x="14" y="7" width="4.5" height="26" rx="1" opacity="0.7" />
        <rect x="21" y="0" width="4.5" height="33" rx="1" opacity="0.85" />
      </g>
      <text
        x="34"
        y="25"
        fill="currentColor"
        fontFamily="'IBM Plex Sans', 'Segoe UI', sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.01em"
      >
        MagnitudeMap
      </text>
    </svg>
  )
}
