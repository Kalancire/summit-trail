export function toAvatar(file: File, size = 256): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size
      const s = Math.min(img.width, img.height)
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => rej(new Error('Could not read that image'))
    img.src = url
  })
}
