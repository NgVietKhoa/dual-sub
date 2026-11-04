import { app, BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { IPC, type UpdateStatus } from '../shared/types'

let currentStatus: UpdateStatus = {
  state: 'idle',
  currentVersion: app.getVersion()
}

let mainWindow: BrowserWindow | null = null

function emitStatus(status: UpdateStatus): void {
  currentStatus = status
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.updaterStatus, status)
  }
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Cấu hình autoUpdater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    emitStatus({
      state: 'checking',
      currentVersion: app.getVersion(),
      message: 'Đang kiểm tra bản cập nhật mới…'
    })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    emitStatus({
      state: 'available',
      currentVersion: app.getVersion(),
      newVersion: info.version,
      message: `Đã có phiên bản mới v${info.version}! Bấm để tải về.`
    })
  })

  autoUpdater.on('update-not-available', () => {
    emitStatus({
      state: 'not-available',
      currentVersion: app.getVersion(),
      message: 'Bạn đang sử dụng phiên bản mới nhất.'
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent)
    emitStatus({
      state: 'downloading',
      currentVersion: app.getVersion(),
      percent,
      message: `Đang tải bản cập nhật: ${percent}%`
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    emitStatus({
      state: 'downloaded',
      currentVersion: app.getVersion(),
      newVersion: info.version,
      message: `Đã tải xong v${info.version}. Khởi động lại ứng dụng để áp dụng cập nhật.`
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Lỗi updater:', err)
    emitStatus({
      state: 'error',
      currentVersion: app.getVersion(),
      message: `Lỗi cập nhật: ${err?.message || 'Không thể kiểm tra cập nhật'}`
    })
  })

  // Nếu là ứng dụng đã đóng gói (production), tự động kiểm tra sau 5 giây khởi động
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[updater] Không thể tự động kiểm tra cập nhật lúc khởi động:', err)
      })
    }, 5000)
  }
}

export async function checkUpdatesManually(): Promise<UpdateStatus> {
  if (!app.isPackaged) {
    // Trong môi trường dev, không có release metadata thật
    return {
      state: 'not-available',
      currentVersion: app.getVersion(),
      message: 'Đang chạy ở chế độ phát triển (dev mode).'
    }
  }

  try {
    emitStatus({
      state: 'checking',
      currentVersion: app.getVersion(),
      message: 'Đang kiểm tra bản cập nhật…'
    })
    await autoUpdater.checkForUpdates()
    return currentStatus
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emitStatus({
      state: 'error',
      currentVersion: app.getVersion(),
      message: `Lỗi: ${msg}`
    })
    return currentStatus
  }
}

export async function startDownloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall()
}
