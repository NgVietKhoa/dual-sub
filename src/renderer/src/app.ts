import { parseVideoLink } from '@shared/videoId'
import { $ } from './ui/dom'
import { idxAt, lastLineStartedBy, state, type Line, type SubMode } from './ui/state'
import { VideoPlayer } from './ui/player'
import { toast } from './ui/toast'
import { renderSubs } from './ui/subtitleOverlay'
import { initCurrentLine, onWordClick, renderNow, setSourceChip } from './ui/currentLine'
import {
  initTranscript,
  renderFoot,
  renderTranscript,
  setActiveLine,
  updateItemsTranslation
} from './ui/transcriptPanel'
import {
  initControls,
  renderLoop,
  renderMode,
  renderPlaying,
  renderSegments,
  renderSpeed,
  renderTime
} from './ui/controls'
import { initTopbar, setDetectedLang } from './ui/topbar'
import { initShortcuts } from './ui/shortcuts'
import { initTabs } from './ui/tabs'
import { initSettings } from './ui/settingsDialog'
import { closeWordPopup, initWordPopup, showWordPopup } from './ui/wordPopup'
import { addWord, initSavedWords, isWordSaved } from './ui/savedWords'

const player = new VideoPlayer($('ytHost'), {
  onPlayingChange(playing) {
    state.playing = playing
    if (playing && state.loop && state.loopIdx < 0) state.loopIdx = Math.max(0, idxAt(state.t))
    renderPlaying()
  },
  onEnded() {
    renderPlaying()
  },
  onError(message) {
    state.playing = false
    $('placeholder').textContent = message
    $('placeholder').hidden = false
    renderPlaying()
    toast(message, 5000)
  },
  onReady({ title, duration }) {
    if (title && title !== state.title) {
      state.title = title
      $('stageTitle').textContent = title
      $('stageTitle').hidden = false
    }
    if (duration && duration !== state.duration) {
      state.duration = duration
      renderSegments()
      renderTime()
      renderFoot()
    }
  }
})

/** Phase 2 sẽ gọi hàm này khi có transcript. */
export function setLines(lines: Line[]): void {
  state.lines = lines
  state.idx = -1
  state.loopIdx = -1
  renderTranscript()
  renderSegments()
  setActive(idxAt(state.t), true)
}

function setActive(i: number, force = false): void {
  if (i === state.idx && !force) return
  state.idx = i
  setActiveLine(i)
  renderSubs()
  renderNow()
}

function seek(t: number): void {
  const max = state.duration || Infinity
  state.t = Math.min(Math.max(0, t), max)
  player.seek(state.t)
  lastSeekAt = performance.now()
  const i = idxAt(state.t)
  if (state.loop && i >= 0) state.loopIdx = i
  setActive(i)
  renderTime()
  renderNow()
}

function play(): void {
  if (!state.videoId) return toast('Hãy dán link YouTube và bấm “Mở video” trước.')
  player.play()
}

function togglePlay(): void {
  if (!state.videoId) return play()
  if (state.playing) player.pause()
  else player.play()
}

function step(d: number): void {
  const L = state.lines
  if (!L.length) return
  let cur = state.idx
  if (cur < 0) {
    cur = lastLineStartedBy(state.t)
    if (d > 0) cur = Math.max(cur, -1)
    else cur += 1
  }
  let n = Math.min(L.length - 1, Math.max(0, cur + d))
  // Bấm "câu trước" khi đã nghe quá 1.5s → quay về đầu câu hiện tại
  if (d < 0 && state.idx >= 0 && state.t - L[state.idx].s > 1.5) n = state.idx
  seek(L[n].s + 0.01)
  if (!state.playing) player.play()
}

function toggleLoop(): void {
  state.loop = !state.loop
  state.loopIdx = state.loop
    ? Math.max(0, state.idx >= 0 ? state.idx : lastLineStartedBy(state.t))
    : -1
  renderLoop()
  if (state.loop && !state.lines.length) {
    state.loop = false
    state.loopIdx = -1
    renderLoop()
    return toast('Chưa có phụ đề để lặp câu.')
  }
  toast(state.loop ? `Đang lặp câu ${state.loopIdx + 1}` : 'Đã tắt lặp câu')
}

