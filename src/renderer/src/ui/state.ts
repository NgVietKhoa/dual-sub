/** Trạng thái dùng chung của renderer. */
export interface Line {
  s: number
  e: number
  en: string
  /** Bản dịch; rỗng nếu chưa dịch xong. */
  vi: string
}

export type SubMode = 'both' | 'orig' | 'vi' | 'veil' | 'off'

export interface State {
  videoId: string | null
  title: string
  /** Ngôn ngữ của phụ đề đang hiện (đã nhận diện), dùng khi tra từ. */
  lang: string
  lines: Line[]
  duration: number
  t: number
  playing: boolean
  speed: number
  loop: boolean
  loopIdx: number
  mode: SubMode
  idx: number
  /** Thông báo hiện ở transcript / "Câu đang nói" khi chưa có phụ đề. */
  emptyMsg: string
}

export const state: State = {
  videoId: null,
  title: '',
  lang: '',
  lines: [],
  duration: 0,
  t: 0,
  playing: false,
  speed: 1,
  loop: false,
  loopIdx: -1,
  mode: 'both',
  idx: -1,
  emptyMsg: ''
}

/** Chỉ số câu chứa thời điểm t, hoặc -1 nếu đang ở khoảng lặng. */
export function idxAt(t: number): number {
  const L = state.lines
  let lo = 0
  let hi = L.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (t < L[mid].s) hi = mid - 1
    else if (t >= L[mid].e) lo = mid + 1
    else return mid
  }
  return -1
}

/** Câu bắt đầu gần nhất trước hoặc tại t (-1 nếu chưa tới câu nào). */
export function lastLineStartedBy(t: number): number {
  let r = -1
  for (let i = 0; i < state.lines.length; i++) {
    if (state.lines[i].s <= t) r = i
    else break
  }
  return r
}

