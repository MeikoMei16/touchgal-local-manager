import fs from 'node:fs'

/**
 * Clean a folder name to improve matching accuracy.
 * Removes common tags in brackets [], parentheses (), and special characters.
 */
export function cleanFolderName(folderName: string): string {
  return folderName
    .replace(/\[.*?\]/g, '') // Remove [Tags]
    .replace(/\(.*?\)/g, '') // Remove (Info)
    .replace(/[_\-.]/g, ' ') // Replace separators with spaces
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim()
}

/**
 * Discover executable files within a directory, filtering out common non-game EXEs.
 */
export async function discoverExecutables(dirPath: string): Promise<string[]> {
  const exes: string[] = []
  try {
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const blackList = [
      'unins000.exe', 'unins001.exe', 'Setup.exe', 'Install.exe', 
      'dxwebsetup.exe', 'vcredist_x86.exe', 'vcredist_x64.exe',
      'UnityCrashHandler64.exe', 'UnityCrashHandler32.exe'
    ]

    for (const file of files) {
      if (file.isFile() && file.name.toLowerCase().endsWith('.exe')) {
        if (!blackList.some(b => file.name.toLowerCase() === b.toLowerCase())) {
          exes.push(file.name)
        }
      }
    }
  } catch (err) {
    console.error('[Utils] Failed to scan for EXEs:', err)
  }
  return exes
}
