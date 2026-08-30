import { useState } from 'react'
import type { Channel, Doc, Repeater } from '../../doc/schema'
import { BAND_PLANS } from '../../doc/bandPlans'
import { TextArea, TextField } from './Field'

/**
 * Channels and repeaters, entered freely.
 *
 * An earlier version made this a picker over a hard-coded FRS/GMRS table, which
 * quietly decided what radio service a unit was on. A unit might be on FRS,
 * GMRS, MURS, business band, an amateur allocation, or a mix — so every field
 * here is free text, and the sequence is whatever order the unit actually rolls
 * through.
 *
 * The band-plan quick-add stays because typing 462.7125 by hand is how you get
 * a card with a wrong digit on it. It inserts rows; it does not constrain them,
 * and adding another service to doc/bandPlans.ts adds it to the menu.
 */

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function ChannelsPanel({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const [quickAdd, setQuickAdd] = useState('')

  const move = (index: number, delta: number) =>
    update((d) => {
      const next = index + delta
      if (next < 0 || next >= d.channels.sequence.length) return
      const list = d.channels.sequence
      ;[list[index], list[next]] = [list[next]!, list[index]!]
    })

  const addChannel = (channel?: Partial<Channel>) =>
    update((d) =>
      void d.channels.sequence.push({
        id: newId('ch'),
        label: channel?.label ?? '',
        short: channel?.short ?? '',
        freq: channel?.freq ?? '',
      }),
    )

  return (
    <div className="panel">
      <section>
        <h2>Channel sequence</h2>
        <p>
          The channels the unit works on, in the order it steps through them. This list drives both
          cards, the plan, and the <code>{'{rollover}'}</code> token in the PACE copy — so the prose
          cannot drift from the radios.
        </p>

        {doc.channels.sequence.length === 0 ? (
          <p>Nothing here yet. Add a channel below, or insert a band plan.</p>
        ) : (
          doc.channels.sequence.map((channel, i) => (
            <div className="card" key={channel.id}>
              <div className="card__head">
                <span className="card__title">{i + 1}</span>
                <span className="row" style={{ gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${channel.label || `channel ${i + 1}`} earlier`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => move(i, 1)}
                    disabled={i === doc.channels.sequence.length - 1}
                    aria-label={`Move ${channel.label || `channel ${i + 1}`} later`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => update((d) => void d.channels.sequence.splice(i, 1))}
                    aria-label={`Remove ${channel.label || `channel ${i + 1}`}`}
                  >
                    ×
                  </button>
                </span>
              </div>

              <div className="row">
                <div className="grow">
                  <TextField
                    label="Name"
                    ariaLabel={`Channel ${i + 1} name`}
                    value={channel.label}
                    placeholder="GMRS 7"
                    onChange={(v) => update((d) => void (d.channels.sequence[i]!.label = v))}
                  />
                </div>
                <div style={{ width: '5rem' }}>
                  <TextField
                    label="Short"
                    ariaLabel={`Channel ${i + 1} short`}
                    value={channel.short}
                    placeholder="7"
                    onChange={(v) => update((d) => void (d.channels.sequence[i]!.short = v))}
                  />
                </div>
              </div>
              <TextField
                label="Frequency (MHz)"
                ariaLabel={`Channel ${i + 1} frequency (MHz)`}
                mono
                value={channel.freq}
                placeholder="462.7125"
                onChange={(v) => update((d) => void (d.channels.sequence[i]!.freq = v))}
              />
              {i === 0 ? (
                <div className="field__hint">
                  “Short” is what appears in the rollover sequence and on the 62 mm label, where the
                  full name will not fit.
                </div>
              ) : null}
            </div>
          ))
        )}

        <div className="row">
          <button type="button" className="btn btn--ghost" onClick={() => addChannel()}>
            Add channel
          </button>
          <label className="row" style={{ gap: '0.35rem' }}>
            <span className="visually-hidden">Insert from a band plan</span>
            <select
              value={quickAdd}
              onChange={(e) => {
                const [planId, preset] = e.target.value.split(':')
                const found = BAND_PLANS.find((p) => p.id === planId)?.channels.find(
                  (c) => String(c.preset) === preset,
                )
                if (found) {
                  addChannel({ label: found.name, short: String(found.preset), freq: found.freq })
                }
                setQuickAdd('')
              }}
              className="control control--auto"
            >
              <option value="">Insert from a band plan…</option>
              {BAND_PLANS.map((plan) => (
                <optgroup key={plan.id} label={`${plan.name} — ${plan.source}`}>
                  {plan.channels.map((c) => (
                    <option key={c.preset} value={`${plan.id}:${c.preset}`}>
                      {c.name} · {c.freq}
                      {c.note ? ` (${c.note})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <TextArea
          label="Caveat (plan only)"
          rows={7}
          value={doc.channels.caveat}
          onChange={(v) => update((d) => void (d.channels.caveat = v))}
        />
      </section>

      <section>
        <h2>Weather</h2>
        <TextField
          label="Station"
          value={doc.channels.weather.label}
          onChange={(v) => update((d) => void (d.channels.weather.label = v))}
          hint="Naming a specific office is a location hint. A generic label prints the same."
        />
        <TextField
          label="Frequency"
          mono
          value={doc.channels.weather.freq}
          onChange={(v) => update((d) => void (d.channels.weather.freq = v))}
        />
        <TextArea
          label="Note (plan only)"
          rows={3}
          value={doc.channels.weather.note}
          onChange={(v) => update((d) => void (d.channels.weather.note = v))}
        />
      </section>

      <section>
        <h2>Repeaters</h2>
        <p>
          Plan template only, and band-agnostic — 2 m, 70 cm, GMRS, whatever your unit monitors.
          Ships empty: a repeater list identifies the area it covers, so this app comes without one.
        </p>
        {doc.channels.repeaters.map((repeater, i) => (
          <RepeaterCard
            key={repeater.id}
            repeater={repeater}
            onChange={(fn) => update((d) => fn(d.channels.repeaters[i]!))}
            onRemove={() => update((d) => void d.channels.repeaters.splice(i, 1))}
          />
        ))}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            update((d) =>
              void d.channels.repeaters.push({
                id: newId('rp'),
                preset: '',
                band: '',
                call: '',
                freq: '',
                tone: '',
              }),
            )
          }
        >
          Add repeater
        </button>
      </section>
    </div>
  )
}

function RepeaterCard({
  repeater,
  onChange,
  onRemove,
}: {
  repeater: Repeater
  onChange: (fn: (r: Repeater) => void) => void
  onRemove: () => void
}) {
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">{repeater.call || 'New repeater'}</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div className="row">
        <div style={{ width: '4.5rem' }}>
          <TextField
            label="Preset"
            value={repeater.preset}
            placeholder="28"
            onChange={(v) => onChange((r) => void (r.preset = v))}
          />
        </div>
        <div style={{ width: '5.5rem' }}>
          <TextField
            label="Band"
            value={repeater.band}
            placeholder="2 m"
            onChange={(v) => onChange((r) => void (r.band = v))}
          />
        </div>
        <div className="grow">
          <TextField
            label="Call"
            value={repeater.call}
            onChange={(v) => onChange((r) => void (r.call = v))}
          />
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <TextField
            label="Frequency (MHz)"
            mono
            value={repeater.freq}
            placeholder="146.940"
            onChange={(v) => onChange((r) => void (r.freq = v))}
          />
        </div>
        <div className="grow">
          <TextField
            label="Offset / tone"
            mono
            value={repeater.tone}
            placeholder="−600 / 107.2"
            onChange={(v) => onChange((r) => void (r.tone = v))}
            hint="A repeater is unusable without these."
          />
        </div>
      </div>
    </div>
  )
}
