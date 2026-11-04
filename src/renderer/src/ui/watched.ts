import type { WatchedVideo } from '../../../shared/types'
import { $, esc, fmt } from './dom'
import { state } from './state'
import { setWatchedCount } from './tabs'
import { toast } from './toast'

/** Xem quá tỉ lệ này coi như đã xem xong, lần sau mở lại từ đầu. */
const FINISHED_RATIO = 0.95
const SAVE_EVERY_MS = 10000

let videos: WatchedVideo[] = []
let lastSavedAt = 0

const isFinished = (v: WatchedVideo): boolean => !!v.duration && v.position / v.duration > FINISHED_RATIO

export async function initWatched(onSelect: (v: WatchedVideo) => void): Promise<void> {
  $('hList').addEventListener('click', async (e) => {
    const target = e.target as HTMLElement
    const delBtn = target.closest<HTMLElement>('.x')
    if (delBtn) {
      e.stopPropagation()
      if (delBtn.dataset.id) await deleteWatchedVideo(delBtn.dataset.id)
      return
    }

    const id = target.closest<HTMLElement>('.watched-item')?.dataset.id
    const found = videos.find((v) => v.videoId === id)
    if (found) onSelect(found)
  })

  videos = await window.api.getWatchedVideos()
  renderWatchedList()
}

/** Vị trí xem tiếp của video; 0 nếu chưa xem hoặc đã xem xong. */
export function resumeTime(videoId: string): number {
  const v = videos.find((x) => x.videoId === videoId)
  return v && !isFinished(v) ? v.position : 0
}

/** Lưu tiến độ video đang mở. `force` = lưu ngay (dừng, đổi video); không thì tối đa 10 giây một lần. */
export async function recordProgress(force = false): Promise<void> {
  if (!state.videoId || !state.title) return
  if (!force && performance.now() - lastSavedAt < SAVE_EVERY_MS) return
  lastSavedAt = performance.now()
  const res = await window.api.saveWatchedVideo({
    videoId: state.videoId,
    title: state.title,
    duration: state.duration,
    position: state.t
  })
  if (!res.ok) return
  videos = [res.data, ...videos.filter((v) => v.videoId !== res.data.videoId)]
  renderWatchedList()
}

async function deleteWatchedVideo(videoId: string): Promise<void> {
  const res = await window.api.deleteWatchedVideo(videoId)
  if (!res.ok) return toast(res.error.message)
  videos = videos.filter((v) => v.videoId !== videoId)
  renderWatchedList()
}

function renderWatchedList(): void {
  setWatchedCount(videos.length)
  const list = $('hList')
  if (!videos.length) {
    list.innerHTML =
      '<div class="empty">Chưa xem video nào.<br>Video bạn mở sẽ được lưu ở đây để lần sau xem tiếp.</div>'
    return
  }

  list.innerHTML = videos
    .map((v) => {
      const pct = v.duration ? Math.min(100, (v.position / v.duration) * 100) : 0
      return `
    <div class="watched-item" data-id="${v.videoId}" title="Bấm để xem tiếp">
      <img src="https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg" alt="" loading="lazy" />
      <div class="info">
        <b>${esc(v.title)}</b>
        <span class="bar"><span style="width:${pct}%"></span></span>
        <span class="meta">${isFinished(v) ? 'Đã xem xong' : `${fmt(v.position)} / ${fmt(v.duration)}`}</span>
      </div>
      <button class="x" data-id="${v.videoId}" type="button" aria-label="Xoá ${esc(v.title)}">Xoá</button>
    </div>`
    })
    .join('')
}
