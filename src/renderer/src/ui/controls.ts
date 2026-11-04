import { $, fmt } from './dom'
import { state, type SubMode } from './state'

const PLAY = '<path d="M8 5.5v13l11-6.5z"/>'
const PAUSE = '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'

export interface ControlActions {
  togglePlay(): void
  play(): void
  step(d: number): void
  toggleLoop(): void
  setSpeed(s: number): void
  setMode(m: SubMode): void
  seek(t: number): void
}

export function initControls(a: ControlActions): void {
  $('playBtn').onclick = a.togglePlay
  $('bigPlay').onclick = a.play
  $('shield').onclick = a.togglePlay
  $('prevBtn').onclick = () => a.step(-1)
  $('nextBtn').onclick = () => a.step(1)
  $('loopBtn').onclick = a.toggleLoop

  $('speedCtl').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (b) a.setSpeed(Number(b.dataset.s))
  }
  $('modeCtl').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button')
    if (b) a.setMode(b.dataset.m as SubMode)
  }

  const track = $('track')
  track.onclick = (e) => {
    if (!state.duration) return
    const r = track.getBoundingClientRect()
    a.seek(((e.clientX - r.left) / r.width) * state.duration)
  }
  track.onkeydown = (e) => {
    if (e.key === 'ArrowRight') {
      a.seek(state.t + 5)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      a.seek(state.t - 5)
      e.preventDefault()
    }
  }
}

export function renderPlaying(): void {
  $('playIcon').innerHTML = state.playing ? PAUSE : PLAY
  $('playBtn').setAttribute('aria-label', state.playing ? 'Dừng' : 'Phát')
  $('bigPlay').hidden = state.playing || !state.videoId
}

export function renderTime(): void {
  const d = state.duration || 0
  const p = d ? Math.min(100, (state.t / d) * 100) : 0
  $('fill').style.width = p + '%'
  $('knob').style.left = p + '%'
  $('time').textContent = `${fmt(state.t)} / ${fmt(d)}`
  const track = $('track')
  track.setAttribute('aria-valuenow', String(Math.floor(state.t)))
  track.setAttribute('aria-valuemax', String(Math.floor(d)))
}

/** Vạch đánh dấu đầu mỗi câu trên thanh tua. */
export function renderSegments(): void {
  const segs = $('segs')
  const d = state.duration
  segs.innerHTML = d
    ? state.lines
        .map((l) => `<div class="seg" style="left:${(l.s / d) * 100}%"></div>`)
        .join('')
    : ''
}

export function renderSpeed(): void {
  for (const b of $('speedCtl').children)
    b.setAttribute('aria-pressed', String(Number((b as HTMLElement).dataset.s) === state.speed))
}

export function renderMode(): void {
  for (const b of $('modeCtl').children)
    b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.m === state.mode))
}

export function renderLoop(): void {
  $('loopBtn').setAttribute('aria-pressed', String(state.loop))
}

