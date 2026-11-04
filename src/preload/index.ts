import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type DualSubApi,
  type TranslateDone,
  type TranslateProgress,
  type UpdateStatus
} from '../shared/types'

/** Đăng ký lắng nghe sự kiện từ main; trả về hàm huỷ đăng ký. */
function on<T>(channel: string, cb: (data: T) => void): () => void {
  const handler = (_e: Electron.IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: DualSubApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  loadCaptions: (videoId, preferredLang) => ipcRenderer.invoke(IPC.captionsLoad, videoId, preferredLang),
  translateStart: (videoId, preferredLang, to) =>
    ipcRenderer.invoke(IPC.translateStart, videoId, preferredLang, to),
  translateCancel: () => ipcRenderer.invoke(IPC.translateCancel),
  onTranslateProgress: (cb) => on<TranslateProgress>(IPC.translateProgress, cb),
  onTranslateDone: (cb) => on<TranslateDone>(IPC.translateDone, cb),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  saveSettings: (update) => ipcRenderer.invoke(IPC.settingsSave, update),
  lookupWord: (word, from, to) => ipcRenderer.invoke(IPC.dictLookup, word, from, to),
  getSavedWords: () => ipcRenderer.invoke(IPC.wordsList),
  saveWord: (data) => ipcRenderer.invoke(IPC.wordSave, data),
  deleteWord: (id) => ipcRenderer.invoke(IPC.wordDelete, id),
  exportAnkiCsv: () => ipcRenderer.invoke(IPC.wordsExportAnki),
  getWatchedVideos: () => ipcRenderer.invoke(IPC.watchedList),
  saveWatchedVideo: (data) => ipcRenderer.invoke(IPC.watchedSave, data),
  deleteWatchedVideo: (videoId) => ipcRenderer.invoke(IPC.watchedDelete, videoId),
  checkForUpdates: () => ipcRenderer.invoke(IPC.updaterCheck),
  downloadUpdate: () => ipcRenderer.invoke(IPC.updaterDownload),
  installUpdate: () => ipcRenderer.invoke(IPC.updaterInstall),
  onUpdateStatus: (cb) => on<UpdateStatus>(IPC.updaterStatus, cb)
}

contextBridge.exposeInMainWorld('api', api)
