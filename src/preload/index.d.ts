import type { SongNguApi } from '../shared/types'

declare global {
  interface Window {
    api: SongNguApi
  }
}

export {}

