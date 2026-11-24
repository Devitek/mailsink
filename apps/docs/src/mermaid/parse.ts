// Build-time syntax check of a diagram (D270): Mermaid's parser runs in Node without a
// browser; only the drawing needs one, and happens on the reader's side (client.ts).
// Imported statically: Astro loads the config through a Vite module runner that is closed
// once the content renders, so a dynamic import from here would fail.
import mermaid from 'mermaid'
import type { MermaidParse } from './plugin'

export const parseDiagram: MermaidParse = (diagram) => mermaid.parse(diagram)
