import type { CaptionTrackInfo } from '../../shared/types'
import { AppError } from '../youtube/errors'

export interface RawTrack extends CaptionTrackInfo {
  baseUrl: string
}

const base = (lang: string): string => lang.toLowerCase().split(/[-_]/)[0]

/** "en-US.4" → "en" */
export function audioLangOf(audioTrackId: string | undefined): string | undefined {
  return audioTrackId ? base(audioTrackId.split('.')[0]) : undefined
}

/**
 * Ưu tiên: phụ đề người đăng > tự tạo (ASR). Trong mỗi nhóm ưu tiên track trùng ngôn ngữ nói của video.
 * Nếu người dùng chọn ngôn ngữ cụ thể thì chỉ xét ngôn ngữ đó.
 */
export function selectTrack(tracks: RawTrack[], audioLang: string | undefined, preferred: string): RawTrack {
  if (!tracks.length) throw new AppError('NO_CAPTIONS', 'Video này không có phụ đề.')

  if (preferred && preferred !== 'auto') {
    const want = base(preferred)
    const pool = tracks.filter((t) => base(t.lang) === want)
    const hit = pool.find((t) => t.kind === 'manual') ?? pool[0]
    if (!hit) {
      throw new AppError(
        'NO_TRACK_FOR_LANG',
        `Video không có phụ đề cho ngôn ngữ đã chọn. Hãy chọn “Tự nhận diện”. Có sẵn: ${[...new Set(tracks.map((t) => t.lang))].join(', ')}.`
      )
    }
    return hit
  }

  const manual = tracks.filter((t) => t.kind === 'manual')
  const asr = tracks.filter((t) => t.kind === 'asr')
  const inAudio = (list: RawTrack[]): RawTrack | undefined =>
    audioLang ? list.find((t) => base(t.lang) === audioLang) : undefined

  return inAudio(manual) ?? inAudio(asr) ?? manual[0] ?? asr[0]
}

