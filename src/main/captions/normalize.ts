import type { Cue } from '../../shared/types'
import type { RawEvent, Word } from './parse'

const TERMINAL = /[.?!…。？！]["'”’)\]]*$/
const ABBREV = /^(mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|inc|ltd|no)\.$|^[A-Za-z]\.$|^(e\.g|i\.e|u\.s)\.?$/i
const MAX_SENTENCE_SEC = 12
const MAX_SENTENCE_CHARS = 180
const PAUSE_SEC = 0.9
const LAST_WORD_SEC = 0.8

export const clean = (s: string): string =>
  s
    .replace(/\u200b/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const endsSentence = (text: string): boolean => TERMINAL.test(text.trim()) && !ABBREV.test(text.trim())

/** Cắt end không vượt quá start của câu kế tiếp, đảm bảo end > start. */
function fixTiming(cues: Cue[]): Cue[] {
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1]
    if (next && cues[i].end > next.start) cues[i].end = next.start
    if (cues[i].end <= cues[i].start) cues[i].end = cues[i].start + 0.5
  }
  return cues
}

function dropDuplicates(cues: Cue[]): Cue[] {
  const out: Cue[] = []
  for (const c of cues) {
    const prev = out[out.length - 1]
    if (prev && prev.text === c.text && c.start <= prev.end + 0.5) {
      prev.end = Math.max(prev.end, c.end)
      continue
    }
    out.push(c)
  }
  return out
}

/** Phụ đề người đăng: làm sạch, bỏ trùng, ghép các cue bị ngắt giữa câu. */
export function normalizeManual(events: RawEvent[]): Cue[] {
  const base: Cue[] = events
    .map((e) => ({ start: e.start, end: e.end, text: clean(e.text) }))
    .filter((c) => c.text)
    .sort((a, b) => a.start - b.start)

  const merged: Cue[] = []
  for (const c of dropDuplicates(base)) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      !endsSentence(prev.text) &&
      c.start - prev.end < 0.3 &&
      c.end - prev.start <= 8 &&
      prev.text.length + c.text.length < 140
    ) {
      prev.text = `${prev.text} ${c.text}`
      prev.end = Math.max(prev.end, c.end)
    } else {
      merged.push({ ...c })
    }
  }
  return fixTiming(merged)
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef\u3000-\u303f]/

/**
 * Nối từ. Từ đầu mỗi event của YouTube thường không có khoảng trắng đứng trước,
 * nên cần tự chèn khoảng trắng — trừ khi hai bên là chữ CJK (tiếng Nhật/Trung/Hàn không cách từ).
 */
function joinWords(words: Word[]): string {
  let out = ''
  for (const w of words) {
    if (out && !/\s$/.test(out) && !/^\s/.test(w.text)) {
      const a = out[out.length - 1]
      const b = w.text[0]
      if (!(CJK.test(a) || CJK.test(b))) out += ' '
    }
    out += w.text
  }
  return clean(out)
}


/**
 * Phụ đề tự tạo (ASR): bỏ từ trùng do cửa sổ cuộn, rồi gộp thành câu hoàn chỉnh
 * dựa trên dấu câu, khoảng lặng và độ dài tối đa.
 */
export function normalizeAsr(input: Word[]): Cue[] {
  const words = [...input].sort((a, b) => a.t - b.t)

  // 1. bỏ từ trùng
  const uniq: Word[] = []
  for (const w of words) {
    const p = uniq[uniq.length - 1]
    if (p && w.text.trim() === p.text.trim() && Math.abs(w.t - p.t) < 0.3) continue
    uniq.push(w)
  }

  // 2. gom câu
  const cues: Cue[] = []
  let cur: Word[] = []
  const flush = (nextStart?: number): void => {
    if (!cur.length) return
    const text = joinWords(cur)
    if (text) {
      const start = cur[0].t
      const last = cur[cur.length - 1]
      let end = last.t + LAST_WORD_SEC
      if (nextStart !== undefined && end > nextStart) end = nextStart
      cues.push({ start, end, text })
    }
    cur = []
  }

  for (let i = 0; i < uniq.length; i++) {
    const w = uniq[i]
    const next = uniq[i + 1]
    cur.push(w)

    const chars = cur.reduce((n, x) => n + x.text.length, 0)
    const dur = w.t - cur[0].t
    const gap = next ? next.t - w.t : Infinity

    const brk =
      endsSentence(w.text) ||
      (gap > PAUSE_SEC && cur.length >= 3) ||
      dur > MAX_SENTENCE_SEC ||
      chars > MAX_SENTENCE_CHARS
    if (brk) flush(next?.t)
  }
  flush()

  return fixTiming(dropDuplicates(cues))
}