function setSpeed(s: number): void {
  state.speed = s
  player.setRate(s)
  renderSpeed()
}

function setMode(m: SubMode): void {
  state.mode = m
  renderMode()
  renderSubs()
}

async function openVideo(link: string, startAt?: number): Promise<void> {
  const parsed = parseVideoLink(link)
  if (!parsed) {
    return toast('Link chưa đúng dạng YouTube. Thử youtube.com/watch?v=…, youtu.be/… hoặc youtube.com/shorts/…', 4500)
  }
  const startSeconds = startAt ?? parsed.startSeconds
  state.videoId = parsed.videoId
  state.title = ''
  state.t = startSeconds
  state.duration = 0
  state.playing = false
  state.emptyMsg = 'Đang tải phụ đề…'
  setSourceChip(null)
  $('stageTitle').hidden = true
  $('placeholder').hidden = true
  $('retryBtn').hidden = true
  $('whisperBox').hidden = true
  void window.api.translateCancel()
  setLines([])
  renderTime()
  renderPlaying()
  void loadCaptions(parsed.videoId)
  try {
    await player.load(parsed.videoId, startSeconds)
    player.setRate(state.speed)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Không mở được video.'
    $('placeholder').textContent = msg
    $('placeholder').hidden = false
    toast(msg, 5000)
  }
}

/** Phase 2: lấy phụ đề qua main process (YouTube.js) rồi đổ vào giao diện. */
async function loadCaptions(videoId: string): Promise<void> {
  const preferred = $<HTMLSelectElement>('srcLang').value
  const res = await window.api.loadCaptions(videoId, preferred)
  if (state.videoId !== videoId) return // người dùng đã mở video khác
  if (!res.ok) {
    state.emptyMsg = res.error.message
    setLines([])
    toast(res.error.message, 6000)
    if (res.error.code === 'NO_CAPTIONS') {
      $('whisperBox').hidden = false
      $('whisperMsg').textContent = 'Video này không có phụ đề trên YouTube.'
      $<HTMLButtonElement>('whisperBtn').disabled = false
      $<HTMLButtonElement>('whisperBtn').textContent = 'Tạo phụ đề bằng Whisper (AI)'
    } else {
      $('whisperBox').hidden = true
    }
    return
  }
  $('whisperBox').hidden = true
  const d = res.data
  state.emptyMsg = ''
  if (!state.duration && d.duration) state.duration = d.duration
  if (d.title && !state.title) {
    state.title = d.title
    $('stageTitle').textContent = d.title
    $('stageTitle').hidden = false
  }
  setDetectedLang(d.lang.split('-')[0])
  setSourceChip(
    d.kind === 'manual'
      ? `Phụ đề gốc từ người đăng · ${d.langName}`
      : `Phụ đề tự tạo (ASR) · ${d.langName}`
  )
  setLines(d.cues.map((c) => ({ s: c.start, e: c.end, en: c.text, vi: '' })))
  renderTime()
  void startTranslation(videoId)
}

async function handleWhisperTranscribe(): Promise<void> {
  if (!state.videoId) return
  const whisperBtn = $<HTMLButtonElement>('whisperBtn')
  const status = await window.api.getAsrStatus()
  if (!status.hasFfmpeg || !status.hasYtDlp || !status.hasWhisper || !status.hasModel) {
    toast('Chưa đủ công cụ Whisper AI (yt-dlp, whisper.cpp hoặc model). Mở Cài đặt để xem chi tiết.', 6000)
    $('settingsBtn').click()
    return
  }

  whisperBtn.disabled = true
  whisperBtn.textContent = 'Đang nhận dạng...'
  $('whisperMsg').textContent = 'Đang khởi động Whisper AI...'

  const res = await window.api.transcribeWithWhisper(state.videoId)
  if (!res.ok) {
    whisperBtn.disabled = false
    whisperBtn.textContent = 'Thử lại bằng Whisper'
    $('whisperMsg').textContent = res.error.message
    toast(res.error.message, 6000)
    return
  }

  const d = res.data
  $('whisperBox').hidden = true
  state.emptyMsg = ''
  if (!state.duration && d.duration) state.duration = d.duration
  setDetectedLang(d.lang.split('-')[0])
  setSourceChip(`Phụ đề nhận dạng từ Whisper AI · ${d.langName}`)
  setLines(d.cues.map((c) => ({ s: c.start, e: c.end, en: c.text, vi: '' })))
  renderTime()
  void startTranslation(state.videoId)
  toast('Đã tạo phụ đề bằng Whisper AI thành công!')
}

