import { app, BrowserWindow, ipcMain, type WebContents } from 'electron'
import {
  IPC,
  type AppInfo,
  type CaptionsPayload,
  type IpcResult,
  type SavedWord,
  type SettingsUpdate
} from '../shared/types'
import { loadCaptions } from './captions'
import { getEntry, saveEntry } from './storage/cache'
import { getSettingsView, updateSettings } from './storage/settings'
import { TranslateJobs } from './translate/service'
import { toAppError } from './youtube/errors'
import { lookupWord } from './dictionary/lookup'
import { deleteWord, getSavedWords, saveWord } from './storage/words'
import { exportAnkiCsv } from './storage/exportCsv'
import { getAsrStatus } from './asr/paths'
import { transcribeVideoWithWhisper } from './asr/service'
import { checkUpdatesManually, quitAndInstallUpdate, startDownloadUpdate } from './updater'

/** Bọc handler để mọi lỗi trả về dạng { ok:false, error } với thông báo tiếng Việt. */
async function wrap<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    const err = toAppError(e)
    console.error('[ipc]', err.code, err.message, e)
    return { ok: false, error: { code: err.code, message: err.message } }
  }
}

const validId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{11}$/.test(v)
const str = (v: unknown, fallback: string): string => (typeof v === 'string' && v ? v : fallback)

/** Có cache thì dùng, không thì tải từ YouTube rồi lưu cache. */
async function captionsCached(videoId: string, preferred: string): Promise<CaptionsPayload> {
  const hit = await getEntry(videoId, preferred)
  if (hit) return { ...hit.payload, fromCache: true }
  const payload = await loadCaptions(videoId, preferred)
  await saveEntry({ version: 1, videoId, preferred, payload, translations: {}, savedAt: Date.now() })
  return payload
}

const jobs = new TranslateJobs()

/** Đăng ký toàn bộ handler IPC. Các phase sau sẽ thêm kênh vào đây. */
export function registerIpc(): void {
  ipcMain.handle(
    IPC.appInfo,
    (): AppInfo => ({ version: app.getVersion(), platform: process.platform })
  )

  ipcMain.handle(IPC.captionsLoad, (_e, videoId: unknown, preferred: unknown) =>
    wrap(() => {
      if (!validId(videoId)) throw new Error('videoId không hợp lệ')
      return captionsCached(videoId, str(preferred, 'auto'))
    })
  )

  ipcMain.handle(IPC.translateStart, (e, videoId: unknown, preferred: unknown, to: unknown) =>
    wrap(async () => {
      if (!validId(videoId)) throw new Error('videoId không hợp lệ')
      const sender: WebContents = e.sender
      const send = (ch: string, payload: unknown): void => {
        if (!sender.isDestroyed()) sender.send(ch, payload)
      }
      await jobs.start(videoId, str(preferred, 'auto'), str(to, 'vi'), {
        progress: (p) => send(IPC.translateProgress, p),
        done: (d) => send(IPC.translateDone, d)
      })
      return null
    })
  )

  ipcMain.handle(IPC.translateCancel, () => jobs.cancel())

  ipcMain.handle(IPC.settingsGet, () => getSettingsView())
  ipcMain.handle(IPC.settingsSave, (_e, update: SettingsUpdate) =>
    wrap(() => updateSettings(update ?? {}))
  )

  ipcMain.handle(IPC.dictLookup, (_e, word: unknown, srcLang: unknown) =>
    wrap(() => {
      if (typeof word !== 'string' || !word.trim()) throw new Error('Từ không hợp lệ')
      return lookupWord(word, typeof srcLang === 'string' ? srcLang : 'en')
    })
  )

  ipcMain.handle(IPC.wordsList, () => getSavedWords())

  ipcMain.handle(IPC.wordSave, (_e, data: Omit<SavedWord, 'id' | 'createdAt'>) =>
    wrap(() => {
      if (!data || !data.word) throw new Error('Dữ liệu từ vựng không hợp lệ')
      return saveWord(data)
    })
  )

  ipcMain.handle(IPC.wordDelete, (_e, id: unknown) =>
    wrap(() => {
      if (typeof id !== 'string' || !id) throw new Error('Mã từ không hợp lệ')
      return deleteWord(id)
    })
  )

  ipcMain.handle(IPC.wordsExportAnki, (e) =>
    wrap(() => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      return exportAnkiCsv(win)
    })
  )

  ipcMain.handle(IPC.asrStatus, () => getAsrStatus())

  ipcMain.handle(IPC.asrTranscribe, (e, videoId: unknown, lang: unknown) =>
    wrap(async () => {
      if (!validId(videoId)) throw new Error('videoId không hợp lệ')
      const sender: WebContents = e.sender
      const send = (ch: string, payload: unknown): void => {
        if (!sender.isDestroyed()) sender.send(ch, payload)
      }
      return transcribeVideoWithWhisper(videoId, str(lang, 'auto'), {
        progress: (p) => send(IPC.asrProgress, p)
      })
    })
  )

  ipcMain.handle(IPC.updaterCheck, () => wrap(() => checkUpdatesManually()))
  ipcMain.handle(IPC.updaterDownload, () => wrap(() => startDownloadUpdate()))
  ipcMain.handle(IPC.updaterInstall, () => {
    quitAndInstallUpdate()
  })
}
