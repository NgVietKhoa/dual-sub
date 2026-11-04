/** Lỗi có mã + thông báo tiếng Việt, an toàn để hiển thị cho người dùng. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

const NETWORK_CODES = new Set([
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET'
])

function isNetworkError(e: unknown): boolean {
  let cur: unknown = e
  for (let i = 0; i < 4 && cur; i++) {
    const err = cur as { code?: string; name?: string; message?: string; cause?: unknown }
    if (err.code && NETWORK_CODES.has(err.code)) return true
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
    if (err.message === 'fetch failed' && !err.cause) return true
    cur = err.cause
  }
  return false
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  if (isNetworkError(e)) {
    return new AppError('NETWORK', 'Mất kết nối mạng hoặc YouTube không phản hồi. Kiểm tra internet rồi thử lại.')
  }
  const msg = e instanceof Error ? e.message : String(e)
  return new AppError('UNKNOWN', `Có lỗi không mong muốn: ${msg}`)
}

/** Dịch trạng thái playability của YouTube sang thông báo tiếng Việt. */
export function playabilityError(status: string | undefined, reason?: string): AppError {
  const r = reason ? ` (${reason})` : ''
  switch (status) {
    case 'LOGIN_REQUIRED':
      return new AppError(
        'PRIVATE',
        `Video riêng tư, giới hạn độ tuổi hoặc yêu cầu đăng nhập nên không lấy được phụ đề${r}.`
      )
    case 'ERROR':
      return new AppError('UNAVAILABLE', `Video không tồn tại, đã bị xoá hoặc bị chặn${r}.`)
    case 'UNPLAYABLE':
      return new AppError('BLOCKED', `Video không khả dụng (bị chặn theo khu vực hoặc bản quyền)${r}.`)
    case 'LIVE_STREAM_OFFLINE':
      return new AppError('LIVE', `Buổi phát trực tiếp chưa bắt đầu hoặc đã kết thúc${r}.`)
    default:
      return new AppError('UNAVAILABLE', `Không mở được video này${r}.`)
  }
}

