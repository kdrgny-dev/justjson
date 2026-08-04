import * as api from '../api'

// Downscale + re-encode an image to webp base64 (keeps stored/embedded media
// small). Shared by the image field and the rich-text image button.
export async function fileToWebpBase64(file: File, maxW = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxW / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas context')
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.85))
  if (!blob) throw new Error('conversion failed')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

// Pick → downscale → embed as a self-contained data URL (works in preview and
// the published site; no media server).
export async function fileToDataUrl(file: File): Promise<string> {
  return api.uploadMedia(await fileToWebpBase64(file), file.name)
}
