/** Compact license labels for UI credits (CC TASL “License” element). */

export function shortLicenseLabel(license: string): string {
  const l = (license || '').toLowerCase().replace(/\s+/g, '')
  if (!l) return 'Unknown'
  if (l.includes('cc0') || l.includes('publicdomain')) return 'CC0'
  if (l.includes('by-nc-sa') || l.includes('byncsa')) return 'CC BY-NC-SA'
  if (l.includes('by-nc-nd') || l.includes('byncnd')) return 'CC BY-NC-ND'
  if (l.includes('by-nc') || l.includes('bync')) return 'CC BY-NC'
  if (l.includes('by-sa') || l.includes('bysa')) return 'CC BY-SA'
  if (l.includes('by-nd') || l.includes('bynd')) return 'CC BY-ND'
  if (l.includes('cc-by') || l.includes('ccby') || l === 'by' || l.startsWith('by-'))
    return 'CC BY'
  if (l.includes('mit')) return 'MIT'
  if (l.includes('apache')) return 'Apache'
  if (l.includes('bsd')) return 'BSD'
  if (l.includes('sketchfab')) return 'Sketchfab'
  return license
}

/** Official CC deed URL when we can map the SPDX-ish license string. */
export function licenseDeedUrl(license: string): string | null {
  const l = (license || '').toLowerCase().replace(/\s+/g, '')
  if (l.includes('cc0')) return 'https://creativecommons.org/publicdomain/zero/1.0/'
  if (l.includes('by-nc-sa')) return 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
  if (l.includes('by-nc-nd')) return 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
  if (l.includes('by-nc')) return 'https://creativecommons.org/licenses/by-nc/4.0/'
  if (l.includes('by-sa')) return 'https://creativecommons.org/licenses/by-sa/4.0/'
  if (l.includes('by-nd')) return 'https://creativecommons.org/licenses/by-nd/4.0/'
  if (l.includes('cc-by') || l.includes('ccby') || l === 'by')
    return 'https://creativecommons.org/licenses/by/4.0/'
  return null
}
