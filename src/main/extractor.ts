import { execFileSync } from 'node:child_process'

export interface ExtractorCandidateStatus {
  name: string
  path: string
  detected: boolean
  supported: boolean
}

export interface ExtractorStatus {
  found: boolean
  path: string | null
  name: string | null
  supported: boolean
  candidates: ExtractorCandidateStatus[]
}

export type SupportedExtractorKind = 'bandizip' | '7zip'

export interface SupportedExtractor {
  kind: SupportedExtractorKind
  name: string
  path: string
}

const BANDIZIP_CANDIDATES = [
  'C:\\Program Files\\Bandizip\\bz.exe',
  'C:\\Program Files (x86)\\Bandizip\\bz.exe',
  'bz',
]

const SEVEN_ZIP_CANDIDATES = [
  'C:\\Program Files\\7-Zip\\7z.exe',
  'C:\\Program Files (x86)\\7-Zip\\7z.exe',
  '7z',
]

const commandExists = (command: string) => {
  try {
    execFileSync(command, [], { timeout: 3000, stdio: 'ignore' })
    return true
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      const code = (error as { code?: string | number }).code
      return code !== 'ENOENT' && code !== 'ENOTFOUND'
    }
    return false
  }
}

const findFirstAvailable = (candidates: string[]) => {
  for (const candidate of candidates) {
    if (commandExists(candidate)) {
      return candidate
    }
  }

  return null
}

export const findBandizipCli = () => findFirstAvailable(BANDIZIP_CANDIDATES)
export const findSevenZipCli = () => findFirstAvailable(SEVEN_ZIP_CANDIDATES)

export const findSupportedExtractor = (): SupportedExtractor | null => {
  const bandizipPath = findBandizipCli()
  if (bandizipPath) {
    return {
      kind: 'bandizip',
      name: 'Bandizip',
      path: bandizipPath,
    }
  }

  const sevenZipPath = findSevenZipCli()
  if (sevenZipPath) {
    return {
      kind: '7zip',
      name: '7-Zip',
      path: sevenZipPath,
    }
  }

  return null
}

export const getExtractorStatus = (): ExtractorStatus => {
  const bandizipPath = findBandizipCli()
  const sevenZipPath = findSevenZipCli()
  const selected = findSupportedExtractor()

  const candidates: ExtractorCandidateStatus[] = [
    {
      name: 'Bandizip CLI',
      path: bandizipPath ?? BANDIZIP_CANDIDATES[0],
      detected: Boolean(bandizipPath),
      supported: Boolean(bandizipPath),
    },
    {
      name: '7-Zip CLI',
      path: sevenZipPath ?? SEVEN_ZIP_CANDIDATES[0],
      detected: Boolean(sevenZipPath),
      supported: Boolean(sevenZipPath),
    }
  ]

  return {
    found: Boolean(selected),
    path: selected?.path ?? null,
    name: selected?.name ?? null,
    supported: Boolean(selected),
    candidates,
  }
}
