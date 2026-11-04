/** Bọc YouTube IFrame Player API. Chỉ dùng controls của app, ẩn controls mặc định của YouTube. */

interface YTPlayer {
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setPlaybackRate(rate: number): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getVideoData(): { title?: string; video_id?: string }
  unloadModule(name: string): void
  destroy(): void
}

interface YTNamespace {
  Player: new (el: string | HTMLElement, opts: Record<string, unknown>) => YTPlayer
  PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export interface PlayerHandlers {
  onPlayingChange(playing: boolean): void
  onEnded(): void
  onError(message: string): void
  onReady(info: { title: string; duration: number }): void
}

const ERROR_MESSAGES: Record<number, string> = {
  2: 'Link video không hợp lệ.',
  5: 'Trình phát YouTube gặp lỗi HTML5. Thử mở lại video.',
  100: 'Không tìm thấy video: video đã bị xoá hoặc đặt ở chế độ riêng tư.',
  101: 'Chủ video không cho phép phát video này trong ứng dụng khác.',
  150: 'Chủ video không cho phép phát video này trong ứng dụng khác.',
  153: 'YouTube từ chối phát vì thiếu thông tin nguồn (referer). Hãy khởi động lại ứng dụng.'
}

let apiPromise: Promise<YTNamespace> | null = null

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT as YTNamespace)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.onerror = () => {
      apiPromise = null
      reject(new Error('Không tải được trình phát YouTube. Kiểm tra kết nối mạng.'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}

export class VideoPlayer {
  private yt: YTPlayer | null = null
  private ns: YTNamespace | null = null
  private pendingRate = 1

  constructor(
    private host: HTMLElement,
    private handlers: PlayerHandlers
  ) {}

  get ready(): boolean {
    return this.yt !== null
  }

  async load(videoId: string, startSeconds = 0): Promise<void> {
    this.ns ??= await loadApi()
    if (this.yt) {
      this.yt.loadVideoById({ videoId, startSeconds })
      return
    }
    const ns = this.ns
    await new Promise<void>((resolve) => {
      const mount = document.createElement('div')
      this.host.replaceChildren(mount)
      this.yt = new ns.Player(mount, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
          autoplay: 1,
          start: Math.floor(startSeconds),
          origin: window.location.origin,
          widget_referrer: window.location.href
        },
        events: {
          onReady: () => {
            this.yt?.setPlaybackRate(this.pendingRate)
            resolve()
          },
          onStateChange: (e: { data: number }) => this.onState(e.data),
          onError: (e: { data: number }) =>
            this.handlers.onError(ERROR_MESSAGES[e.data] ?? `Lỗi trình phát YouTube (mã ${e.data}).`)
        }
      })
    })
  }

  private onState(s: number): void {
    const S = this.ns?.PlayerState
    if (!S) return
    if (s === S.PLAYING) {
      // Tắt caption của chính YouTube để không trùng với phụ đề của app
      this.yt?.unloadModule('captions')
      this.handlers.onPlayingChange(true)
      const d = this.yt?.getVideoData()
      this.handlers.onReady({ title: d?.title ?? '', duration: this.yt?.getDuration() ?? 0 })
    } else if (s === S.PAUSED) {
      this.handlers.onPlayingChange(false)
    } else if (s === S.ENDED) {
      this.handlers.onPlayingChange(false)
      this.handlers.onEnded()
    }
  }

  play(): void {
    this.yt?.playVideo()
  }
  pause(): void {
    this.yt?.pauseVideo()
  }
  seek(t: number): void {
    this.yt?.seekTo(Math.max(0, t), true)
  }
  setRate(r: number): void {
    this.pendingRate = r
    this.yt?.setPlaybackRate(r)
  }
  time(): number {
    return this.yt?.getCurrentTime() ?? 0
  }
  duration(): number {
    return this.yt?.getDuration() ?? 0
  }
}

