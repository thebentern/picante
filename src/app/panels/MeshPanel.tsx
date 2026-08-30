import { useEffect, useState } from 'react'
import type { Doc } from '../../doc/schema'
import { decodeChannelSet, MeshUrlError } from '../../mesh/channelSet'
import { qrModuleCount, scanRisk } from '../../mesh/qr'
import { meshChannelKeyLabel } from '../../templates/derive'
import { TextArea } from './Field'

/**
 * Meshtastic provisioning.
 *
 * The paste path is the one that matters: decoding the channel set out of the
 * URL means the roles printed on the card are read from the same bytes the
 * radios are provisioned with, so they cannot drift. A typed list can, and the
 * app says so when it is.
 *
 * Nothing here ships in the repository — no QR image, no channel names, no
 * default URL. Everything the user enters stays in their browser.
 */
export function MeshPanel({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const [draft, setDraft] = useState(doc.mesh.url)
  const [error, setError] = useState<string | null>(null)
  const [risk, setRisk] = useState<{ dotsPerModule: number; ok: boolean; moduleCount: number } | null>(
    null,
  )

  useEffect(() => setDraft(doc.mesh.url), [doc.mesh.url])

  // The label prints this QR at 16 mm. Past a certain module count that stops
  // scanning off a 300 dpi thermal head, and the only way to find out otherwise
  // is to print one and try.
  useEffect(() => {
    const url = doc.mesh.url.trim()
    if (!url) {
      setRisk(null)
      return
    }
    let live = true
    qrModuleCount(url)
      .then((n) => live && setRisk(scanRisk(n, 16, 300)))
      .catch(() => live && setRisk(null))
    return () => {
      live = false
    }
  }, [doc.mesh.url])

  const apply = async () => {
    const url = draft.trim()
    if (!url) {
      update((d) => {
        d.mesh.url = ''
        d.mesh.channels = []
        d.mesh.radioConfig = []
        d.mesh.channelsVerified = false
      })
      setError(null)
      return
    }
    try {
      const decoded = await decodeChannelSet(url)
      update((d) => {
        d.mesh.url = url
        d.mesh.channels = decoded.channels
        d.mesh.radioConfig = decoded.radioConfig
        d.mesh.channelsVerified = true
      })
      setError(null)
    } catch (err) {
      setError(err instanceof MeshUrlError ? err.message : String(err))
    }
  }

  const onUpload = async (file: File) => {
    if (file.size > 2_000_000) {
      setError('That image is over 2 MB. A QR code should be a few tens of kilobytes.')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    update((d) => {
      d.mesh.qrImage = dataUrl
      // An uploaded image cannot be decoded, so any channel list beside it is
      // hand-typed until proven otherwise.
      d.mesh.channelsVerified = false
    })
    setError(null)
  }

  return (
    <div className="panel">
      <section>
        <h2>Provisioning URL</h2>
        <p>
          Open the Meshtastic app, go to Channels and share your channel set, then paste the URL
          here. The QR is generated in this browser and the channel list is read out of the code
          itself, so what the card prints is what the radios actually get.
        </p>
        <textarea
          rows={3}
          className="mono"
          aria-label="Meshtastic provisioning URL"
          placeholder="https://meshtastic.org/e/#..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ fontSize: '0.78rem' }}
        />
        <div className="row" style={{ marginTop: '0.4rem' }}>
          <button type="button" className="btn btn--primary" onClick={() => void apply()}>
            {draft.trim() ? 'Decode and use' : 'Clear'}
          </button>
          {doc.mesh.url ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--ok)' }}>
              {doc.mesh.channels.length} channel{doc.mesh.channels.length === 1 ? '' : 's'} read from
              the code
            </span>
          ) : null}
        </div>
        {error ? (
          <div className="notice notice--bad" style={{ marginTop: '0.5rem' }}>
            {error}
          </div>
        ) : null}

        {risk && !risk.ok ? (
          <div className="notice" style={{ marginTop: '0.5rem' }}>
            <strong>This QR may not scan off a printed label</strong>
            {risk.moduleCount} modules across at 16 mm works out to{' '}
            {risk.dotsPerModule.toFixed(1)} printer dots per module, and a 300 dpi thermal head
            smears below about 2.5. Trim the channel set, or print the fold card, where the same
            code gets 112 px.
          </div>
        ) : null}
      </section>

      <section>
        <h2>Channels</h2>
        {doc.mesh.channels.length === 0 ? (
          <p>None yet. Paste a provisioning URL above, or add rows by hand below.</p>
        ) : (
          doc.mesh.channels.map((ch, i) => (
            <div className="card" key={i}>
              <div className="card__head">
                <span className="card__title" style={{ fontFamily: 'var(--mono)' }}>
                  {ch.name}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: ch.keyKind === 'private' ? 'var(--ok)' : 'var(--bad)',
                    fontWeight: 700,
                  }}
                >
                  {meshChannelKeyLabel(ch.keyKind)}
                </span>
              </div>
              <input
                aria-label={`${ch.name} role`}
                value={ch.role}
                onChange={(e) => update((d) => void (d.mesh.channels[i]!.role = e.target.value))}
                              />
              {ch.keyKind !== 'private' ? (
                <div className="field__hint">
                  Readable by anyone in range. The cards carry a warning about this automatically.
                </div>
              ) : null}
            </div>
          ))
        )}

        {!doc.mesh.channelsVerified && doc.mesh.channels.length > 0 ? (
          <div className="notice">
            <strong>Typed, not decoded</strong>
            These names were entered by hand, so the printed roles can drift from what the QR
            actually provisions. Paste the URL above to have them read from the code.
          </div>
        ) : null}
      </section>

      <section>
        <h2>QR image</h2>
        <p>
          Only needed if your QR came from somewhere other than the app — a URL generates a sharper
          one, and keeps the channel list honest.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg"
          aria-label="Upload a QR image"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onUpload(file)
          }}
        />
        {doc.mesh.qrImage ? (
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <img
              src={doc.mesh.qrImage}
              alt="Uploaded QR code"
              style={{ width: 64, height: 64, border: '1px solid var(--line)' }}
            />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => update((d) => void (d.mesh.qrImage = null))}
            >
              Remove
            </button>
            {doc.mesh.url ? (
              <span className="field__hint">
                The generated QR from the URL takes priority over this upload.
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section>
        <h2>Wording</h2>
        <TextArea
          label="Encryption warning"
          rows={2}
          value={doc.mesh.warning}
          onChange={(v) => update((d) => void (d.mesh.warning = v))}
        />
        <TextArea
          label="Provisioning note (plan)"
          rows={4}
          value={doc.mesh.note}
          onChange={(v) => update((d) => void (d.mesh.note = v))}
        />
      </section>
    </div>
  )
}
