// The repository Markdown files the site renders, and where. Each page has one source:
// the site never holds a copy (D266).

export interface SourcePage {
  /** Repository path of the source file. */
  source: string
  /** Site slug, without slashes. */
  slug: string
  /** Sidebar label, when the source title is too long. */
  label?: string
  /** Sidebar position within its group. */
  order?: number
  /** Overrides the source title. */
  title?: string
  /** README only: the `## ` sections rendered, in order. */
  sections?: readonly string[]
}

export const REPO_URL = 'https://github.com/Devitek/mailsink'

export const PAGES: readonly SourcePage[] = [
  {
    source: 'README.md',
    slug: 'getting-started',
    title: 'Getting started',
    sections: ['Installation', 'Usage', 'npm packages', 'Features'],
  },
  { source: 'docs/guides/e2e.md', slug: 'guides/e2e', label: 'End-to-end testing', order: 1 },
  { source: 'docs/guides/sdk.md', slug: 'guides/sdk', label: 'TypeScript SDK', order: 2 },
  {
    source: 'docs/guides/vitest-jest.md',
    slug: 'guides/vitest-jest',
    label: 'Vitest and Jest',
    order: 3,
  },
  { source: 'docs/guides/cli.md', slug: 'guides/cli', label: 'Command line', order: 4 },
  { source: 'docs/guides/mcp.md', slug: 'guides/mcp', label: 'AI agents (MCP)', order: 5 },
  { source: 'docs/guides/api.md', slug: 'guides/api', label: 'HTTP API and OpenAPI', order: 6 },
  { source: 'docs/architecture/README.md', slug: 'architecture', label: 'Overview', order: 0 },
  { source: 'docs/architecture/01-project-tree.md', slug: 'architecture/project-tree', order: 1 },
  {
    source: 'docs/architecture/02-database-schema.md',
    slug: 'architecture/database-schema',
    order: 2,
  },
  { source: 'docs/architecture/03-contracts.md', slug: 'architecture/contracts', order: 3 },
  { source: 'docs/architecture/04-sequence.md', slug: 'architecture/sequence', order: 4 },
  { source: 'docs/architecture/05-roadmap.md', slug: 'architecture/roadmap', order: 5 },
  { source: 'CONTRIBUTING.md', slug: 'contributing', label: 'Contributing', order: 0 },
  {
    source: 'docs/contributing/translations.md',
    slug: 'contributing/translations',
    label: 'Translations',
    order: 1,
  },
]
