import type { ComponentType, SVGProps } from 'react'
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  HomeModernIcon,
  PaperAirplaneIcon,
  RocketLaunchIcon,
  SparklesIcon,
  StarIcon,
} from '@heroicons/react/24/outline'

type IconProps = SVGProps<SVGSVGElement>

/** Classic cartoon bomb — used for the Bomb sizes lineup. */
export function BombIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 21.25c-3.45 0-6.25-2.55-6.25-5.7 0-3.05 2.55-5.55 5.7-5.7.2-.9.75-1.7 1.55-2.15.35-.2.75.05.75.45v.35c0 .55.35 1.05.85 1.25l1.05.4c.55.2.9.75.9 1.35v.55c1.1.85 1.8 2.15 1.8 3.5 0 3.15-2.8 5.7-6.25 5.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13.2 7.6c.55-.85 1.55-1.45 2.65-1.55.35-.05.55.35.35.65-.35.5-.5 1.1-.4 1.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16.55 4.35c.2-.55.85-.75 1.3-.4.55.4.55 1.2.05 1.6-.45.35-1.1.2-1.35-.25"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.2" cy="14.2" r="0.9" fill="currentColor" opacity="0.35" />
    </svg>
  )
}

/** Simple silhouette ship — used for the Navy lineup. */
export function ShipIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3.5 16.5 5 12.75h14l1.5 3.75H3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4.25 16.5c.85 1.6 2.7 2.75 4.75 2.75h6c2.05 0 3.9-1.15 4.75-2.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 12.5V8.25L12 5.5l4 2.75V12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 5.5V3.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Generic spacecraft dart — used for the Star Trek lineup. */
export function SpaceshipIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.25 12 19.5 7.25v9.5L4.25 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Simple four-leg silhouette — used for the Animals lineup. */
export function AnimalIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5.5 16.5 4 20.25M9 16.75 8.2 20.25M14.8 16.75 15.6 20.25M18.2 16.5 19.5 20.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M4.75 14.5c.4-2.4 2.2-4.4 5.05-5.15 1.15-.3 2.05-1.15 2.45-2.25.25-.7 1.15-1.05 1.8-.7 1.35.7 2.35 1.85 2.7 3.25 1.85.55 3.15 2.15 3.5 4.05-2.05.85-5.35 1.35-10.25 1.35-2.05 0-3.85-.2-5.25-.55Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16.6 7.4c.55-.85 1.15-1.55 1.85-1.9.45-.2.95.15.9.65-.1.85-.05 1.6.2 2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const PRESET_ICONS: Record<string, ComponentType<IconProps>> = {
  street: HomeModernIcon,
  nukes: BombIcon,
  fighters: PaperAirplaneIcon,
  bombers: PaperAirplaneIcon,
  airliners: PaperAirplaneIcon,
  helicopters: PaperAirplaneIcon,
  navy: ShipIcon,
  stargate: SparklesIcon,
  starwars: StarIcon,
  startrek: SpaceshipIcon,
  rockets: RocketLaunchIcon,
  landmarks: BuildingLibraryIcon,
  money: BanknotesIcon,
  animals: AnimalIcon,
}

export function PresetIcon({
  presetId,
  className,
}: {
  presetId: string
  className?: string
}) {
  const Icon = PRESET_ICONS[presetId] ?? SparklesIcon
  return <Icon className={className} />
}
