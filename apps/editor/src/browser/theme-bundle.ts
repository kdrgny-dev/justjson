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
  css: string
  templates: {
    index: string
    entry: string
  }
}
