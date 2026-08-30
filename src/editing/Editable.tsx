import { useEffect, useRef, type CSSProperties, type ElementType } from 'react'
import { useEditing } from './context'
import { splitTokens } from '../doc/interpolate'

/**
 * In-place text editing on the rendered card. The card is the live preview;
 * there is no separate preview pane.
 *
 * Three things this has to get right:
 *
 *  - In edit mode the element's contents are NOT React children. Every
 *    keystroke updates the document, which re-renders, and React reconciling
 *    the text node under a live caret scrambles the input — "Comms Card v2"
 *    typed into a field comes out "2vComms C ard". So the editable's DOM is
 *    uncontrolled: built imperatively on mount and re-synced from props only
 *    while the element is unfocused.
 *  - Because of that, the element must REMOUNT when the mode changes. React's
 *    virtual model of an edit-mode editable says "no children"; render children
 *    into that same element for preview and React appends them beside the
 *    imperatively-built text node instead of replacing it, so every field
 *    renders twice — and every export ships doubled text. The mode-keyed
 *    remount is what keeps the two rendering strategies from colliding.
 *  - Paste is forced to plain text. The document is JSON exchanged between
 *    machines; letting markup in through a paste would put arbitrary HTML into
 *    a print template.
 *  - Inline tokens ({rollover}) are inert spans the caret skips, serialized back
 *    to {name} on commit — so prose stays editable and stays in sync with the
 *    channel list, without the user ever seeing a curly brace. Token content is
 *    described as plain runs rather than ReactNode so the React path and the
 *    imperative repair path produce byte-identical DOM.
 */

export interface TokenRun {
  text: string
  style?: CSSProperties
}

export interface TokenRender {
  name: string
  runs: TokenRun[]
  style?: CSSProperties
}

export function Editable({
  value,
  onCommit,
  commitKey,
  as: Tag = 'span',
  style,
  tokens,
  multiline = false,
  ariaLabel,
}: {
  value: string
  onCommit: (next: string) => void
  /** Groups consecutive edits to this field into one undo step. */
  commitKey: string
  as?: ElementType
  style?: CSSProperties
  tokens?: TokenRender[]
  multiline?: boolean
  ariaLabel?: string
}) {
  const { mode, commit } = useEditing()
  const ref = useRef<HTMLElement>(null)
  const editing = mode === 'edit'

  // A token's *rendered* content can change while the template string does not
  // — editing the channel list rewrites {rollover} without touching the prose
  // around it — so the sync has to watch both.
  const signature = tokens ? JSON.stringify(tokens) : ''
  const lastSignature = useRef<string | null>(null)

  // Build and sync the DOM by hand; see the caret note above. Never while the
  // element has focus.
  useEffect(() => {
    const el = ref.current
    if (!el || !editing) return
    if (document.activeElement === el) return
    if (serialize(el) === value && lastSignature.current === signature) return
    renderInto(el, value, tokens)
    lastSignature.current = signature
  }, [value, editing, tokens, signature])

  if (!editing) {
    return (
      <Tag key="read" style={style}>
        {splitTokens(value).map((seg, i) => {
          if (seg.kind === 'text') return seg.value
          const t = tokens?.find((tk) => tk.name === seg.name)
          return (
            <span key={i} data-token={seg.name} style={tokenStyle(t)}>
              {t
                ? t.runs.map((run, j) => (
                    <span key={j} style={run.style}>
                      {run.text}
                    </span>
                  ))
                : `{${seg.name}}`}
            </span>
          )
        })}
      </Tag>
    )
  }

  return (
    <Tag
      key="edit"
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline={multiline || undefined}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-editable=""
      style={{ ...style, outline: 'none' }}
      onPaste={(e: React.ClipboardEvent) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        insertText(multiline ? text : text.replace(/\s*\n+\s*/g, ' '))
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault()
          ;(e.target as HTMLElement).blur()
        }
        if (e.key === 'Escape') {
          const el = ref.current
          if (el) renderInto(el, value, tokens)
          ;(e.target as HTMLElement).blur()
        }
      }}
      onInput={(e: React.FormEvent) => {
        commit(() => onCommit(serialize(e.currentTarget as HTMLElement)), commitKey)
      }}
      onBlur={(e: React.FocusEvent) => {
        const next = serialize(e.currentTarget as HTMLElement)
        if (next !== value) commit(() => onCommit(next), `${commitKey}:blur`)
      }}
    />
  )
}

const tokenStyle = (t?: TokenRender): CSSProperties => ({
  whiteSpace: 'nowrap',
  ...t?.style,
})

function insertText(text: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  // execCommand fires input for us; a manual DOM edit does not.
  node.parentElement?.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Read an editable element back to a template string: text nodes contribute
 * their text, token spans contribute {name}. Without this, a user editing
 * around a rollover token would flatten it into literal text and it would stop
 * tracking the channel list.
 */
function serialize(el: HTMLElement): string {
  let out = ''
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
    } else if (node instanceof HTMLElement) {
      out += node.dataset.token ? `{${node.dataset.token}}` : (node.textContent ?? '')
    }
  }
  // Browsers insert non-breaking spaces while editing; normalize so the stored
  // value stays plain text.
  return out.replace(/ /g, ' ')
}

function applyStyle(el: HTMLElement, style?: CSSProperties) {
  if (!style) return
  for (const [k, v] of Object.entries(style)) {
    if (v != null) el.style.setProperty(kebab(k), String(v))
  }
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Rebuild the element's DOM from the stored value (used to revert on Escape). */
function renderInto(el: HTMLElement, value: string, tokens?: TokenRender[]) {
  el.textContent = ''
  for (const seg of splitTokens(value)) {
    if (seg.kind === 'text') {
      el.append(document.createTextNode(seg.value))
      continue
    }
    const t = tokens?.find((tk) => tk.name === seg.name)
    const span = document.createElement('span')
    span.dataset.token = seg.name
    span.contentEditable = 'false'
    span.style.whiteSpace = 'nowrap'
    applyStyle(span, t?.style)
    if (t) {
      for (const run of t.runs) {
        const inner = document.createElement('span')
        applyStyle(inner, run.style)
        inner.textContent = run.text
        span.append(inner)
      }
    } else {
      span.textContent = `{${seg.name}}`
    }
    el.append(span)
  }
}
