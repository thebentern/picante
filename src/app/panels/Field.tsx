import type { ReactNode } from 'react'

/**
 * Plain labelled inputs mirroring the in-place editing on the card.
 *
 * This is not a fallback: it is the accessible path, and it is the only sane
 * way to edit 6.5 pt text on the thermal label. The card stays the live
 * preview either way.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function TextField({
  label,
  ariaLabel,
  value,
  onChange,
  hint,
  mono,
  placeholder,
}: {
  label: string
  /**
   * A unique accessible name where the visible label is deliberately short.
   * Eight fields all called "Name" are eight identical announcements and an
   * ambiguous target; but "Channel 2 name" as a visible label wraps in a narrow
   * column and drags its input out of line with the one beside it. So the
   * visible label stays short and the accessible name carries the index — and
   * it contains the visible text, which is what WCAG's label-in-name asks for.
   */
  ariaLabel?: string
  value: string
  onChange: (v: string) => void
  hint?: ReactNode
  mono?: boolean
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={mono ? 'mono' : undefined}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function TextArea({
  label,
  ariaLabel,
  value,
  onChange,
  hint,
  rows,
  placeholder,
}: {
  label: string
  /** See TextField: short visible label, unique accessible name. */
  ariaLabel?: string
  value: string
  onChange: (v: string) => void
  hint?: ReactNode
  rows?: number
  placeholder?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={rows}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}
