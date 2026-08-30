import { create } from 'zustand'
import { createDefaultDoc } from './defaults'
import { migrate, DocLoadError } from './migrate'
import type { Doc, TemplateId } from './schema'

const STORAGE_KEY = 'picante.doc.v1'
const HISTORY_LIMIT = 100

/** Structured-clone a document so history entries can't alias live state. */
const clone = <T,>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T)

function loadPersisted(): Doc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return migrate(JSON.parse(raw))
  } catch (err) {
    // A corrupt or stale autosave must never lock the user out of the app.
    console.warn('picante: discarding unreadable autosave —', err)
    return null
  }
}

interface State {
  doc: Doc
  template: TemplateId
  /** Bumped whenever the document changes, so effects can depend on one number. */
  revisionCounter: number
  past: Doc[]
  future: Doc[]
  /** Non-null while the last import/paste failed, for display in the UI. */
  loadError: string | null

  setTemplate: (t: TemplateId) => void
  /**
   * Apply a change. `coalesceKey` merges consecutive edits to the same field
   * into one undo step, so typing a sentence is not 40 undos.
   */
  update: (fn: (draft: Doc) => void, coalesceKey?: string) => void
  undo: () => void
  redo: () => void
  replace: (doc: Doc) => void
  reset: () => void
  importJson: (text: string) => void
  clearLoadError: () => void
}

let lastCoalesceKey: string | null = null

export const useDocStore = create<State>((set, get) => ({
  doc: loadPersisted() ?? createDefaultDoc(),
  template: 'fold',
  revisionCounter: 0,
  past: [],
  future: [],
  loadError: null,

  setTemplate: (template) => set({ template }),

  update: (fn, coalesceKey) =>
    set((s) => {
      const next = clone(s.doc)
      fn(next)
      const merge = coalesceKey != null && coalesceKey === lastCoalesceKey && s.past.length > 0
      lastCoalesceKey = coalesceKey ?? null
      const past = merge ? s.past : [...s.past, s.doc].slice(-HISTORY_LIMIT)
      return { doc: next, past, future: [], revisionCounter: s.revisionCounter + 1 }
    }),

  undo: () =>
    set((s) => {
      const prev = s.past.at(-1)
      if (!prev) return s
      lastCoalesceKey = null
      return {
        doc: prev,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future].slice(0, HISTORY_LIMIT),
        revisionCounter: s.revisionCounter + 1,
      }
    }),

  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      lastCoalesceKey = null
      return {
        doc: next,
        past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        revisionCounter: s.revisionCounter + 1,
      }
    }),

  replace: (doc) =>
    set((s) => {
      lastCoalesceKey = null
      return {
        doc,
        past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: [],
        revisionCounter: s.revisionCounter + 1,
        loadError: null,
      }
    }),

  reset: () => get().replace(createDefaultDoc()),

  importJson: (text) => {
    try {
      get().replace(migrate(JSON.parse(text)))
    } catch (err) {
      const message =
        err instanceof DocLoadError
          ? err.message
          : err instanceof SyntaxError
            ? 'That file is not valid JSON.'
            : 'That file could not be read as a PACE document.'
      set({ loadError: message })
    }
  },

  clearLoadError: () => set({ loadError: null }),
}))

/**
 * Autosave. Debounced so a burst of keystrokes writes once, and failure-tolerant
 * because a browser in private mode (or with site data blocked) throws on write
 * and must not take the editor down with it.
 */
let saveTimer: ReturnType<typeof setTimeout> | undefined
export function startAutosave() {
  return useDocStore.subscribe((s, prev) => {
    if (s.doc === prev.doc) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s.doc))
      } catch (err) {
        console.warn('picante: could not autosave to local storage —', err)
      }
    }, 400)
  })
}

export { STORAGE_KEY }
