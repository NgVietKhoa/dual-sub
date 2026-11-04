import { $ } from './dom'

export interface Language {
  code: string
  label: string
}

export const SOURCE_LANGS: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' }
]

export const TARGET_LANGS: Language[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' }
]

export interface TopbarHandlers {
  onSubmit(link: string): void
  onLangChange(src: string, dst: string): void
}

export function initTopbar(h: TopbarHandlers): void {
  const src = $<HTMLSelectElement>('srcLang')
  const dst = $<HTMLSelectElement>('dstLang')
  setDetectedLang(null)
  dst.innerHTML = TARGET_LANGS.map((l) => `<option value="${l.code}">${l.label}</option>`).join('')

  $('urlForm').addEventListener('submit', (e) => {
    e.preventDefault()
    h.onSubmit($<HTMLInputElement>('url').value)
  })
  const changed = (): void => h.onLangChange(src.value, dst.value)
  src.addEventListener('change', changed)
  dst.addEventListener('change', changed)
}

/** Ô nguồn: "Tự nhận diện · <ngôn ngữ>" + danh sách chọn tay. */
export function setDetectedLang(code: string | null): void {
  const src = $<HTMLSelectElement>('srcLang')
  const current = src.value
  const name = SOURCE_LANGS.find((l) => l.code === code)?.label ?? code
  const auto = code ? `Tự nhận diện · ${name}` : 'Tự nhận diện'
  src.innerHTML =
    `<option value="auto">${auto}</option>` +
    SOURCE_LANGS.map((l) => `<option value="${l.code}">${l.label}</option>`).join('')
  src.value = current && src.querySelector(`option[value="${current}"]`) ? current : 'auto'
}

