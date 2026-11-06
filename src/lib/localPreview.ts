const previewStorageKey = 'abhedya.local-preview'

export function isLocalPreviewEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(previewStorageKey) === 'enabled'
  } catch {
    return false
  }
}

export function enableLocalPreview() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(previewStorageKey, 'enabled')
  } catch {
    // Keep preview unavailable when session storage is disabled.
  }
}

export function disableLocalPreview() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(previewStorageKey)
  } catch {
    // Nothing to clear when session storage is disabled.
  }
}