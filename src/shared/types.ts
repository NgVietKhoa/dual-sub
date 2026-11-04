/** Kiểu dùng chung giữa main, preload và renderer. */

/** Một câu phụ đề chuẩn hoá (đơn vị: giây). */
export interface Cue {
  start: number
  end: number
  text: string
}

export interface AppInfo {
  version: string
  platform: string
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
  tracks: CaptionTrackInfo[]
  /** true nếu lấy từ cache trên đĩa (không gọi mạng) */
  fromCache?: boolean
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

export interface ExportResult {
  canceled: boolean
  count: number
  filePath?: string
}

export interface AsrStatus {
  hasFfmpeg: boolean
  hasYtDlp: boolean
  hasWhisper: boolean
  hasModel: boolean
  modelPath?: string
  binDir: string
  modelsDir: string
}

export interface AsrProgress {
  videoId: string
  stage: 'downloading' | 'converting' | 'transcribing'
  percent?: number
  message: string
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
  lookupWord(word: string, srcLang: string): Promise<IpcResult<WordDefinition>>
  getSavedWords(): Promise<SavedWord[]>
  saveWord(data: Omit<SavedWord, 'id' | 'createdAt'>): Promise<IpcResult<SavedWord>>
  deleteWord(id: string): Promise<IpcResult<boolean>>
  exportAnkiCsv(): Promise<IpcResult<ExportResult>>
  getAsrStatus(): Promise<AsrStatus>
  transcribeWithWhisper(videoId: string, lang?: string): Promise<IpcResult<CaptionsPayload>>
  onAsrProgress(cb: (p: AsrProgress) => void): () => void
}

export type SongNguApi = DualSubApi

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
  asrStatus: 'asr:status',
  asrTranscribe: 'asr:transcribe',
  asrProgress: 'asr:progress'
} as const
