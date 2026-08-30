import { useState, type RefObject } from 'react'
import type { Doc } from '../doc/schema'
import type { OverflowReport } from '../overflow/probe'
import { ContentPanel } from './panels/ContentPanel'
import { ChannelsPanel } from './panels/ChannelsPanel'
import { RallyPanel } from './panels/RallyPanel'
import { MeshPanel } from './panels/MeshPanel'
import { ExportPanel } from './panels/ExportPanel'
import { FilePanel } from './panels/FilePanel'

const TABS = [
  { id: 'content', label: 'Content' },
  { id: 'channels', label: 'Channels' },
  { id: 'rally', label: 'Rally' },
  { id: 'mesh', label: 'Mesh' },
  { id: 'export', label: 'Print' },
  { id: 'file', label: 'File' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Sidebar({
  doc,
  update,
  printRoot,
  exportBlocked,
  overflowReport,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
  printRoot: RefObject<HTMLElement | null>
  exportBlocked: boolean
  overflowReport: OverflowReport
}) {
  const [tab, setTab] = useState<TabId>('content')

  return (
    <div data-export="false" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div className="tabs" role="tablist" aria-label="Editor panels">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
        {tab === 'content' && <ContentPanel doc={doc} update={update} />}
        {tab === 'channels' && <ChannelsPanel doc={doc} update={update} />}
        {tab === 'rally' && <RallyPanel doc={doc} update={update} />}
        {tab === 'mesh' && <MeshPanel doc={doc} update={update} />}
        {tab === 'export' && (
          <ExportPanel
            doc={doc}
            printRoot={printRoot}
            blocked={exportBlocked}
            report={overflowReport}
          />
        )}
        {tab === 'file' && <FilePanel doc={doc} />}
      </div>
    </div>
  )
}
