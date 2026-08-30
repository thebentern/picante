import { useCallback, useMemo, useRef, useState } from 'react'
import { useDocStore } from '../doc/store'
import type { Doc, TemplateId } from '../doc/schema'
import { EditingProvider, type RenderMode } from '../editing/context'
import { FoldCard } from '../templates/FoldCard'
import { Label } from '../templates/Label'
import { Plan } from '../templates/Plan'
import { PRINT_ROOT_ID } from '../templates/Page'
import { OverflowBar } from '../overflow/OverflowBar'
import { useOverflow } from '../overflow/useOverflow'
import { hasOverflow } from '../overflow/probe'
import { Toolbar } from './Toolbar'
import { Sidebar } from './Sidebar'

/** Zoom presets for the stage. The fold card at 100% does not fit most screens. */
const ZOOMS = [0.5, 0.65, 0.8, 1] as const

export function App() {
  const doc = useDocStore((s) => s.doc)
  const template = useDocStore((s) => s.template)
  const revisionCounter = useDocStore((s) => s.revisionCounter)
  const storeUpdate = useDocStore((s) => s.update)

  const [mode, setMode] = useState<RenderMode>('edit')
  const [zoom, setZoom] = useState<number>(0.65)
  const [highlightedBlock, setHighlightedBlock] = useState<string | null>(null)

  const printRoot = useRef<HTMLDivElement>(null)

  // The plan flows and paginates, so there is no fixed box for content to
  // overflow — the probe only applies to the two card templates.
  const report = useOverflow(printRoot, revisionCounter, template !== 'plan')
  const blocked = hasOverflow(report)

  // Undo coalescing: consecutive edits to the same field collapse into one
  // history entry, so typing a sentence is one undo and not forty. The commit
  // wrapper stashes the field key for the update that runs inside it, because
  // the field components call update() through their own onCommit handlers and
  // have no other way to say which field they are.
  const coalesceKey = useRef<string | undefined>(undefined)

  const update = useCallback(
    (fn: (d: Doc) => void) => storeUpdate(fn, coalesceKey.current),
    [storeUpdate],
  )

  const editing = useMemo(
    () => ({
      mode,
      commit: (apply: () => void, key: string) => {
        coalesceKey.current = key
        try {
          apply()
        } finally {
          coalesceKey.current = undefined
        }
      },
      highlightedBlock,
    }),
    [mode, highlightedBlock],
  )

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        zoom={zoom}
        zooms={ZOOMS}
        onZoomChange={setZoom}
      />

      <div className="app__body">
        <main className="stage">
          <div className="stage__inner" style={{ transform: `scale(${zoom})` }}>
            <EditingProvider value={editing}>
              <div id={PRINT_ROOT_ID} ref={printRoot} className="sheet-shadow">
                <TemplateView template={template} doc={doc} update={update} />
              </div>
            </EditingProvider>
          </div>
        </main>

        <aside className="sidebar" data-export="false">
          <Sidebar
            doc={doc}
            update={update}
            printRoot={printRoot}
            exportBlocked={blocked}
            overflowReport={report}
          />
          {template !== 'plan' ? (
            <OverflowBar report={report} onHighlight={setHighlightedBlock} />
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function TemplateView({
  template,
  doc,
  update,
}: {
  template: TemplateId
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  if (template === 'label') return <Label doc={doc} update={update} />
  if (template === 'plan') return <Plan doc={doc} update={update} />
  return <FoldCard doc={doc} update={update} />
}
