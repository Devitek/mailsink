import { z } from 'zod';
export declare const DeliveryStatus: z.ZodEnum<{
    complained: "complained";
    deferred: "deferred";
    delivered: "delivered";
    failed: "failed";
    hard_bounce: "hard_bounce";
    queued: "queued";
    sent: "sent";
    soft_bounce: "soft_bounce";
    suppressed: "suppressed";
}>;
/** Final statuses the simulation can draw (queued, sent and suppressed are not drawn). */
export declare const SimulatedStatus: z.ZodEnum<{
    complained: "complained";
    deferred: "deferred";
    delivered: "delivered";
    failed: "failed";
    hard_bounce: "hard_bounce";
    soft_bounce: "soft_bounce";
}>;
/** Canonical webhook events (D22), see 03-contracts « Webhooks » for the per-format mapping. */
export declare const CanonicalEvent: z.ZodEnum<{
    "email.clicked": "email.clicked";
    "email.complained": "email.complained";
    "email.deferred": "email.deferred";
    "email.delivered": "email.delivered";
    "email.failed": "email.failed";
    "email.hard_bounced": "email.hard_bounced";
    "email.opened": "email.opened";
    "email.sent": "email.sent";
    "email.soft_bounced": "email.soft_bounced";
    "email.suppressed": "email.suppressed";
}>;
export declare const ConnectionKind: z.ZodEnum<{
    brevo: "brevo";
    resend: "resend";
    smtp: "smtp";
}>;
export declare const MessageSource: z.ZodEnum<{
    brevo: "brevo";
    native: "native";
    resend: "resend";
    smtp: "smtp";
}>;
export declare const EventType: z.ZodEnum<{
    accepted: "accepted";
    clicked: "clicked";
    complained: "complained";
    deferred: "deferred";
    delivered: "delivered";
    failed: "failed";
    hard_bounce: "hard_bounce";
    opened: "opened";
    sent: "sent";
    soft_bounce: "soft_bounce";
    suppressed: "suppressed";
}>;
export declare const EventOrigin: z.ZodEnum<{
    api: "api";
    mcp: "mcp";
    simulation: "simulation";
    ui: "ui";
}>;
export declare const RecipientKind: z.ZodEnum<{
    bcc: "bcc";
    cc: "cc";
    to: "to";
}>;
export type DeliveryStatus = z.output<typeof DeliveryStatus>;
export type SimulatedStatus = z.output<typeof SimulatedStatus>;
export type CanonicalEvent = z.output<typeof CanonicalEvent>;
export type ConnectionKind = z.output<typeof ConnectionKind>;
export type MessageSource = z.output<typeof MessageSource>;
export type EventType = z.output<typeof EventType>;
export type EventOrigin = z.output<typeof EventOrigin>;
export type RecipientKind = z.output<typeof RecipientKind>;
