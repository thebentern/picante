import { useDocStore } from '../doc/store'
import { TEMPLATES, type TemplateId } from '../doc/schema'
import type { RenderMode } from '../editing/context'

export function Toolbar({
  mode,
  onModeChange,
  zoom,
  zooms,
  onZoomChange,
}: {
  mode: RenderMode
  onModeChange: (m: RenderMode) => void
  zoom: number
  zooms: readonly number[]
  onZoomChange: (z: number) => void
}) {
  const template = useDocStore((s) => s.template)
  const setTemplate = useDocStore((s) => s.setTemplate)
  const undo = useDocStore((s) => s.undo)
  const redo = useDocStore((s) => s.redo)
  const canUndo = useDocStore((s) => s.past.length > 0)
  const canRedo = useDocStore((s) => s.future.length > 0)

  return (
    <header className="toolbar" data-export="false">
      <div className="toolbar__brand">
        PACE card builder
        <span>picante</span>
      </div>

      <div className="segmented" role="group" aria-label="Template">
        {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={template === id}
            title={TEMPLATES[id].blurb}
            onClick={() => setTemplate(id)}
          >
            {TEMPLATES[id].name}
          </button>
        ))}
      </div>

      <div className="segmented" role="group" aria-label="Editing mode">
        <button type="button" aria-pressed={mode === 'edit'} onClick={() => onModeChange('edit')}>
          Edit
        </button>
        <button
          type="button"
          aria-pressed={mode === 'preview'}
          onClick={() => onModeChange('preview')}
          title="Exactly what exports — editing chrome hidden, the fold card's back panel rotated"
        >
          Preview
        </button>
      </div>

      <div className="toolbar__spacer" />

      <label className="row" style={{ gap: '0.35rem', fontSize: '0.8rem' }}>
        <span className="visually-hidden">Zoom</span>
        <select
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="control control--auto"
        >
          {zooms.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="btn btn--ghost" onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button type="button" className="btn btn--ghost" onClick={redo} disabled={!canRedo}>
        Redo
      </button>
    </header>
  )
}
