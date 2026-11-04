import { $ } from './dom'
import { state } from './state'

/** Phụ đề song ngữ đè lên video. */
export function renderSubs(): void {
  const o = $('subO')
  const v = $('subV')
  const l = state.lines[state.idx]
  const m = state.mode
  o.hidden = !l || m === 'vi' || m === 'off'
  // Chưa có bản dịch thì không hiện khung trống
  v.hidden = !l || !l.vi || m === 'orig' || m === 'off'
  if (l) {
    o.textContent = l.en
    v.textContent = l.vi
    v.classList.toggle('veil', m === 'veil')
  }
}

