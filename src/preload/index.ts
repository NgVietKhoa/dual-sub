import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AsrProgress,
  type SongNguApi,
  type TranslateDone,
  type TranslateProgress
} from '../shared/types'

/** Đăng ký lắng nghe sự kiện từ main; trả về hàm huỷ đăng ký. */
function on<T>(channel: string, cb: (data: T) => void): () => void {
  const handler = (_e: Electron.IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: SongNguApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  loadCaptions: (videoId, preferredLang) => ipcRenderer.invoke(IPC.captionsLoad, videoId, preferredLang),
  translateStart: (videoId, preferredLang, to) =>
    ipcRenderer.invoke(IPC.translateStart, videoId, preferredLang, to),
  translateCancel: () => ipcRenderer.invoke(IPC.translateCancel),
  onTranslateProgress: (cb) => on<TranslateProgress>(IPC.translateProgress, cb),
  onTranslateDone: (cb) => on<TranslateDone>(IPC.translateDone, cb),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  saveSettings: (update) => ipcRenderer.invoke(IPC.settingsSave, update),
  lookupWord: (word, srcLang) => ipcRenderer.invoke(IPC.dictLookup, word, srcLang),
  getSavedWords: () => ipcRenderer.invoke(IPC.wordsList),
  saveWord: (data) => ipcRenderer.invoke(IPC.wordSave, data),
  deleteWord: (id) => ipcRenderer.invoke(IPC.wordDelete, id),
  exportAnkiCsv: () => ipcRenderer.invoke(IPC.wordsExportAnki),
  getAsrStatus: () => ipcRenderer.invoke(IPC.asrStatus),
  transcribeWithWhisper: (videoId, lang) => ipcRenderer.invoke(IPC.asrTranscribe, videoId, lang),
  onAsrProgress: (cb) => on<AsrProgress>(IPC.asrProgress, cb)
}

contextBridge.exposeInMainWorld('api', api)
