/** Tách videoId (11 ký tự) từ mọi dạng link YouTube. Trả về null nếu không hợp lệ. */
export const ID_RE = /^[\w-]{11}$/

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be'
])

/** "1h2m3s", "90s", "90" → giây */
export function parseTimeParam(raw: string | null): number {
  if (!raw) return 0
  if (/^\d+$/.test(raw)) return Number(raw)
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i)
  if (!m || (!m[1] && !m[2] && !m[3])) return 0
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

export interface ParsedVideoLink {
  videoId: string
  startSeconds: number
}

export function parseVideoLink(input: string): ParsedVideoLink | null {
  const text = input.trim()
  if (!text) return null

  // Cho phép dán thẳng videoId
  if (ID_RE.test(text)) return { videoId: text, startSeconds: 0 }

  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null

  const parts = url.pathname.split('/').filter(Boolean)
  let id: string | undefined

  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    id = parts[0]
  } else if (parts[0] === 'watch') {
    id = url.searchParams.get('v') ?? undefined
  } else if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
    id = parts[1]
  }

  if (!id || !ID_RE.test(id)) return null

  const t = url.searchParams.get('t') ?? url.searchParams.get('start') ?? parseHashTime(url.hash)
  return { videoId: id, startSeconds: parseTimeParam(t) }
}

function parseHashTime(hash: string): string | null {
  const m = hash.match(/[#&]t=([^&]+)/)
  return m ? m[1] : null
}

