import { app, BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { IPC, type UpdateStatus } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function emitStatus(status: UpdateStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC.updaterStatus, status)
  }
}

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => emitStatus({ state: 'checking' }))

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    emitStatus({ state: 'available', newVersion: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    emitStatus({ state: 'not-available', message: 'Bạn đang sử dụng phiên bản mới nhất.' })
  })

  autoUpdater.on('download-progress', (progress) => {
    emitStatus({ state: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    emitStatus({ state: 'downloaded', newVersion: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Lỗi updater:', err)
    emitStatus({ state: 'error', message: `Lỗi cập nhật: ${err?.message || 'Không thể kiểm tra cập nhật'}` })
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

/** Kết quả báo về renderer qua sự kiện updaterStatus. */
export async function checkUpdatesManually(): Promise<void> {
  if (!app.isPackaged) {
    // Trong môi trường dev, không có release metadata thật
    return emitStatus({ state: 'not-available', message: 'Đang chạy ở chế độ phát triển (dev mode).' })
  }
  await autoUpdater.checkForUpdates()
}

export async function startDownloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall()
}
