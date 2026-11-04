/** Định dạng json3 của YouTube (chỉ các trường dùng tới). */
interface Json3 {
  events?: {
    tStartMs?: number
    dDurationMs?: number
    aAppend?: number
    segs?: { utf8?: string; tOffsetMs?: number }[]
  }[]
}

export interface RawEvent {
  start: number
  end: number
  text: string
}

export interface Word {
  t: number
  text: string
}

export function parseJson3(body: string): Json3 {
  try {
    return JSON.parse(body) as Json3
  } catch {
    return {}
  }
}

/** Phụ đề do người đăng: mỗi event là một cue. */
export function toEvents(j: Json3): RawEvent[] {
  const out: RawEvent[] = []
  for (const ev of j.events ?? []) {
    if (!ev.segs || ev.aAppend) continue
    const text = ev.segs.map((s) => s.utf8 ?? '').join('')
    const start = (ev.tStartMs ?? 0) / 1000
    out.push({ start, end: start + (ev.dDurationMs ?? 0) / 1000, text })
  }
  return out
}

/** Phụ đề tự tạo: tách ra từng từ có mốc thời gian tuyệt đối. */
export function toWords(j: Json3): Word[] {
  const words: Word[] = []
  for (const ev of j.events ?? []) {
    if (!ev.segs || ev.aAppend) continue
    const base = ev.tStartMs ?? 0
    for (const s of ev.segs) {
      const text = s.utf8
      if (!text || !text.trim()) continue
      words.push({ t: (base + (s.tOffsetMs ?? 0)) / 1000, text })
    }
  }
  return words
}

