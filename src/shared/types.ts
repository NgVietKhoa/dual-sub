/** Kiểu dùng chung giữa main, preload và renderer. */

/** Một câu phụ đề chuẩn hoá (đơn vị: giây). */
export interface Cue {
  start: number
  end: number
  text: string
}

export interface AppInfo {
  version: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export interface CaptionTrackInfo {
  /** Mã ngôn ngữ của track, ví dụ "en", "pt-BR" */
  lang: string
  name: string
  kind: 'manual' | 'asr'
}

export interface CaptionsPayload {
  videoId: string
  title: string
  /** Giây; 0 nếu không rõ */
  duration: number
  /** Ngôn ngữ nguồn = ngôn ngữ của track được chọn */
  lang: string
  langName: string
  kind: 'manual' | 'asr'
  cues: Cue[]
}

export type ProviderId = 'google' | 'deepl' | 'claude'

/** Cài đặt gửi cho renderer. Không bao giờ chứa API key. */
export interface SettingsView {
  provider: ProviderId
  hasDeeplKey: boolean
  hasClaudeKey: boolean
  claudeModel: string
}

/** Cập nhật cài đặt. Với key: chuỗi rỗng = xoá, undefined = giữ nguyên. */
export interface SettingsUpdate {
  provider?: ProviderId
  deeplKey?: string
  claudeKey?: string
  claudeModel?: string
}

export interface TranslateProgress {
  videoId: string
  to: string
  items: { i: number; text: string }[]
  /** Số câu đã có bản dịch / tổng số câu */
  done: number
  total: number
}

export interface TranslateDone {
  videoId: string
  to: string
  /** Có giá trị nếu dịch dừng giữa chừng vì lỗi (đã dịch được gì vẫn giữ nguyên). */
  error?: string
}

export interface WordDefinition {
  word: string
  ipa?: string
  pos?: string
  meaning: string
}

export interface SavedWord {
  id: string
  word: string
  ipa?: string
  pos?: string
  meaning: string
  example: string
  videoId: string
  timestamp: number
  createdAt: number
}

export interface WatchedVideo {
  videoId: string
  title: string
  /** Giây */
  duration: number
  /** Vị trí đang xem dở (giây) */
  position: number
  watchedAt: number
}

export interface ExportResult {
  canceled: boolean
  count: number
  filePath?: string
}

export interface UpdateStatus {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  newVersion?: string
  percent?: number
  message?: string
}

/** API do preload mở ra cho renderer qua contextBridge. */
export interface DualSubApi {
  getAppInfo(): Promise<AppInfo>
  /** preferredLang: "auto" hoặc mã ngôn ngữ do người dùng chọn */
  loadCaptions(videoId: string, preferredLang: string): Promise<IpcResult<CaptionsPayload>>
  /** Bắt đầu dịch (bản đã cache được gửi lại ngay, phần còn lại dịch nền). Kết quả về qua sự kiện. */
  translateStart(videoId: string, preferredLang: string, to: string): Promise<IpcResult<null>>
  translateCancel(): Promise<void>
  onTranslateProgress(cb: (p: TranslateProgress) => void): () => void
  onTranslateDone(cb: (d: TranslateDone) => void): () => void
  getSettings(): Promise<SettingsView>
  saveSettings(update: SettingsUpdate): Promise<IpcResult<SettingsView>>
  lookupWord(word: string, from: string, to: string): Promise<IpcResult<WordDefinition>>
  getSavedWords(): Promise<SavedWord[]>
  saveWord(data: Omit<SavedWord, 'id' | 'createdAt'>): Promise<IpcResult<SavedWord>>
  deleteWord(id: string): Promise<IpcResult<boolean>>
  exportAnkiCsv(): Promise<IpcResult<ExportResult>>
  getWatchedVideos(): Promise<WatchedVideo[]>
  saveWatchedVideo(data: Omit<WatchedVideo, 'watchedAt'>): Promise<IpcResult<WatchedVideo>>
  deleteWatchedVideo(videoId: string): Promise<IpcResult<boolean>>
  checkForUpdates(): Promise<IpcResult<void>>
  downloadUpdate(): Promise<IpcResult<void>>
  installUpdate(): Promise<void>
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
}

export const IPC = {
  appInfo: 'app:info',
  captionsLoad: 'captions:load',
  translateStart: 'translate:start',
  translateCancel: 'translate:cancel',
  translateProgress: 'translate:progress',
  translateDone: 'translate:done',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  dictLookup: 'dict:lookup',
  wordsList: 'words:list',
  wordSave: 'word:save',
  wordDelete: 'word:delete',
  wordsExportAnki: 'words:exportAnki',
  watchedList: 'watched:list',
  watchedSave: 'watched:save',
  watchedDelete: 'watched:delete',
  updaterCheck: 'updater:check',
  updaterDownload: 'updater:download',
  updaterInstall: 'updater:install',
  updaterStatus: 'updater:status'
} as const
