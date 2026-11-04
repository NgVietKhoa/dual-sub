import type { DualSubApi } from '../shared/types'

declare global {
  interface Window {
    api: DualSubApi
  }
}

export {}

