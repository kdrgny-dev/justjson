// A theme = logic-less Mustache templates + CSS + metadata. Safe to run
// untrusted/purchased bundles: no code execution, and field HTML is
// pre-rendered (escaped) by the MIT renderer, so a theme can only place it.
export interface ThemeBundle {
  id: string
  name: string
  version: string
  license: 'free' | 'commercial'
  /** Preview image (data URI). Empty until a real thumbnail is added. */
  thumb?: string
  /**
   * Which Design-panel knobs this theme actually honors, so the panel hides the
   * dead ones. Omitted → default theme gets all, others get accent only (premium
   * themes ship a finished look, tweakable via --jj-accent). Values:
   * 'palette' | 'accent' | 'font' | 'radius' | 'density'.
   */
  tokens?: string[]
  css: string
  templates: {
    index: string
    entry: string
    /** collection listing page; renderer falls back to a built-in if absent */
    list?: string
    /** standalone page (from the `pages` collection); built-in fallback if absent */
    page?: string
  }
}
