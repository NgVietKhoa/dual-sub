import { app } from 'electron'
import { join } from 'node:path'
import { mkdir, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { AsrProgress, CaptionsPayload } from '../../shared/types'
import { downloadAudio } from './ytdlp'
import { convertTo16kWav, runWhisper } from './whisper'
import { saveEntry } from '../storage/cache'
import { LANG_NAMES } from '../translate/TranslationProvider'
import { AppError } from '../youtube/errors'

export interface AsrJobSink {
  progress(p: AsrProgress): void
}

export async function transcribeVideoWithWhisper(
  videoId: string,
  lang = 'auto',
  sink?: AsrJobSink,
  signal?: AbortSignal
): Promise<CaptionsPayload> {
  const tmpDir = join(app.getPath('userData'), 'temp_asr')
  await mkdir(tmpDir, { recursive: true })

  const rawAudioPath = join(tmpDir, `${videoId}_raw.wav`)
  const wav16kPath = join(tmpDir, `${videoId}_16k.wav`)
  const whisperOutPrefix = join(tmpDir, `${videoId}_out`)

  try {
    // 1. Tải audio
    sink?.progress({
      videoId,
      stage: 'downloading',
      message: 'Đang tải âm thanh từ YouTube (yt-dlp)...'
    })

    await downloadAudio({
      videoId,
      outputPath: rawAudioPath,
      onProgress: (percent, msg) => {
        sink?.progress({ videoId, stage: 'downloading', percent, message: msg })
      },
      signal
    })

    // 2. Chuyển đổi định dạng sang 16kHz WAV
    sink?.progress({
      videoId,
      stage: 'converting',
      message: 'Đang chuyển đổi định dạng âm thanh chuẩn 16kHz (ffmpeg)...'
    })

    await convertTo16kWav(rawAudioPath, wav16kPath)

    // 3. Nhận dạng giọng nói bằng whisper.cpp
    sink?.progress({
      videoId,
      stage: 'transcribing',
      message: 'Đang nhận dạng giọng nói bằng Whisper AI...'
    })

    const { cues, detectedLang } = await runWhisper(
      wav16kPath,
      whisperOutPrefix,
      lang,
      (msg) => {
        sink?.progress({ videoId, stage: 'transcribing', message: msg })
      },
      signal
    )

    if (!cues.length) {
      throw new AppError('EMPTY_ASR', 'Whisper không nhận diện được lời nói trong video này.')
    }

    const langName = LANG_NAMES[detectedLang] || detectedLang
    const payload: CaptionsPayload = {
      videoId,
      title: 'Nhận dạng từ Whisper AI',
      duration: cues[cues.length - 1].end,
      lang: detectedLang,
      langName: `${langName} (Whisper AI)`,
      kind: 'asr',
      cues,
      tracks: [
        {
          lang: detectedLang,
          name: `${langName} (Whisper AI)`,
          kind: 'asr'
        }
      ]
    }

    // Lưu vào cache
    await saveEntry({
      version: 1,
      videoId,
      preferred: 'whisper',
      payload,
      translations: {},
      savedAt: Date.now()
    })

    return payload
  } finally {
    // Dọn dẹp file tạm
    if (existsSync(rawAudioPath)) await unlink(rawAudioPath).catch(() => {})
    if (existsSync(wav16kPath)) await unlink(wav16kPath).catch(() => {})
  }
}

