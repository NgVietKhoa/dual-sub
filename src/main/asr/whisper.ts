import { spawn } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { Cue } from '../../shared/types'
import { findExecutable, findWhisperModel } from './paths'
import { AppError } from '../youtube/errors'
import { clean, normalizeAsr } from '../captions/normalize'

/** Chuyển file audio sang 16kHz WAV mono theo chuẩn của whisper.cpp */
export async function convertTo16kWav(inputPath: string, outputPath: string): Promise<string> {
  const ffmpeg = findExecutable('ffmpeg')
  if (!ffmpeg) {
    throw new AppError(
      'MISSING_FFMPEG',
      'Chưa cài đặt ffmpeg. Vui lòng cài ffmpeg (hoặc đặt ffmpeg.exe vào resources/bin/).'
    )
  }

  const args = ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath]

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: 'ignore' })
    proc.on('error', (err) => reject(new AppError('FFMPEG_ERROR', `Lỗi ffmpeg: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve(outputPath)
      } else {
        reject(new AppError('FFMPEG_ERROR', `ffmpeg không thể chuyển đổi file âm thanh (mã ${code}).`))
      }
    })
  })
}

function parseTimeStr(t: string): number {
  const parts = t.trim().replace(',', '.').split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  }
  return parseFloat(t) || 0
}

interface WhisperJson {
  result?: { language?: string }
  transcription?: {
    timestamps?: { from?: string; to?: string }
    offsets?: { from?: number; to?: number }
    text?: string
  }[]
}

export interface TranscribeResult {
  cues: Cue[]
  detectedLang: string
}

export async function runWhisper(
  wavPath: string,
  outputPrefix: string,
  lang = 'auto',
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<TranscribeResult> {
  const whisper =
    findExecutable('whisper-cli') ||
    findExecutable('main') ||
    findExecutable('whisper')

  if (!whisper) {
    throw new AppError(
      'MISSING_WHISPER',
      'Chưa tìm thấy whisper.cpp. Vui lòng đặt whisper-cli.exe (hoặc main.exe) vào thư mục resources/bin/.'
    )
  }

  const model = findWhisperModel()
  if (!model) {
    throw new AppError(
      'MISSING_MODEL',
      'Chưa có model Whisper. Vui lòng tải file ggml-tiny.bin hoặc ggml-base.bin và đặt vào thư mục resources/models/.'
    )
  }

  const args = [
    '-m',
    model,
    '-f',
    wavPath,
    '-l',
    lang || 'auto',
    '--output-json',
    '-of',
    outputPrefix
  ]

  const jsonFile = `${outputPrefix}.json`

  const stdoutCues: Cue[] = []
  let detectedLang = lang !== 'auto' ? lang : 'en'

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(whisper, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    if (signal) {
      signal.addEventListener('abort', () => {
        proc.kill()
        reject(new DOMException('Huỷ nhận dạng', 'AbortError'))
      })
    }

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      // Bắt ngôn ngữ nhận diện ví dụ: auto-detected language: en (p = 0.98)
      const langMatch = text.match(/auto-detected language:\s*([a-zA-Z]+)/i)
      if (langMatch) {
        detectedLang = langMatch[1].toLowerCase()
      }

      // Bắt dòng timestamp từ stdout ví dụ: [00:00:00.000 --> 00:00:04.200]   Hello everyone
      const lines = text.split('\n')
      for (const line of lines) {
        const m = line.match(/\[([\d:.,]+)\s*-->\s*([\d:.,]+)\]\s*(.*)/)
        if (m) {
          const s = parseTimeStr(m[1])
          const e = parseTimeStr(m[2])
          const txt = clean(m[3])
          if (txt) {
            stdoutCues.push({ start: s, end: e, text: txt })
            if (onProgress) onProgress(`Đang nhận dạng: ${txt.slice(0, 40)}...`)
          }
        }
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      reject(new AppError('WHISPER_ERROR', `Không thể khởi chạy whisper.cpp: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new AppError('WHISPER_ERROR', `whisper.cpp lỗi (mã ${code}): ${stderr.slice(-300)}`))
      }
    })
  })

  // Đọc file JSON kết quả nếu có
  if (existsSync(jsonFile)) {
    try {
      const raw = await readFile(jsonFile, 'utf8')
      const parsed = JSON.parse(raw) as WhisperJson
      if (parsed.result?.language) {
        detectedLang = parsed.result.language.toLowerCase()
      }
      if (parsed.transcription && parsed.transcription.length > 0) {
        const cues: Cue[] = []
        for (const item of parsed.transcription) {
          const text = clean(item.text || '')
          if (!text) continue
          let start = 0
          let end = 0
          if (item.offsets?.from !== undefined && item.offsets?.to !== undefined) {
            start = item.offsets.from / 1000
            end = item.offsets.to / 1000
          } else if (item.timestamps?.from && item.timestamps?.to) {
            start = parseTimeStr(item.timestamps.from)
            end = parseTimeStr(item.timestamps.to)
          }
          if (end <= start) end = start + 1
          cues.push({ start, end, text })
        }
        await unlink(jsonFile).catch(() => {})
        return { cues, detectedLang }
      }
    } catch (e) {
      console.warn('[whisper] Đọc file JSON thất bại, dùng kết quả từ stdout:', e)
    }
  }

  return { cues: stdoutCues, detectedLang }
}

