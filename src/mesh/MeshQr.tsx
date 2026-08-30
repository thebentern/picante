import { useEffect, useState, type CSSProperties } from 'react'
import type { Doc } from '../doc/schema'
import { renderQrDataUrl } from './qr'
import { color } from '../templates/tokens'

const cache = new Map<string, string>()

/**
 * Resolve the QR image for a document: generated from the provisioning URL when
 * there is one, otherwise the user's uploaded PNG, otherwise nothing.
 *
 * Exports need the image synchronously-ish, so the generated data URI is cached
 * by URL and the hook returns null only while the very first render is in
 * flight.
 */
export function useMeshQr(doc: Doc): string | null {
  const url = doc.mesh.url.trim()
  const [generated, setGenerated] = useState<string | null>(() => cache.get(url) ?? null)

  useEffect(() => {
    if (!url) {
      setGenerated(null)
      return
    }
    const hit = cache.get(url)
    if (hit) {
      setGenerated(hit)
      return
    }
    let live = true
    renderQrDataUrl(url)
      .then((data) => {
        cache.set(url, data)
        if (live) setGenerated(data)
      })
      .catch((err) => {
        console.warn('picante: could not render the provisioning QR —', err)
        if (live) setGenerated(null)
      })
    return () => {
      live = false
    }
  }, [url])

  return generated ?? doc.mesh.qrImage
}

/**
 * The QR as it appears on a card. `image-rendering: pixelated` keeps module
 * edges hard through scaling — a smoothed QR at 16 mm loses the sharp module
 * boundaries a scanner needs.
 */
export function MeshQr({
  doc,
  size,
  style,
}: {
  doc: Doc
  /** CSS length: 112 (px) on the fold card, '16mm' on the label. */
  size: number | string
  style?: CSSProperties
}) {
  const src = useMeshQr(doc)
  const box: CSSProperties = { width: size, height: size, display: 'block', ...style }

  if (!src) {
    return (
      <div
        data-mesh-qr="placeholder"
        style={{
          ...box,
          border: `1px dashed ${color.hairlineCool}`,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          fontSize: 9,
          lineHeight: 1.2,
          color: color.mutedInk,
          padding: 4,
        }}
      >
        No QR yet
      </div>
    )
  }

  return (
    <img
      data-mesh-qr="image"
      src={src}
      alt="Meshtastic channel provisioning QR code"
      style={{ ...box, imageRendering: 'pixelated' }}
    />
  )
}
