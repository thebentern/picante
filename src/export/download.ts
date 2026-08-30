/**
 * Hand a generated file to the user.
 *
 * Everything this app produces is generated in the browser and never uploaded,
 * so a blob URL is the whole delivery mechanism.
 */
export function download(bytes: Uint8Array | Blob | string, filename: string, mime: string) {
  const blob =
    bytes instanceof Blob
      ? bytes
      : new Blob([typeof bytes === 'string' ? bytes : (bytes.slice().buffer as ArrayBuffer)], {
          type: mime,
        })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  // Revoking immediately races the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** A filename stem that sorts usefully and says what it is. */
export function stem(org: string, template: string, revision: string): string {
  const slug = (s: string) =>
    s
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'pace'
  return `${slug(org)}_${slug(template)}_${slug(revision)}`
}
