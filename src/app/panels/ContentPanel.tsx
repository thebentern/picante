import type { Doc } from '../../doc/schema'
import { TIER_COLORS } from '../../doc/schema'
import { formatRevision, formatRevisionShort } from '../../doc/defaults'
import { advisories } from '../../doc/advisories'
import { TextArea, TextField } from './Field'

const FOOTPRINT = {
  card: 'Fold card',
  label: 'Thermal label',
  plan: 'Full plan',
} as const

const HINT = {
  card: 'Pinned to the bottom, which makes it the first thing clipped when the page overflows.',
  label: 'The 62 × 100 mm label has room for about one sentence less than the fold card.',
  plan: undefined,
} as const

export function ContentPanel({
  doc,
  update,
}: {
  doc: Doc
  update: (fn: (d: Doc) => void) => void
}) {
  const notes = advisories(doc)

  return (
    <div className="panel">
      {notes.length > 0 ? (
        <section>
          <h2>Worth knowing</h2>
          {notes.map((a) => (
            <div key={a.id} className={`notice ${a.severity === 'warn' ? '' : 'notice--info'}`}>
              <strong>{a.title}</strong>
              {a.detail}
            </div>
          ))}
        </section>
      ) : null}

      <section>
        <h2>Header</h2>
        <TextField
          label="Title"
          value={doc.meta.title}
          onChange={(v) => update((d) => void (d.meta.title = v))}
        />
        <TextField
          label="Organization"
          value={doc.meta.org}
          onChange={(v) => update((d) => void (d.meta.org = v))}
        />
        <TextField
          label="Organization (label)"
          value={doc.meta.orgShort}
          onChange={(v) => update((d) => void (d.meta.orgShort = v))}
          hint="The 62 × 100 mm label has room for about six characters here."
        />
        <TextField
          label="Revision"
          value={doc.meta.revision}
          onChange={(v) => update((d) => void (d.meta.revision = v))}
        />
        <TextField
          label="Revision (label)"
          value={doc.meta.revisionShort}
          onChange={(v) => update((d) => void (d.meta.revisionShort = v))}
        />
        <button
          type="button"
          className="btn btn--ghost btn--small"
          style={{ marginTop: '0.4rem' }}
          onClick={() =>
            update((d) => {
              const now = new Date()
              d.meta.revision = `Rev. ${formatRevision(now)}`
              d.meta.revisionShort = `REV ${formatRevisionShort(now)}`
            })
          }
        >
          Set to today
        </button>
        <TextField
          label="Subtitle"
          value={doc.meta.subtitle}
          onChange={(v) => update((d) => void (d.meta.subtitle = v))}
        />
        <TextField
          label="Eyebrow"
          value={doc.meta.eyebrow}
          onChange={(v) => update((d) => void (d.meta.eyebrow = v))}
        />
      </section>

      <section>
        <h2>PACE ladder</h2>
        <p>
          Type <code>{'{rollover}'}</code> anywhere in the body copy and it renders the live channel
          sequence, so the prose cannot drift from the channel list.
        </p>
        {doc.pace.map((tier, i) => (
          <div className="card" key={tier.letter}>
            <div className="card__head">
              <span className="card__title">{tier.letter}</span>
              <div className="swatches" role="group" aria-label={`${tier.letter} tier colour`}>
                {TIER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="swatch"
                    style={{ background: c }}
                    aria-label={c}
                    aria-pressed={tier.color === c}
                    onClick={() => update((d) => void (d.pace[i]!.color = c))}
                  />
                ))}
              </div>
            </div>
            <TextField
              label="Label"
              value={tier.label}
              onChange={(v) => update((d) => void (d.pace[i]!.label = v))}
            />
            <TextArea
              label="Body"
              rows={3}
              value={tier.body}
              onChange={(v) => update((d) => void (d.pace[i]!.body = v))}
            />
            <TextField
              label="Label heading (62 mm)"
              value={tier.shortLabel}
              onChange={(v) => update((d) => void (d.pace[i]!.shortLabel = v))}
            />
            <TextField
              label="Label body (62 mm)"
              value={tier.shortBody}
              onChange={(v) => update((d) => void (d.pace[i]!.shortBody = v))}
              hint="One line at 6.5 pt. This is the tightest field in the whole deck."
            />
            <TextArea
              label={`${tier.letter} plan detail`}
              rows={8}
              value={tier.detail}
              onChange={(v) => update((d) => void (d.pace[i]!.detail = v))}
              hint="Section 2 of the full plan. Leave a blank line between paragraphs."
            />
          </div>
        ))}
      </section>

      <section>
        <h2>Report formats</h2>
        <TextField
          label="Routine"
          mono
          value={doc.formats.routine}
          onChange={(v) => update((d) => void (d.formats.routine = v))}
        />
        <TextField
          label="Emergency"
          mono
          value={doc.formats.emergency}
          onChange={(v) => update((d) => void (d.formats.emergency = v))}
        />
      </section>

      <section>
        <h2>Check-in windows</h2>
        {doc.checkIn.levels.map((level, i) => (
          <div className="card" key={i}>
            <div className="row">
              <div className="grow">
                <TextField
                  label="Name"
                  ariaLabel={`Status ${i + 1} name`}
                  value={level.name}
                  onChange={(v) => update((d) => void (d.checkIn.levels[i]!.name = v))}
                />
              </div>
              <div className="grow">
                <TextField
                  label="Interval"
                  ariaLabel={`Status ${i + 1} interval`}
                  value={level.interval}
                  onChange={(v) => update((d) => void (d.checkIn.levels[i]!.interval = v))}
                />
              </div>
            </div>
            <TextField
              label="Typical condition (plan only)"
              ariaLabel={`Status ${i + 1} typical condition`}
              value={level.condition}
              onChange={(v) => update((d) => void (d.checkIn.levels[i]!.condition = v))}
            />
          </div>
        ))}
        <TextField
          label="Life-safety line"
          value={doc.checkIn.lifeSafety}
          onChange={(v) => update((d) => void (d.checkIn.lifeSafety = v))}
        />
        <TextField
          label="No-change line"
          value={doc.checkIn.noChange}
          onChange={(v) => update((d) => void (d.checkIn.noChange = v))}
        />
      </section>

      <section>
        <h2>Missed windows</h2>
        {doc.missed.map((m, i) => (
          <TextField
            key={i}
            label={`Step ${m.step}`}
            value={m.text}
            onChange={(v) => update((d) => void (d.missed[i]!.text = v))}
          />
        ))}
      </section>

      <section>
        <h2>Remarks</h2>
        <p>
          A free block pinned to the bottom of each footprint. It defaults to an OPSEC notice
          because that is what these cards usually carry last, but the heading is yours — put
          whatever your unit needs to read there.
        </p>
        {(['card', 'label', 'plan'] as const).map((which) => (
          <div className="card" key={which}>
            <div className="card__head">
              <span className="card__title">{FOOTPRINT[which]}</span>
              <label className="row" style={{ gap: '0.35rem', fontSize: '0.75rem' }}>
                <span className="visually-hidden">{FOOTPRINT[which]} remarks tone</span>
                <select
                  value={doc.remarks[which].tone}
                  onChange={(e) =>
                    update(
                      (d) =>
                        void (d.remarks[which].tone = e.target.value as 'warning' | 'neutral'),
                    )
                  }
                  className="control control--auto"
                >
                  <option value="warning">Warning (red)</option>
                  <option value="neutral">Neutral (ink)</option>
                </select>
              </label>
            </div>
            {/* Labelled per footprint: three fields all called "Heading" are
                three identical announcements to a screen reader, and an
                ambiguous target for anything scripting the page. */}
            <TextField
              label="Heading"
              ariaLabel={`${FOOTPRINT[which]} remarks heading`}
              value={doc.remarks[which].heading}
              placeholder="OPSEC"
              onChange={(v) => update((d) => void (d.remarks[which].heading = v))}
            />
            <TextArea
              label="Text"
              ariaLabel={`${FOOTPRINT[which]} remarks text`}
              rows={which === 'plan' ? 4 : 3}
              value={doc.remarks[which].body}
              onChange={(v) => update((d) => void (d.remarks[which].body = v))}
              hint={HINT[which]}
            />
          </div>
        ))}
      </section>

    </div>
  )
}
