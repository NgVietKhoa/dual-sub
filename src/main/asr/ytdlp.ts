import { spawn } from 'node:child_process'
import { findExecutable } from './paths'
import { AppError } from '../youtube/errors'

export interface DownloadAudioOptions {
  videoId: string
  outputPath: string
  onProgress?: (percent: number, msg: string) => void
  signal?: AbortSignal
}

export async function downloadAudio(opts: DownloadAudioOptions): Promise<string> {
  const ytDlp = findExecutable('yt-dlp')
  if (!ytDlp) {
    throw new AppError(
      'MISSING_YTDLP',
      'Chưa cài đặt yt-dlp. Vui lòng tải yt-dlp.exe và đặt vào thư mục resources/bin/ hoặc cài vào PATH.'
    )
  }

  const url = `https://www.youtube.com/watch?v=${opts.videoId}`
  // Tải audio định dạng tốt nhất
  const args = [
    url,
    '-x',
    '--no-playlist',
    '--force-overwrites',
    '-o',
    opts.outputPath
  ]

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlp, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        proc.kill()
        reject(new DOMException('Huỷ tải audio', 'AbortError'))
      })
    }

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      // Bắt phần trăm tiến độ ví dụ: [download]  45.2% of 12.34MiB at 2.34MiB/s
      const m = text.match(/\[download\]\s+([\d.]+)%/)
      if (m && opts.onProgress) {
        opts.onProgress(parseFloat(m[1]), `Đang tải âm thanh: ${m[1]}%`)
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      reject(new AppError('YTDLP_ERROR', `Không thể khởi động yt-dlp: ${err.message}`))
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(opts.outputPath)
      } else {
        reject(new AppError('YTDLP_ERROR', `yt-dlp thoát với mã lỗi ${code}: ${stderr.slice(-300)}`))
      }
    })
  })
}

