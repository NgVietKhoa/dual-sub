import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SavedWord } from '../../shared/types'

const file = (): string => join(app.getPath('userData'), 'words.json')
let cache: SavedWord[] | null = null

async function load(): Promise<SavedWord[]> {
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

async function persist(list: SavedWord[]): Promise<void> {
  cache = list
  await mkdir(app.getPath('userData'), { recursive: true })
  const tmp = `${file()}.tmp`
  await writeFile(tmp, JSON.stringify(list, null, 2), 'utf8')
  await rename(tmp, file())
}

export async function getSavedWords(): Promise<SavedWord[]> {
  return load()
}

export async function saveWord(data: Omit<SavedWord, 'id' | 'createdAt'>): Promise<SavedWord> {
  const list = await load()
  const key = data.word.toLowerCase()
  const existing = list.find((w) => w.word.toLowerCase() === key)
  if (existing) {
    // Cập nhật thông tin mới nhất
    existing.ipa = data.ipa || existing.ipa
    existing.pos = data.pos || existing.pos
    existing.meaning = data.meaning || existing.meaning
    existing.example = data.example || existing.example
    existing.videoId = data.videoId || existing.videoId
    existing.timestamp = data.timestamp ?? existing.timestamp
    await persist(list)
    return existing
  }

  const newWord: SavedWord = {
    id: randomUUID(),
    createdAt: Date.now(),
    ...data
  }
  list.unshift(newWord)
  await persist(list)
  return newWord
}

export async function deleteWord(id: string): Promise<boolean> {
  const list = await load()
  const idx = list.findIndex((w) => w.id === id)
  if (idx === -1) return false
  list.splice(idx, 1)
  await persist(list)
  return true
}

