import type { DemoLocale, RecipientRule, SimulatedStatus } from '@mailsink/contracts'
import type { NormalizedAttachment, NormalizedEmail } from '../ingestion/normalize'
import type { DemoCopy, DemoText } from './copy'
import { demoCopyEn } from './copy-en'
import { demoCopyFr } from './copy-fr'
import { renderBodies } from './layout'

// The demo data set (#62): eight transactional messages of a fictional product, spread
// over the last hour, with links, attachments, an inline image, several recipients and one
// planned outcome per recipient (delivered unless said otherwise).

export interface DemoMessage {
  minutesAgo: number
  email: NormalizedEmail
  /** Temporary rule set of this message: its planned outcomes, then delivered. */
  rules: RecipientRule[]
}

const COPIES: Record<DemoLocale, DemoCopy> = { en: demoCopyEn, fr: demoCopyFr }

const SENDER = { email: 'hello@fieldnote.example', name: 'Fieldnote' }
const APP = 'https://fieldnote.example'
const LOGO_CID = 'logo@fieldnote.example'

// 1 x 1 PNG, shown at 32 px: the inline image of the invitation.
const LOGO_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

const bytes = (text: string) => new TextEncoder().encode(text)

const invoicePdf = () =>
  bytes(
    [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
      '4 0 obj<</Length 44>>stream',
      'BT /F1 18 Tf 36 72 Td (INV-2026-0142) Tj ET',
      'endstream endobj',
      '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
      'trailer<</Root 1 0 R>>',
      '%%EOF',
    ].join('\n'),
  )

type Spec = {
  minutesAgo: number
  text: (copy: DemoCopy) => DemoText
  to: string[]
  cc?: string[]
  tag: string
  path: string
  outcomes?: Record<string, { status: SimulatedStatus; smtpCode?: number }>
  attachments?: (copy: DemoCopy) => NormalizedAttachment[]
  inlineLogo?: boolean
}

const SPECS: Spec[] = [
  {
    minutesAgo: 52,
    text: (c) => c.welcome,
    to: ['jane.doe@example.test'],
    tag: 'onboarding',
    path: '/confirm?token=demo',
  },
  {
    minutesAgo: 47,
    text: (c) => c.reset,
    to: ['sam.lee@example.test'],
    tag: 'auth',
    path: '/reset?token=demo',
  },
  {
    minutesAgo: 39,
    text: (c) => c.invoice,
    to: ['billing@acme.example.test'],
    tag: 'billing',
    path: '/billing',
    attachments: (c) => [
      { filename: 'INV-2026-0142.pdf', contentType: 'application/pdf', content: invoicePdf() },
      {
        filename: 'usage-2026-11.csv',
        contentType: 'text/csv',
        content: bytes(`${c.invoice.csvHeader}\n2026-11-01,4,49.00\n`),
      },
    ],
  },
  {
    minutesAgo: 31,
    text: (c) => c.shipped,
    to: ['no-such-user@bounce.example.test'],
    cc: ['orders@acme.example.test'],
    tag: 'orders',
    path: '/orders/4821',
    outcomes: { 'no-such-user@bounce.example.test': { status: 'hard_bounce', smtpCode: 550 } },
  },
  {
    minutesAgo: 24,
    text: (c) => c.digest,
    to: ['sarah.k@mail.example.test'],
    tag: 'digest',
    path: '/',
    outcomes: { 'sarah.k@mail.example.test': { status: 'complained' } },
  },
  {
    minutesAgo: 17,
    text: (c) => c.signIn,
    to: ['full.mailbox@example.test'],
    tag: 'auth',
    path: '/sign-in?token=demo',
    outcomes: { 'full.mailbox@example.test': { status: 'soft_bounce', smtpCode: 452 } },
  },
  {
    minutesAgo: 9,
    text: (c) => c.paymentFailed,
    to: ['finance@acme.example.test'],
    tag: 'billing',
    path: '/billing/card',
    outcomes: { 'finance@acme.example.test': { status: 'failed' } },
  },
  {
    minutesAgo: 3,
    text: (c) => c.invite,
    to: ['alex.chen@example.test', 'maria.lopez@example.test'],
    tag: 'invitations',
    path: '/invite/demo',
    inlineLogo: true,
  },
]

function toMessage(copy: DemoCopy, spec: Spec): DemoMessage {
  const text = spec.text(copy)
  const link = `${APP}${spec.path}`
  const bodies = renderBodies(copy, text, link, spec.inlineLogo ? { logoCid: LOGO_CID } : {})
  const attachments = spec.attachments?.(copy) ?? []
  if (spec.inlineLogo) {
    const content = new Uint8Array(Buffer.from(LOGO_PNG, 'base64'))
    attachments.push({
      filename: 'logo.png',
      contentType: 'image/png',
      contentId: LOGO_CID,
      content,
    })
  }
  const outcomes = Object.entries(spec.outcomes ?? {}).map(([match, o]) => ({ match, ...o }))
  return {
    minutesAgo: spec.minutesAgo,
    rules: [...outcomes, { match: '*', status: 'delivered' }],
    email: {
      from: SENDER,
      to: spec.to.map((email) => ({ email })),
      cc: (spec.cc ?? []).map((email) => ({ email })),
      bcc: [],
      replyTo: [],
      subject: text.subject,
      html: bodies.html,
      text: bodies.text,
      headers: {},
      tags: [
        { name: 'category', value: spec.tag },
        { name: 'demo', value: 'true' },
      ],
      metadata: { demo: true },
      attachments,
    },
  }
}

/** The data set in `locale`, oldest first. */
export function demoMessages(locale: DemoLocale): DemoMessage[] {
  return SPECS.map((spec) => toMessage(COPIES[locale], spec))
}
