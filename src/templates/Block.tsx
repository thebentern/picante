import type { CSSProperties, ReactNode } from 'react'
import { useEditing } from '../editing/context'

/**
 * A named region the overflow probe can measure and attribute a clip to.
 *
 * `clip` marks a container whose height is fixed and whose surplus is silently
 * discarded; `label` names it in the overflow report ("Back panel · left column:
 * 14 px over"). `pinned` marks a bottom-pinned child whose margin-top:auto
 * collapses to 0 under pressure — the specific failure that ate the OPSEC
 * notice four times during the design phase.
 */
export function Block({
  label,
  clip = false,
  pinned = false,
  as: Tag = 'div',
  style,
  children,
}: {
  label: string
  clip?: boolean
  pinned?: boolean
  as?: 'div' | 'section' | 'td'
  style?: CSSProperties
  children: ReactNode
}) {
  const { mode, highlightedBlock } = useEditing()
  const highlighted = mode === 'edit' && highlightedBlock === label
  return (
    <Tag
      data-block={label}
      data-clip={clip ? '' : undefined}
      data-pinned={pinned ? '' : undefined}
      style={{
        ...style,
        ...(highlighted
          ? { outline: '2px solid #b45309', outlineOffset: '2px', borderRadius: '1px' }
          : null),
      }}
    >
      {children}
    </Tag>
  )
}
