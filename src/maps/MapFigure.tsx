import { lazy, Suspense } from 'react'
import { color } from '../templates/tokens'

export type { MapPoint } from './LeafletMap'
import type { MapPoint } from './LeafletMap'

/**
 * Leaflet and its stylesheet are ~140 kB and only the plan template draws maps —
 * and only once the user has opted in. Loading them lazily keeps them out of the
 * initial bundle for the two card templates, which are the common case.
 */
const LeafletMap = lazy(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })))

export function MapFigure(props: {
  enabled: boolean
  points: MapPoint[]
  zoom?: number
  height: number
  caption?: string
  ariaLabel: string
}) {
  // The disabled and no-coordinates states are the common ones and need no map
  // library at all, so they render inline rather than behind the boundary.
  if (!props.enabled || props.points.length === 0) {
    return (
      <figure style={{ margin: 0 }} className="keep">
        <div style={placeholder}>
          {props.points.length === 0
            ? 'No coordinates for this point yet.'
            : 'Maps are off. Turn them on in the Rally panel to draw this from OpenStreetMap.'}
        </div>
      </figure>
    )
  }

  return (
    <Suspense
      fallback={
        <figure style={{ margin: 0 }} className="keep">
          <div style={{ ...placeholder, height: props.height }}>Loading the map…</div>
        </figure>
      }
    >
      <LeafletMap {...props} />
    </Suspense>
  )
}

const placeholder = {
  minHeight: 44,
  border: `1px solid ${color.hairlineCool}`,
  boxSizing: 'border-box' as const,
  background: '#f4f3f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
  padding: 12,
  fontSize: 12,
  lineHeight: 1.45,
  color: color.mutedInk,
}
