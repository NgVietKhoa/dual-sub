import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WatchedVideo } from '../../shared/types'

const MAX_VIDEOS = 50
const file = (): string => join(app.getPath('userData'), 'watched.json')
let cache: WatchedVideo[] | null = null

async function load(): Promise<WatchedVideo[]> {
  if (cache) return cache
  try {
    const raw = await readFile(file(), 'utf8')
    const parsed = JSON.parse(raw)
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache
}

async function persist(list: WatchedVideo[]): Promise<void> {
  cache = list
  await mkdir(app.getPath('userData'), { recursive: true })
  const tmp = `${file()}.tmp`
  await writeFile(tmp, JSON.stringify(list, null, 2), 'utf8')
  await rename(tmp, file())
}

export async function getWatchedVideos(): Promise<WatchedVideo[]> {
  return load()
}

/** Ghi tiến độ xem; video vừa xem đưa lên đầu, chỉ giữ MAX_VIDEOS video gần nhất. */
export async function saveWatchedVideo(data: Omit<WatchedVideo, 'watchedAt'>): Promise<WatchedVideo> {
  const list = await load()
  const entry: WatchedVideo = { ...data, watchedAt: Date.now() }
  await persist([entry, ...list.filter((v) => v.videoId !== data.videoId)].slice(0, MAX_VIDEOS))
  return entry
}

export async function deleteWatchedVideo(videoId: string): Promise<boolean> {
  const list = await load()
  const next = list.filter((v) => v.videoId !== videoId)
  if (next.length === list.length) return false
  await persist(next)
  return true
}
