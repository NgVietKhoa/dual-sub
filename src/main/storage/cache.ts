import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CaptionsPayload } from '../../shared/types'

/** Cache transcript + bản dịch theo videoId, lưu JSON trong userData/cache. */
export interface CacheEntry {
  version: 1
  videoId: string
  /** "auto" hoặc ngôn ngữ nguồn người dùng đã chọn khi tải */
  preferred: string
  payload: CaptionsPayload
  /** Theo ngôn ngữ đích. Mỗi phần tử ứng với một cue; '' = chưa dịch. */
  translations: Record<string, string[]>
  savedAt: number
}

const memory = new Map<string, CacheEntry>()
const key = (videoId: string, preferred: string): string => `${videoId}__${preferred.replace(/[^\w-]/g, '_')}`
const dir = (): string => join(app.getPath('userData'), 'cache')

export async function getEntry(videoId: string, preferred: string): Promise<CacheEntry | null> {
  const k = key(videoId, preferred)
  const hit = memory.get(k)
  if (hit) return hit
  try {
    const entry = JSON.parse(await readFile(join(dir(), `${k}.json`), 'utf8')) as CacheEntry
    if (entry.version !== 1 || !entry.payload?.cues?.length) return null
    memory.set(k, entry)
    return entry
  } catch {
    return null
  }
}

/** Ghi qua file tạm rồi đổi tên để tránh hỏng file khi tắt app giữa chừng. */
export async function saveEntry(entry: CacheEntry): Promise<void> {
  const k = key(entry.videoId, entry.preferred)
  entry.savedAt = Date.now()
  memory.set(k, entry)
  try {
    await mkdir(dir(), { recursive: true })
    const file = join(dir(), `${k}.json`)
    await writeFile(`${file}.tmp`, JSON.stringify(entry), 'utf8')
    await rename(`${file}.tmp`, file)
  } catch (e) {
    console.error('[cache] không ghi được cache:', e) // cache lỗi không được làm hỏng luồng chính
  }
}

