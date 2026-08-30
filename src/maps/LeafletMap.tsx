import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { color } from '../templates/tokens'

/**
 * A fixed, non-interactive map for the plan template. Loaded lazily by
 * MapFigure, which owns the off and no-coordinates states.
 *
 * Maps are off until the user opts in, because rendering one sends the rally
 * point's coordinates to a third-party tile server. This is an OPSEC tool; that
 * request is a real disclosure and it is the user's to make, not ours.
 *
 * Tiles come from OpenStreetMap and the attribution stays — the handoff is
 * explicit that maps must come from a real tile source and must not be
 * hand-drawn. Tiles render as <img> elements, so nothing special is needed to
 * make them print.
 */

export interface MapPoint {
  key: string
  label: string
  lat: number
  lon: number
}

export function LeafletMap({
  enabled,
  points,
  zoom,
  height,
  caption,
  ariaLabel,
}: {
  enabled: boolean
  points: MapPoint[]
  /** Fixed zoom for a single point; omitted fits all points instead. */
  zoom?: number
  height: number
  caption?: string
  ariaLabel: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const key = JSON.stringify({ enabled, points, zoom })

  useEffect(() => {
    const el = host.current
    if (!el || !enabled || points.length === 0) return

    setReady(false)
    setFailed(false)

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomSnap: 0.25,
    })

    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      crossOrigin: 'anonymous',
      // Print needs every tile in the viewport painted, not a lazy edge.
      keepBuffer: 4,
    })
    tiles.on('load', () => setReady(true))
    tiles.on('tileerror', () => setFailed(true))
    tiles.addTo(map)

    for (const p of points) {
      L.marker([p.lat, p.lon], {
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html:
            `<div style="width:26px;height:26px;border-radius:50%;background:${color.blue};` +
            `color:#fff;font:800 13px/26px 'Archivo',Arial,sans-serif;text-align:center;` +
            `box-shadow:0 1px 4px rgba(0,0,0,.45)">${escapeHtml(p.key)}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })
        .addTo(map)
        .bindTooltip(p.label, {
          permanent: true,
          direction: 'right',
          offset: [15, 0],
          className: 'rp-tooltip',
        })
    }

    if (points.length === 1 && zoom != null) {
      map.setView([points[0]!.lat, points[0]!.lon], zoom)
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), {
        paddingTopLeft: [70, 40],
        paddingBottomRight: [70, 40],
      })
    }
    // Leaflet measures the container on creation; in a print layout it is often
    // still being sized at that moment.
    requestAnimationFrame(() => map.invalidateSize())

    // Tiles already in Leaflet's cache never fire 'load'. Treat a quiet second
    // as ready rather than blocking export forever.
    const settle = setTimeout(() => setReady(true), 4000)

    return () => {
      clearTimeout(settle)
      map.remove()
    }
  }, [key, enabled, points, zoom])

  const frame = {
    height,
    border: `1px solid ${color.hairlineCool}`,
    boxSizing: 'border-box' as const,
    background: '#f4f3f0',
  }

  return (
    <figure style={{ margin: 0 }} className="keep">
      <div
        ref={host}
        data-map=""
        data-map-ready={ready && !failed ? 'true' : 'false'}
        role="img"
        aria-label={ariaLabel}
        style={frame}
      />
      {failed ? (
        <div style={{ fontSize: 11, color: color.red, marginTop: 4 }}>
          Some map tiles did not load. Check the connection before printing.
        </div>
      ) : null}
      {caption ? <Caption text={caption} /> : null}
    </figure>
  )
}

const Caption = ({ text }: { text: string }) => (
  <figcaption style={{ fontSize: 12, color: color.mutedInk, marginTop: 5 }}>{text}</figcaption>
)

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
