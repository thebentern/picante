import { font } from '../templates/tokens'

/**
 * Overflow detection for the fixed-height templates.
 *
 * Both card templates are fixed-height containers with `overflow:hidden` and
 * `flex:none` children. When content exceeds the height the surplus is
 * discarded with no warning at all — and `margin-top:auto` on a bottom-pinned
 * element collapses to 0 under pressure, so the element that disappears first is
 * the last one, which in practice is the OPSEC notice. That happened four
 * separate times during the design phase, and an editor that lets people type
 * into these templates will hit it constantly.
 *
 * Measuring the live DOM alone does not work:
 *
 *  - Flex children with `min-height:0` absorb pressure by squeezing instead of
 *    reporting scrollHeight, so the container looks fine while its contents are
 *    being crushed.
 *  - The fold card's back panel is `rotate(180deg)`, and getBoundingClientRect
 *    returns the rotated box.
 *
 * So the measurement runs against an offscreen clone with the clipping and the
 * rotation removed. The clone lays out at exactly the same page geometry, but
 * nothing is hidden, so every block's true position is readable.
 *
 * The fix is never to remove `overflow:hidden` from the real template. That
 * only lets content run off the physical media instead of off the screen.
 */

export interface OverflowFinding {
  /** data-block label of the container that clips. */
  container: string
  /** data-block label of the specific block that overshoots, when known. */
  block: string | null
  /** How far past the container's content box the content runs, in CSS px. */
  overflowPx: number
  /**
   * True when a bottom-pinned element's margin-top:auto has collapsed to 0 —
   * the specific silent failure that eats the OPSEC notice.
   */
  pinCollapsed: boolean
}

export interface OverflowReport {
  /** Findings with the app's real (self-hosted) fonts loaded. */
  loaded: OverflowFinding[]
  /**
   * Findings against the metric-stable fallback stack. Fonts are self-hosted so
   * this should not happen in normal use, but the check is cheap and the whole
   * distribution model for these cards is emailing files around.
   */
  fallback: OverflowFinding[]
}

const HOST_ID = 'picante-overflow-probe'
const TOLERANCE_PX = 0.5

function host(): HTMLElement {
  let el = document.getElementById(HOST_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = HOST_ID
    el.setAttribute('aria-hidden', 'true')
    el.dataset.export = 'false'
    // Offscreen rather than display:none — a hidden subtree has no layout, and
    // layout is the entire point.
    el.style.cssText =
      'position:fixed;left:-20000px;top:0;width:0;height:0;overflow:visible;' +
      'pointer-events:none;contain:strict'
    document.body.append(el)
  }
  return el
}

/** Strip clipping, rotation and editing chrome so true geometry is measurable. */
function unclip(root: HTMLElement) {
  root.style.overflow = 'visible'
  root.style.transform = 'none'
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    if (el.dataset.export === 'false') {
      el.remove()
      continue
    }
    const cs = getComputedStyle(el)
    if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') {
      el.style.overflow = 'visible'
    }
    if (cs.transform !== 'none') el.style.transform = 'none'
    // contenteditable attributes on a clone attract no caret, but removing them
    // keeps the clone inert and stops it from stealing focus.
    el.removeAttribute('contenteditable')
    el.removeAttribute('role')
  }
}

function forceFallbackFonts(root: HTMLElement) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*')).concat(root)) {
    const family = getComputedStyle(el).fontFamily
    if (!family) continue
    if (/JetBrains/i.test(family)) el.style.fontFamily = font.monoFallback
    else if (/Archivo/i.test(family)) el.style.fontFamily = font.displayFallback
  }
}

function contentBottom(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return rect.bottom - parseFloat(cs.paddingBottom || '0') - parseFloat(cs.borderBottomWidth || '0')
}

/** The nearest ancestor (or self) carrying a data-block name. */
function nameOf(el: Element, stopAt: Element): string | null {
  let node: Element | null = el
  while (node && node !== stopAt) {
    const label = (node as HTMLElement).dataset?.block
    if (label) return label
    node = node.parentElement
  }
  return null
}

function measure(root: HTMLElement): OverflowFinding[] {
  const findings: OverflowFinding[] = []

  const containers = [
    ...(root.matches('[data-clip]') ? [root] : []),
    ...Array.from(root.querySelectorAll<HTMLElement>('[data-clip]')),
  ]
  // The page box itself is the outermost container even without data-clip.
  const pageBox = root.matches('.doc-page') ? root : root.querySelector<HTMLElement>('.doc-page')
  if (pageBox) containers.unshift(pageBox)

  for (const container of containers) {
    const limit = contentBottom(container)
    let worst = 0
    let worstBlock: string | null = null

    for (const child of Array.from(container.children) as HTMLElement[]) {
      const over = child.getBoundingClientRect().bottom - limit
      if (over > worst) {
        worst = over
        worstBlock = nameOf(child, container) ?? child.dataset.block ?? null
      }
    }

    // A pinned element whose margin-top:auto has collapsed is at capacity even
    // when nothing has visibly spilled yet — and it is the thing that vanishes
    // next. Report it as a finding in its own right.
    const pinned = container.querySelector<HTMLElement>(':scope > [data-pinned]')
    const pinCollapsed =
      pinned != null &&
      getComputedStyle(pinned).marginTop === '0px' &&
      // Only meaningful when the container is genuinely full: an empty column
      // legitimately has a collapsed auto margin with room to spare.
      limit - pinned.getBoundingClientRect().bottom < 1

    if (worst > TOLERANCE_PX || pinCollapsed) {
      findings.push({
        container: container.dataset.block ?? 'Page',
        block: worstBlock,
        overflowPx: Math.max(0, Math.round(worst * 10) / 10),
        pinCollapsed,
      })
    }
  }

  return findings
}

/**
 * Clone the rendered template offscreen and measure it twice: once as rendered,
 * once with the fallback font stack forced.
 */
export function probeOverflow(source: HTMLElement): OverflowReport {
  const container = host()
  container.textContent = ''

  const run = (fallback: boolean): OverflowFinding[] => {
    const clone = source.cloneNode(true) as HTMLElement
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:absolute;left:0;top:0;overflow:visible'
    wrap.append(clone)
    container.append(wrap)
    try {
      unclip(clone)
      if (fallback) forceFallbackFonts(clone)
      return measure(clone)
    } finally {
      wrap.remove()
    }
  }

  return { loaded: run(false), fallback: run(true) }
}

export const hasOverflow = (r: OverflowReport) =>
  r.loaded.some((f) => f.overflowPx > 0) || r.fallback.some((f) => f.overflowPx > 0)

export const worstOverflow = (findings: OverflowFinding[]) =>
  findings.reduce((max, f) => Math.max(max, f.overflowPx), 0)

export function describeFinding(f: OverflowFinding): string {
  if (f.overflowPx > 0) {
    const where = f.block && f.block !== f.container ? `${f.container} · ${f.block}` : f.container
    return `${where}: ${f.overflowPx} px over — content past this point is cut off, not wrapped.`
  }
  return `${f.container}: full. The bottom-pinned block has lost its spacing and is the next thing to be clipped.`
}
