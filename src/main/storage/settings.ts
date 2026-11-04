import { app, safeStorage } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProviderId, SettingsUpdate, SettingsView } from '../../shared/types'
import { DEFAULT_CLAUDE_MODEL } from '../translate/claude'

/** API key chỉ nằm ở main process; mã hoá bằng safeStorage (DPAPI/Keychain) nếu hệ điều hành hỗ trợ. */
interface StoredSecret {
  enc: boolean
  v: string
}

interface StoredSettings {
  provider: ProviderId
  deeplKey?: StoredSecret
  claudeKey?: StoredSecret
  claudeModel: string
}

const file = (): string => join(app.getPath('userData'), 'settings.json')
let cache: StoredSettings | null = null

const seal = (s: string): StoredSecret =>
  safeStorage.isEncryptionAvailable()
    ? { enc: true, v: safeStorage.encryptString(s).toString('base64') }
    : { enc: false, v: s }

const unseal = (s?: StoredSecret): string => {
  if (!s) return ''
  try {
    return s.enc ? safeStorage.decryptString(Buffer.from(s.v, 'base64')) : s.v
  } catch {
    return ''
  }
}

async function load(): Promise<StoredSettings> {
  if (cache) return cache
  try {
    cache = { provider: 'google', claudeModel: DEFAULT_CLAUDE_MODEL, ...JSON.parse(await readFile(file(), 'utf8')) }
  } catch {
    cache = { provider: 'google', claudeModel: DEFAULT_CLAUDE_MODEL }
  }
  return cache as StoredSettings
}

async function persist(s: StoredSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(`${file()}.tmp`, JSON.stringify(s, null, 2), 'utf8')
  await rename(`${file()}.tmp`, file())
}

export async function getSettingsView(): Promise<SettingsView> {
  const s = await load()
  return {
    provider: s.provider,
    hasDeeplKey: !!unseal(s.deeplKey),
    hasClaudeKey: !!unseal(s.claudeKey),
    claudeModel: s.claudeModel
  }
}

export async function updateSettings(u: SettingsUpdate): Promise<SettingsView> {
  const s = await load()
  if (u.provider && ['google', 'deepl', 'claude'].includes(u.provider)) s.provider = u.provider
  if (u.deeplKey !== undefined) s.deeplKey = u.deeplKey.trim() ? seal(u.deeplKey.trim()) : undefined
  if (u.claudeKey !== undefined) s.claudeKey = u.claudeKey.trim() ? seal(u.claudeKey.trim()) : undefined
  if (u.claudeModel !== undefined) s.claudeModel = u.claudeModel.trim() || DEFAULT_CLAUDE_MODEL
  await persist(s)
  return getSettingsView()
}

/** Dùng nội bộ trong main để tạo provider; không bao giờ gửi sang renderer. */
export async function getSecrets(): Promise<{ provider: ProviderId; deeplKey: string; claudeKey: string; claudeModel: string }> {
  const s = await load()
  return { provider: s.provider, deeplKey: unseal(s.deeplKey), claudeKey: unseal(s.claudeKey), claudeModel: s.claudeModel }
}

