import { app } from 'electron'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import type { AsrStatus } from '../../shared/types'

function isCommandInPath(cmd: string): boolean {
  try {
    const isWin = process.platform === 'win32'
    const checkCmd = isWin ? `where ${cmd}` : `which ${cmd}`
    execSync(checkCmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function safeAppPath(): string {
  try {
    return app?.getAppPath?.() || process.cwd()
  } catch {
    return process.cwd()
  }
}

function safeUserData(): string {
  try {
    return app?.getPath?.('userData') || join(process.cwd(), '.user_data')
  } catch {
    return join(process.cwd(), '.user_data')
  }
}

export function getBinDir(): string {
  // Ưu tiên resources/bin trong thư mục app hoặc userData
  const appPath = safeAppPath()
  const localRes = join(appPath, 'resources', 'bin')
  if (existsSync(localRes)) return localRes
  return join(safeUserData(), 'bin')
}

export function getModelsDir(): string {
  const appPath = safeAppPath()
  const localRes = join(appPath, 'resources', 'models')
  if (existsSync(localRes)) return localRes
  return join(safeUserData(), 'models')
}

export function findExecutable(name: string): string | null {
  const isWin = process.platform === 'win32'
  const exeName = isWin && !name.endsWith('.exe') ? `${name}.exe` : name

  // 1. Kiểm tra trong resources/bin của app
  const appBin = join(safeAppPath(), 'resources', 'bin', exeName)
  if (existsSync(appBin)) return appBin

  // 2. Kiểm tra trong userData/bin
  const userBin = join(safeUserData(), 'bin', exeName)
  if (existsSync(userBin)) return userBin

  // 3. Kiểm tra trong system PATH
  if (isCommandInPath(name)) return name

  return null
}

export function findWhisperModel(): string | null {
  const dirs = [
    join(safeAppPath(), 'resources', 'models'),
    join(safeUserData(), 'models')
  ]

  for (const d of dirs) {
    if (existsSync(d)) {
      try {
        const files = readdirSync(d).filter((f) => f.endsWith('.bin'))
        if (files.length > 0) {
          // Ưu tiên base > tiny > bất kỳ model nào
          const hit =
            files.find((f) => f.includes('base')) ||
            files.find((f) => f.includes('tiny')) ||
            files.find((f) => f.includes('small')) ||
            files[0]
          return join(d, hit)
        }
      } catch {}
    }
  }
  return null
}

export function getAsrStatus(): AsrStatus {
  const ffmpegPath = findExecutable('ffmpeg')
  const ytDlpPath = findExecutable('yt-dlp')
  const whisperPath =
    findExecutable('whisper-cli') ||
    findExecutable('main') ||
    findExecutable('whisper')

  const modelPath = findWhisperModel()

  return {
    hasFfmpeg: !!ffmpegPath,
    hasYtDlp: !!ytDlpPath,
    hasWhisper: !!whisperPath,
    hasModel: !!modelPath,
    modelPath: modelPath || undefined,
    binDir: getBinDir(),
    modelsDir: getModelsDir()
  }
}
