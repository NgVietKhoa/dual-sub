import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { registerIpc } from './ipc'
import { startStaticServer, type StaticServer } from './staticServer'
import { initAutoUpdater } from './updater'

let server: StaticServer | null = null
let rendererOrigin = ''

/**
 * YouTube embed báo lỗi (150/153) nếu trang nhúng không có origin/referer hợp lệ.
 * Renderer luôn chạy từ http://localhost (dev) hoặc http://127.0.0.1 (bản build),
 * không bao giờ từ file://. Ở đây chỉ bổ sung Referer cho request tới YouTube nếu thiếu.
 */
function ensureYouTubeReferer(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*'] },
    (details, callback) => {
      const headers = details.requestHeaders
      const has = Object.keys(headers).some((k) => k.toLowerCase() === 'referer')
      if (!has && rendererOrigin) headers['Referer'] = rendererOrigin + '/'
      callback({ requestHeaders: headers })
    }
  )
}

async function createWindow(): Promise<void> {
  const iconPath = join(__dirname, '../../resources/icon.png')

  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'DualSub',
    icon: existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#101217',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    initAutoUpdater(win)
  })

  // Link mở ra ngoài app → trình duyệt mặc định; không cho cửa sổ con.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(rendererOrigin)) e.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    rendererOrigin = new URL(devUrl).origin
    await win.loadURL(devUrl)
  } else {
    server = await startStaticServer(join(__dirname, '../renderer'))
    rendererOrigin = server.origin
    await win.loadURL(server.origin + '/index.html')
  }
}

app.whenReady().then(async () => {
  registerIpc()
  ensureYouTubeReferer()
  await createWindow()
})

app.on('window-all-closed', () => {
  server?.close()
  app.quit()
})

