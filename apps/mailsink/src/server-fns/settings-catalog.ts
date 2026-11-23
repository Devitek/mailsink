import { CanonicalEvent, PayloadFormat } from '@mailsink/contracts'
import { subscriptionName } from '@mailsink/core'
import type { EventCatalog, EventChoice } from './settings-types'

// Webhook events the endpoint form offers per format (#43): the subscription names of the
// dialect (Brevo `hardBounce`, Resend `email.delivery_delayed`…), each with the canonical
// events it stands for. A canonical event absent from a format's list cannot be emitted in
// that format (D22): the form warns about it.

function choicesOf(format: PayloadFormat): EventChoice[] {
  const byName = new Map<string, EventChoice>()
  for (const canonical of CanonicalEvent.options) {
    const name = subscriptionName(format, canonical)
    if (name === null) continue
    const choice = byName.get(name)
    if (choice) choice.events.push(canonical)
    else byName.set(name, { name, events: [canonical] })
  }
  return [...byName.values()]
}

export function eventCatalog(): EventCatalog {
  const catalog = {} as EventCatalog
  for (const format of PayloadFormat.options) catalog[format] = choicesOf(format)
  return catalog
}
