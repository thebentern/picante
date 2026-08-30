import { useRef } from 'react'
import type { Doc } from '../../doc/schema'
import { useDocStore } from '../../doc/store'
import { download, stem } from '../../export/download'

/**
 * Save, load, and the privacy statement.
 *
 * There is deliberately no "share by link". A URL fragment would be free to
 * build and would put rally point addresses into browser history and into any
 * chat window the link is pasted into — on a document whose own OPSEC notice
 * says to avoid exactly that. Files are passed around instead.
 */
export function FilePanel({ doc }: { doc: Doc }) {
  const importJson = useDocStore((s) => s.importJson)
  const reset = useDocStore((s) => s.reset)
  const loadError = useDocStore((s) => s.loadError)
  const clearLoadError = useDocStore((s) => s.clearLoadError)
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="panel">
      <section>
        <h2>Your data</h2>
        <p>
          This document never leaves your browser. It is kept in local storage on this machine and
          exported as a file you control. There is no account, no server, and no analytics.
        </p>
        <p>
          The only requests this app can make with your content in them are OpenStreetMap map tiles
          and address lookups, and both are off until you turn them on.
        </p>
      </section>

      <section>
        <h2>Save and load</h2>
        <div className="row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              download(
                JSON.stringify(doc, null, 2),
                `${stem(doc.meta.orgShort || doc.meta.org, 'pace', doc.meta.revision)}.json`,
                'application/json',
              )
            }
          >
            Save as JSON
          </button>
          <button type="button" className="btn" onClick={() => input.current?.click()}>
            Load a file…
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              clearLoadError()
              importJson(await file.text())
            }}
          />
        </div>
        <p className="field__hint">
          Pass this file around to share a card. Documents written by older builds are upgraded on
          load.
        </p>
        {loadError ? (
          <div className="notice notice--bad" style={{ marginTop: '0.5rem' }}>
            <strong>Could not load that file</strong>
            {loadError}
          </div>
        ) : null}
      </section>

      <section>
        <h2>Start over</h2>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (
              confirm(
                'Replace the current document with the default one? Undo will bring it back, but ' +
                  'saving a copy first is safer.',
              )
            ) {
              reset()
            }
          }}
        >
          Reset to the default document
        </button>
      </section>
    </div>
  )
}
