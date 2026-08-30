import { createContext, useContext } from 'react'

/**
 * Templates are rendered in three situations and need to behave differently in
 * each: live in the editor (contenteditable, focus rings), inside the offscreen
 * overflow probe (inert, no chrome), and for export (inert, no chrome).
 */
export type RenderMode = 'edit' | 'preview' | 'export'

export interface EditingContextValue {
  mode: RenderMode
  /** Commit a text edit. `key` coalesces consecutive edits into one undo step. */
  commit: (apply: () => void, key: string) => void
  /** Highlighted by the overflow report; drawn with an outline in edit mode. */
  highlightedBlock: string | null
}

const EditingContext = createContext<EditingContextValue>({
  mode: 'preview',
  commit: (apply) => apply(),
  highlightedBlock: null,
})

export const EditingProvider = EditingContext.Provider
export const useEditing = () => useContext(EditingContext)
