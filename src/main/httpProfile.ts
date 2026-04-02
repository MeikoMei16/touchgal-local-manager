export interface HttpProfile {
  id: string
  label: string
  userAgent: string
  acceptLanguage: string
  origin: string
  referer: string
}

export type HttpProfileMode = 'fixed' | 'rotate_per_launch' | 'custom'

export interface HttpConfigState {
  mode: HttpProfileMode
  profileId: string
  customProfile: HttpProfile | null
}

const TOUCHGAL_ORIGIN = 'https://www.touchgal.top'
const TOUCHGAL_REFERER = `${TOUCHGAL_ORIGIN}/`

export const HTTP_PROFILES: HttpProfile[] = [
  {
    id: 'chrome-win-120',
    label: 'Chrome 120 / Windows',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8',
    origin: TOUCHGAL_ORIGIN,
    referer: TOUCHGAL_REFERER
  },
  {
    id: 'chrome-linux-120',
    label: 'Chrome 120 / Linux',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8',
    origin: TOUCHGAL_ORIGIN,
    referer: TOUCHGAL_REFERER
  },
  {
    id: 'edge-win-120',
    label: 'Edge 120 / Windows',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8',
    origin: TOUCHGAL_ORIGIN,
    referer: TOUCHGAL_REFERER
  }
]

export const defaultHttpConfigState = (): HttpConfigState => ({
  mode: 'fixed',
  profileId: HTTP_PROFILES[0].id,
  customProfile: null
})

export const getHttpProfileById = (profileId: string) =>
  HTTP_PROFILES.find((profile) => profile.id === profileId) ?? HTTP_PROFILES[0]

export const sanitizeHttpProfile = (profile: Partial<HttpProfile>): HttpProfile => ({
  id: typeof profile.id === 'string' && profile.id.trim() ? profile.id.trim() : 'custom',
  label: typeof profile.label === 'string' && profile.label.trim() ? profile.label.trim() : 'Custom Profile',
  userAgent:
    typeof profile.userAgent === 'string' && profile.userAgent.trim()
      ? profile.userAgent.trim()
      : HTTP_PROFILES[0].userAgent,
  acceptLanguage:
    typeof profile.acceptLanguage === 'string' && profile.acceptLanguage.trim()
      ? profile.acceptLanguage.trim()
      : HTTP_PROFILES[0].acceptLanguage,
  origin: TOUCHGAL_ORIGIN,
  referer: TOUCHGAL_REFERER
})

export const resolveHttpProfile = (
  config: HttpConfigState,
  random: () => number = Math.random
): HttpProfile => {
  if (config.mode === 'custom' && config.customProfile) {
    return sanitizeHttpProfile(config.customProfile)
  }

  if (config.mode === 'rotate_per_launch') {
    const index = Math.floor(random() * HTTP_PROFILES.length)
    return HTTP_PROFILES[index] ?? HTTP_PROFILES[0]
  }

  return getHttpProfileById(config.profileId)
}

export const buildTouchGalBaseHeaders = (profile: HttpProfile) => ({
  'Content-Type': 'application/json',
  'User-Agent': profile.userAgent,
  'Accept-Language': profile.acceptLanguage,
  Referer: profile.referer,
  Origin: profile.origin
})