async function startTranslation(videoId: string): Promise<void> {
  $('retryBtn').hidden = true
  const preferred = $<HTMLSelectElement>('srcLang').value
  const dst = $<HTMLSelectElement>('dstLang').value
  const res = await window.api.translateStart(videoId, preferred, dst)
  if (state.videoId !== videoId) return
  if (!res.ok) {
    toast(res.error.message, 5000)
    $('retryBtn').hidden = false
  }
}


let lastSeekAt = 0
function tick(): void {
  if (player.ready && state.playing) {
    let t = player.time()
    if (state.loop && state.loopIdx >= 0 && performance.now() - lastSeekAt > 400) {
      const l = state.lines[state.loopIdx]
      if (l && t >= l.e - 0.03) {
        t = l.s
        player.seek(t)
        lastSeekAt = performance.now()
      }
    }
    state.t = t
    setActive(idxAt(t))
    renderTime()
  }
  requestAnimationFrame(tick)
}

let lastSrcLang = 'auto'
let lastDstLang = 'vi'

export function startApp(): void {
  initTopbar({
    onSubmit: (link) => void openVideo(link),
    onLangChange: (src, dst) => {
      if (!state.videoId) {
        lastSrcLang = src
        lastDstLang = dst
        return
      }
      if (src !== lastSrcLang) {
        lastSrcLang = src
        lastDstLang = dst
        state.emptyMsg = 'Đang tải phụ đề…'
        setLines([])
        void loadCaptions(state.videoId)
      } else if (dst !== lastDstLang) {
        lastDstLang = dst
        for (const l of state.lines) l.vi = ''
        renderTranscript()
        renderSubs()
        renderNow()
        void startTranslation(state.videoId)
      }
    }
  })
  initControls({ togglePlay, play, step, toggleLoop, setSpeed, setMode, seek })
  initTranscript((i) => {
    seek(state.lines[i].s + 0.01)
    if (!state.playing) player.play()
  })
  initCurrentLine()
  initTabs()
  initSettings()
  initWordPopup()
  void initSavedWords((w) => {
    if (w.videoId && w.videoId !== state.videoId) {
      void openVideo(w.videoId, w.timestamp)
    } else {
      seek(w.timestamp)
      if (!state.playing) player.play()
    }
  })

  onWordClick((w) => {
    const line = state.lines[w.lineIdx]
    if (!line) return
    const srcLang = $<HTMLSelectElement>('srcLang').value
    void showWordPopup({
      word: w.word,
      context: line.en,
      videoId: state.videoId || '',
      timestamp: line.s,
      srcLang,
      targetEl: w.el,
      isSaved: isWordSaved(w.word),
      onSave: async (def) => {
        await addWord(def, line.en, state.videoId || '', line.s)
      }
    })
  })

  initShortcuts({
    togglePlay,
    step,
    toggleLoop,
    escape: () => closeWordPopup()
  })

  $('retryBtn').onclick = () => {
    if (state.videoId) void startTranslation(state.videoId)
  }

  $('whisperBtn').onclick = () => void handleWhisperTranscribe()

  window.api.onAsrProgress((p) => {
    if (p.videoId === state.videoId) {
      $('whisperMsg').textContent = p.message
    }
  })

  window.api.onTranslateProgress((p) => {
    if (p.videoId !== state.videoId) return
    let updatedAny = false
    for (const it of p.items) {
      if (state.lines[it.i]) {
        state.lines[it.i].vi = it.text
        updatedAny = true
      }
    }
    if (updatedAny) {
      updateItemsTranslation(p.items)
      renderSubs()
      renderNow()
    }
  })

  window.api.onTranslateDone((d) => {
    if (d.videoId !== state.videoId) return
    if (d.error) {
      toast(d.error, 6000)
      $('retryBtn').hidden = false
    } else {
      $('retryBtn').hidden = true
    }
  })

  renderPlaying()
  renderTime()
  renderSpeed()
  renderMode()
  renderTranscript()
  requestAnimationFrame(tick)
}

