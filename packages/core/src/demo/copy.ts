// Texts of the demo data set (#62), one object per UI locale (copy-en.ts, copy-fr.ts). The
// structure (addresses, outcomes, attachments) is shared by catalog.ts.

/** One message: subject, a few paragraphs, the label of its call to action. */
export interface DemoText {
  subject: string
  paragraphs: string[]
  action?: string
}

export interface DemoCopy {
  /** Signature and footer of every message. */
  team: string
  footer: string
  welcome: DemoText
  reset: DemoText
  invoice: DemoText & { csvHeader: string }
  shipped: DemoText
  digest: DemoText
  signIn: DemoText
  paymentFailed: DemoText
  invite: DemoText
}
