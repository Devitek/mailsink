import type { DemoCopy } from './copy'

export const demoCopyEn: DemoCopy = {
  team: 'The Fieldnote team',
  footer: 'Fieldnote, 12 Example Street, Springfield. Demo message seeded by Mailsink.',
  welcome: {
    subject: 'Welcome to Fieldnote, Jane',
    paragraphs: [
      'Thanks for signing up. Confirm your address to activate your workspace.',
      'Our getting started guide walks you through your first project in five minutes.',
    ],
    action: 'Confirm my address',
  },
  reset: {
    subject: 'Reset your password',
    paragraphs: [
      'Someone asked to reset the password of your account.',
      'The link below is valid for 30 minutes. Ignore this email if it was not you.',
    ],
    action: 'Choose a new password',
  },
  invoice: {
    subject: 'Your invoice INV-2026-0142',
    paragraphs: [
      'Your invoice for November is attached (PDF), with the usage detail (CSV).',
      'Amount due: $49.00, paid automatically on December 1st.',
    ],
    action: 'View my billing history',
    csvHeader: 'date,seats,amount',
  },
  shipped: {
    subject: 'Your order #4821 has shipped',
    paragraphs: [
      'Good news: your order left our warehouse this morning.',
      'Expected delivery: 2 to 3 business days.',
    ],
    action: 'Track my parcel',
  },
  digest: {
    subject: 'Your weekly digest: 3 new comments',
    paragraphs: [
      'Here is what happened in your projects this week.',
      'Alex commented on "Launch plan", Maria replied twice in "Q4 roadmap".',
    ],
    action: 'Open Fieldnote',
  },
  signIn: {
    subject: 'Your sign-in link',
    paragraphs: ['Use this link to sign in. It expires in 10 minutes.'],
    action: 'Sign in',
  },
  paymentFailed: {
    subject: 'Payment failed for your subscription',
    paragraphs: [
      'We could not charge your card ending in 4242.',
      'Update your payment method to keep your workspace active.',
    ],
    action: 'Update my card',
  },
  invite: {
    subject: 'Maria invited you to join "Design team"',
    paragraphs: [
      'Maria Lopez invited you to collaborate on the "Design team" workspace.',
      'Accept the invitation to see the projects shared with you.',
    ],
    action: 'Accept the invitation',
  },
}
