import type { SettingsView } from '../../../shared/types'
import { $ } from './dom'
import { toast } from './toast'

let view: SettingsView | null = null

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

