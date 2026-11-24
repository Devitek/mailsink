import { z } from 'zod';
export declare const WAIT_TIMEOUT_MAX_MS = 30000;
export declare const ListMessagesQuery: z.ZodObject<{
    to: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    tag: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodPreprocess<z.ZodArray<z.ZodEnum<{
        complained: "complained";
        deferred: "deferred";
        delivered: "delivered";
        failed: "failed";
        hard_bounce: "hard_bounce";
        queued: "queued";
        sent: "sent";
        soft_bounce: "soft_bounce";
        suppressed: "suppressed";
    }>>, unknown>>;
    connectionId: z.ZodOptional<z.ZodString>;
    since: z.ZodOptional<z.ZodISODateTime>;
    until: z.ZodOptional<z.ZodISODateTime>;
    q: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    cursor: z.ZodOptional<z.ZodString>;
    wait: z.ZodDefault<z.ZodUnion<readonly [z.ZodBoolean, z.ZodCodec<z.ZodString, z.ZodBoolean>]>>;
    timeout: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const MessageSummary: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<{
        brevo: "brevo";
        native: "native";
        resend: "resend";
        smtp: "smtp";
    }>;
    from: z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    to: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    subject: z.ZodString;
    status: z.ZodEnum<{
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
    tags: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    hasAttachments: z.ZodBoolean;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ListMessagesResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<{
            brevo: "brevo";
            native: "native";
            resend: "resend";
            smtp: "smtp";
        }>;
        from: z.ZodObject<{
            email: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        to: z.ZodArray<z.ZodObject<{
            email: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        subject: z.ZodString;
        status: z.ZodEnum<{
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
        tags: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodString;
        }, z.core.$strip>>;
        hasAttachments: z.ZodBoolean;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const MessageEventView: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
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
    origin: z.ZodEnum<{
        api: "api";
        mcp: "mcp";
        simulation: "simulation";
        ui: "ui";
    }>;
    recipient: z.ZodNullable<z.ZodString>;
    data: z.ZodObject<{
        url: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
        reason: z.ZodOptional<z.ZodString>;
        smtpCode: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    occurredAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const AttachmentView: z.ZodObject<{
    id: z.ZodString;
    filename: z.ZodNullable<z.ZodString>;
    contentType: z.ZodString;
    contentId: z.ZodNullable<z.ZodString>;
    sizeBytes: z.ZodNumber;
    inline: z.ZodBoolean;
    downloadUrl: z.ZodString;
}, z.core.$strip>;
export declare const RecipientView: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<{
        bcc: "bcc";
        cc: "cc";
        to: "to";
    }>;
    status: z.ZodEnum<{
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
    reason: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const MessageDetail: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<{
        brevo: "brevo";
        native: "native";
        resend: "resend";
        smtp: "smtp";
    }>;
    from: z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    to: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    subject: z.ZodString;
    status: z.ZodEnum<{
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
    tags: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    hasAttachments: z.ZodBoolean;
    createdAt: z.ZodISODateTime;
    cc: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    bcc: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    replyTo: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    html: z.ZodNullable<z.ZodString>;
    text: z.ZodNullable<z.ZodString>;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    links: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    attachments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        filename: z.ZodNullable<z.ZodString>;
        contentType: z.ZodString;
        contentId: z.ZodNullable<z.ZodString>;
        sizeBytes: z.ZodNumber;
        inline: z.ZodBoolean;
        downloadUrl: z.ZodString;
    }, z.core.$strip>>;
    recipients: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<{
            bcc: "bcc";
            cc: "cc";
            to: "to";
        }>;
        status: z.ZodEnum<{
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
        reason: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
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
        origin: z.ZodEnum<{
            api: "api";
            mcp: "mcp";
            simulation: "simulation";
            ui: "ui";
        }>;
        recipient: z.ZodNullable<z.ZodString>;
        data: z.ZodObject<{
            url: z.ZodOptional<z.ZodString>;
            userAgent: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            smtpCode: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        occurredAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    rawUrl: z.ZodString;
    simulation: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    webhookDeliveries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        endpointId: z.ZodString;
        messageId: z.ZodNullable<z.ZodString>;
        eventId: z.ZodNullable<z.ZodString>;
        payloadFormat: z.ZodEnum<{
            brevo: "brevo";
            resend: "resend";
            unified: "unified";
        }>;
        canonicalEvent: z.ZodEnum<{
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
        dialectEvent: z.ZodString;
        recipient: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            failed: "failed";
            pending: "pending";
            retrying: "retrying";
            succeeded: "succeeded";
        }>;
        attemptCount: z.ZodNumber;
        nextAttemptAt: z.ZodNullable<z.ZodISODateTime>;
        lastStatusCode: z.ZodNullable<z.ZodNumber>;
        replayOf: z.ZodNullable<z.ZodString>;
        replayMode: z.ZodNullable<z.ZodEnum<{
            exact: "exact";
            resign: "resign";
        }>>;
        endpointUrl: z.ZodNullable<z.ZodString>;
        durationMs: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const TriggerEventRequest: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"opened">;
    recipient: z.ZodOptional<z.ZodEmail>;
    userAgent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"clicked">;
    url: z.ZodURL;
    recipient: z.ZodOptional<z.ZodEmail>;
    userAgent: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"status">;
    status: z.ZodEnum<{
        complained: "complained";
        deferred: "deferred";
        delivered: "delivered";
        failed: "failed";
        hard_bounce: "hard_bounce";
        soft_bounce: "soft_bounce";
    }>;
    recipient: z.ZodOptional<z.ZodEmail>;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "type">;
/** 202: the events written (one per recipient) and the webhook deliveries they created. */
export declare const TriggerEventResponse: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
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
        origin: z.ZodEnum<{
            api: "api";
            mcp: "mcp";
            simulation: "simulation";
            ui: "ui";
        }>;
        recipient: z.ZodNullable<z.ZodString>;
        data: z.ZodObject<{
            url: z.ZodOptional<z.ZodString>;
            userAgent: z.ZodOptional<z.ZodString>;
            reason: z.ZodOptional<z.ZodString>;
            smtpCode: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        occurredAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    webhookDeliveries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        endpointId: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const PurgeQuery: z.ZodObject<{
    connectionId: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodISODateTime>;
    includeLogs: z.ZodDefault<z.ZodUnion<readonly [z.ZodBoolean, z.ZodCodec<z.ZodString, z.ZodBoolean>]>>;
}, z.core.$strip>;
export declare const PurgeResponse: z.ZodObject<{
    count: z.ZodNumber;
}, z.core.$strip>;
export type ListMessagesQuery = z.output<typeof ListMessagesQuery>;
export type MessageSummary = z.output<typeof MessageSummary>;
export type MessageEventView = z.output<typeof MessageEventView>;
export type MessageDetail = z.output<typeof MessageDetail>;
export type TriggerEventRequest = z.output<typeof TriggerEventRequest>;
export type TriggerEventResponse = z.output<typeof TriggerEventResponse>;
export type PurgeQuery = z.output<typeof PurgeQuery>;
export type PurgeResponse = z.output<typeof PurgeResponse>;
