import type { SettingsView, UpdateStatus } from '../../../shared/types'
import { $ } from './dom'
import { toast } from './toast'

let view: SettingsView | null = null

function renderUpdateStatus(status: UpdateStatus): void {
  const msgEl = $('updateStatusMsg')
  const downloadBtn = $('downloadUpdateBtn')
  const installBtn = $('installUpdateBtn')
  const checkBtn = $<HTMLButtonElement>('checkUpdateBtn')

  checkBtn.disabled = status.state === 'checking' || status.state === 'downloading'

  if (status.state === 'checking') {
    msgEl.textContent = 'Đang kiểm tra bản cập nhật…'
    downloadBtn.hidden = true
    installBtn.hidden = true
  } else if (status.state === 'available') {
    msgEl.innerHTML = `<span style="color:#2E9E5B;font-weight:600">Đã có bản cập nhật mới v${status.newVersion}!</span>`
    downloadBtn.hidden = false
    installBtn.hidden = true
  } else if (status.state === 'downloading') {
    msgEl.textContent = `Đang tải bản cập nhật: ${status.percent ?? 0}%`
    downloadBtn.hidden = true
    installBtn.hidden = true
  } else if (status.state === 'downloaded') {
    msgEl.innerHTML = `<span style="color:#2E9E5B;font-weight:600">Đã tải xong v${status.newVersion}!</span> Khởi động lại để áp dụng.`
    downloadBtn.hidden = true
    installBtn.hidden = false
  } else if (status.state === 'not-available') {
    msgEl.textContent = status.message || 'Bạn đang dùng phiên bản mới nhất.'
    downloadBtn.hidden = true
    installBtn.hidden = true
  } else if (status.state === 'error') {
    msgEl.textContent = status.message || 'Lỗi khi kiểm tra cập nhật.'
    downloadBtn.hidden = true
    installBtn.hidden = true
  }
}

function fill(v: SettingsView): void {
  view = v
  $<HTMLSelectElement>('setProvider').value = v.provider
  $<HTMLInputElement>('setDeepl').value = ''
  $<HTMLInputElement>('setClaude').value = ''
  $<HTMLInputElement>('setDeepl').placeholder = v.hasDeeplKey ? 'Đã lưu · để trống = giữ nguyên' : 'Chưa có key'
  $<HTMLInputElement>('setClaude').placeholder = v.hasClaudeKey ? 'Đã lưu · để trống = giữ nguyên' : 'Chưa có key'
  $<HTMLInputElement>('setModel').value = v.claudeModel
}

async function renderAsrStatus(): Promise<void> {
  const infoEl = $('asrStatusInfo')
  try {
    const status = await window.api.getAsrStatus()
    const pill = (ok: boolean) =>
      ok
        ? '<span class="status-pill status-ok">Đã sẵn sàng</span>'
        : '<span class="status-pill status-missing">Chưa có</span>'

    infoEl.innerHTML = `
      <div style="display:grid;grid-template-columns:110px 1fr;gap:6px 12px;margin-bottom:8px">
        <div>ffmpeg:</div><div>${pill(status.hasFfmpeg)}</div>
        <div>yt-dlp:</div><div>${pill(status.hasYtDlp)}</div>
        <div>whisper.cpp:</div><div>${pill(status.hasWhisper)}</div>
        <div>Model:</div><div>${pill(status.hasModel)} ${status.modelPath ? `(${status.modelPath.split(/[/\\]/).pop()})` : ''}</div>
      </div>
      <div style="font-size:11.5px;line-height:1.5;color:var(--muted)">
        Thư mục đặt binary: <code>${status.binDir}</code><br>
        Thư mục đặt model: <code>${status.modelsDir}</code>
      </div>
    `
  } catch {
    infoEl.textContent = 'Không kiểm tra được trạng thái Whisper.'
  }
}

export function initSettings(): void {
  const dlg = $<HTMLDialogElement>('settingsDlg')

  // Lấy phiên bản hiện tại hiển thị lên giao diện
  void window.api.getAppInfo().then((info) => {
    $('appVersionText').textContent = `v${info.version}`
  })

  // Đăng ký nhận thông báo trạng thái cập nhật tự động
  window.api.onUpdateStatus((status) => {
    renderUpdateStatus(status)
    if (status.state === 'available') {
      toast(`Đã có bản cập nhật mới v${status.newVersion}! Mở Cài đặt để tải.`, 6000)
    } else if (status.state === 'downloaded') {
      toast('Đã tải xong bản cập nhật mới. Mở Cài đặt để khởi động lại và cập nhật.', 7000)
    }
  })

  $('checkUpdateBtn').onclick = async () => {
    const res = await window.api.checkForUpdates()
    if (!res.ok) {
      $('updateStatusMsg').textContent = res.error.message
      toast(res.error.message)
    } else {
      renderUpdateStatus(res.data)
    }
  }

  $('downloadUpdateBtn').onclick = async () => {
    const res = await window.api.downloadUpdate()
    if (!res.ok) {
      toast(res.error.message)
    }
  }

  $('installUpdateBtn').onclick = () => {
    void window.api.installUpdate()
  }

  $('settingsBtn').onclick = async () => {
    fill(await window.api.getSettings())
    void renderAsrStatus()
    dlg.showModal()
  }
  $('setCancel').onclick = () => dlg.close()

  $('clearKeys').onclick = async () => {
    const r = await window.api.saveSettings({ deeplKey: '', claudeKey: '' })
    if (r.ok) {
      fill(r.data)
      toast('Đã xoá các key đã lưu')
    } else toast(r.error.message)
  }

  $('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const provider = $<HTMLSelectElement>('setProvider').value as SettingsView['provider']
    const deepl = $<HTMLInputElement>('setDeepl').value.trim()
    const claude = $<HTMLInputElement>('setClaude').value.trim()
    if (provider === 'deepl' && !deepl && !view?.hasDeeplKey) return toast('Hãy nhập DeepL API key.')
    if (provider === 'claude' && !claude && !view?.hasClaudeKey) return toast('Hãy nhập Claude API key.')
    const r = await window.api.saveSettings({
      provider,
      ...(deepl ? { deeplKey: deepl } : {}),
      ...(claude ? { claudeKey: claude } : {}),
      claudeModel: $<HTMLInputElement>('setModel').value
    })
    if (!r.ok) return toast(r.error.message)
    dlg.close()
    toast('Đã lưu cài đặt. Bấm “Thử dịch lại” nếu cần dịch lại phần còn thiếu.')
  })
}

