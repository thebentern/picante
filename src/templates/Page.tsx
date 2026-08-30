import { useEffect, useId, type CSSProperties, type ReactNode } from 'react'

/**
 * Physical page geometry — the replacement for the handoff's doc-page.js.
 *
 * This is the component that makes a 62 x 100 mm PDF actually 62 x 100 mm, so
 * three things from the original are ported deliberately rather than
 * reinvented:
 *
 *  1. `@page { margin: 0 }` — this is what denies Chrome a margin box to draw
 *     its date/URL/page-count furniture into. Suppressing the browser's own
 *     header is not a print-dialog setting we can rely on; it is a consequence
 *     of leaving no room for it.
 *  2. Print sizing is `width` + `height`, never `width` + `aspect-ratio`. The
 *     ratio is a rounded division of the same two numbers, and a few millionths
 *     of overflow spills a blank sheet after every page.
 *  3. Every print declaration is `!important`. Authored inline styles otherwise
 *     win over the page geometry, and a page that loses its height prints as a
 *     blank sheet with a perfect page box.
 */

export type PageMode =
  | { kind: 'fixed'; width: string; height: string }
  /** Flowing: the print engine paginates. `margin` is the per-page inset. */
  | { kind: 'flowing'; size: 'letter' | 'a4'; margin: string }

const PAPER = { letter: '8.5in 11in', a4: '210mm 297mm' } as const

function printCss(mode: PageMode, rootSelector: string): string {
  const sizeDescriptor =
    mode.kind === 'fixed' ? `${mode.width} ${mode.height}` : PAPER[mode.size]

  const common =
    `@page { size: ${sizeDescriptor}; margin: 0 }\n` +
    `@media print {\n` +
    `  html, body { margin:0 !important; padding:0 !important; background:none !important;\n` +
    `               height:auto !important; overflow:visible !important }\n` +
    `  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;\n` +
    `      backdrop-filter: none !important; -webkit-backdrop-filter: none !important }\n` +
    // Editing affordances never reach paper.
    `  [data-export="false"] { display: none !important }\n`

  if (mode.kind === 'fixed') {
    return (
      common +
      `  ${rootSelector} .doc-page {\n` +
      `    width: ${mode.width} !important; height: ${mode.height} !important;\n` +
      `    aspect-ratio: auto !important; overflow: hidden !important;\n` +
      `    margin: 0 !important; border-radius: 0 !important; box-shadow: none !important;\n` +
      `    break-inside: avoid; break-after: avoid }\n` +
      `}\n`
    )
  }

  return (
    common +
    `  ${rootSelector} .doc-flow { box-shadow: none !important; border-radius: 0 !important;\n` +
    `    margin: 0 !important; width: auto !important }\n` +
    `  h1,h2,h3,h4,h5,h6 { break-after: avoid }\n` +
    `  figure,pre,blockquote,img,svg,tr,.keep { break-inside: avoid }\n` +
    `  p,li { orphans: 3; widows: 3 }\n` +
    `}\n`
  )
}

/**
 * The document is rendered once, into #print-root. At print time everything
 * else on the page is hidden, so what prints is exactly what the export sees.
 */
export const PRINT_ROOT_ID = 'print-root'

/**
 * At print time the editor chrome disappears and the document's own ancestors
 * stop existing as layout.
 *
 * Two things here are load-bearing and were both learned the hard way:
 *
 *  - Chrome is hidden by `[data-export="false"]`, not by hiding everything that
 *    is not the print root. The print root is nested several levels inside the
 *    app shell, so a `body > *:not(#print-root)` rule hides its own ancestors
 *    and prints a perfectly sized blank page.
 *  - The stage is an `overflow: auto` scroll container inside a
 *    `transform: scale()` zoom wrapper. Both make their contents monolithic
 *    under fragmentation, so a flowing document collapses to one clipped page
 *    instead of paginating. They have to be flattened, not just un-styled.
 */
const APP_HIDING_CSS =
  `@media print {\n` +
  `  .app, .app__body, .stage, .stage__inner {\n` +
  `    display: block !important; overflow: visible !important;\n` +
  `    transform: none !important; height: auto !important; min-height: 0 !important;\n` +
  `    padding: 0 !important; margin: 0 !important; background: none !important;\n` +
  `    border: 0 !important }\n` +
  `  #${PRINT_ROOT_ID} { position: static !important; left: auto !important;\n` +
  `    top: auto !important; transform: none !important; zoom: 1 !important;\n` +
  `    box-shadow: none !important }\n` +
  `}\n`

export function Page({
  mode,
  children,
  style,
  className,
}: {
  mode: PageMode
  children: ReactNode
  style?: CSSProperties
  className?: string
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const scope = `#${PRINT_ROOT_ID}`

  // @page is inert inside a component's own <style>; it has to live in <head>,
  // and last in source order so it wins the per-descriptor @page cascade.
  useEffect(() => {
    const tag = document.createElement('style')
    tag.id = `doc-page-print-${id}`
    tag.textContent = printCss(mode, scope) + APP_HIDING_CSS
    document.head.append(tag)
    return () => tag.remove()
  }, [id, scope, JSON.stringify(mode)])

  if (mode.kind === 'fixed') {
    return (
      <div
        className={`doc-page${className ? ` ${className}` : ''}`}
        data-page-w={mode.width}
        data-page-h={mode.height}
        style={{
          width: mode.width,
          height: mode.height,
          overflow: 'hidden',
          boxSizing: 'border-box',
          background: '#fff',
          position: 'relative',
          ...style,
        }}
      >
        {children}
      </div>
    )
  }

  // Flowing: the per-page inset comes from repeating <thead>/<tfoot> spacers
  // rather than @page { margin }, which is what lets @page keep margin:0 (and
  // Chrome keep no room for its headers) while every page still gets an inset.
  // Padding alone would only inset the first page's top and the last page's
  // bottom.
  const [w, h] = PAPER[mode.size].split(' ') as [string, string]
  return (
    <div
      className={`doc-flow${className ? ` ${className}` : ''}`}
      data-page-w={w}
      data-page-h={h}
      style={{
        width: w,
        background: '#fff',
        boxSizing: 'border-box',
        paddingLeft: mode.margin,
        paddingRight: mode.margin,
        ...style,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <td>
              <div style={{ height: mode.margin }} />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{children}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div style={{ height: mode.margin }} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
