import type { CaptionsPayload, Cue } from '../../shared/types'
import { AppError, playabilityError, toAppError } from '../youtube/errors'
import { CLIENTS, getVideoInfo } from '../youtube/innertube'
import { normalizeAsr, normalizeManual } from './normalize'
import { parseJson3, toEvents, toWords } from './parse'
import { audioLangOf, selectTrack, type RawTrack } from './selectTrack'

async function downloadCues(track: RawTrack): Promise<Cue[]> {
  const url = new URL(track.baseUrl)
  url.searchParams.set('fmt', 'json3')
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new AppError('CAPTION_HTTP', `Không tải được phụ đề (HTTP ${res.status}).`)
  const json = parseJson3(await res.text())
  return track.kind === 'asr' ? normalizeAsr(toWords(json)) : normalizeManual(toEvents(json))
}

/** Lấy thông tin video + phụ đề, thử lần lượt các client của YouTube.js. */
export async function loadCaptions(videoId: string, preferredLang: string): Promise<CaptionsPayload> {
  let lastError: unknown
  let firstPlayability: AppError | null = null

  for (const client of CLIENTS) {
    try {
      const info = await getVideoInfo(videoId, client)
      const status = info.playability_status?.status

      if (status && status !== 'OK') {
        firstPlayability ??= playabilityError(status, info.playability_status?.reason)
        continue
      }

      const list = info.captions?.caption_tracks ?? []
      const tracks: RawTrack[] = list.map((t) => ({
        lang: t.language_code,
        name: t.name.toString(),
        kind: t.kind === 'asr' ? 'asr' : 'manual',
        baseUrl: t.base_url
      }))

      const audioTracks = info.captions?.audio_tracks
      const defaultIdx = info.captions?.default_audio_track_index
      const audioLang = audioLangOf(
        audioTracks && defaultIdx !== undefined ? audioTracks[defaultIdx]?.audio_track_id : undefined
      )

      const track = selectTrack(tracks, audioLang, preferredLang)
      const cues = await downloadCues(track)
      if (!cues.length) throw new AppError('EMPTY_CAPTIONS', 'Phụ đề của video này trống.')

      return {
        videoId,
        title: info.basic_info.title ?? '',
        duration: info.basic_info.duration ?? 0,
        lang: track.lang,
        langName: track.name.replace(/\s*\(auto-generated\)/i, ''),
        kind: track.kind,
        cues
      }
    } catch (e) {
      // Lỗi nghiệp vụ (không có phụ đề, sai ngôn ngữ...) → dừng ngay, không đổi client
      if (e instanceof AppError && e.code !== 'CAPTION_HTTP') throw e
      lastError = e
    }
  }

  if (firstPlayability) throw firstPlayability
  throw toAppError(lastError)
}

