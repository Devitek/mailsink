import { z } from 'zod';
export declare const StreamEvent: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"message.created">;
    message: z.ZodObject<{
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
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"message.status">;
    messageId: z.ZodString;
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
    recipient: z.ZodNullable<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"message.event">;
    messageId: z.ZodString;
    event: z.ZodObject<{
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
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"webhook.delivery">;
    delivery: z.ZodObject<{
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
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"log.api">;
    log: z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodNullable<z.ZodString>;
        dialect: z.ZodEnum<{
            admin: "admin";
            brevo: "brevo";
            capture: "capture";
            mcp: "mcp";
            native: "native";
            resend: "resend";
        }>;
        method: z.ZodString;
        path: z.ZodString;
        statusCode: z.ZodNumber;
        durationMs: z.ZodNumber;
        errorCode: z.ZodNullable<z.ZodString>;
        messageIds: z.ZodArray<z.ZodString>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"log.smtp">;
    session: z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodNullable<z.ZodString>;
        remoteAddress: z.ZodString;
        clientHostname: z.ZodNullable<z.ZodString>;
        authUser: z.ZodNullable<z.ZodString>;
        secure: z.ZodBoolean;
        outcome: z.ZodEnum<{
            accepted: "accepted";
            auth_failed: "auth_failed";
            error: "error";
            rejected: "rejected";
        }>;
        error: z.ZodNullable<z.ZodString>;
        messageIds: z.ZodArray<z.ZodString>;
        startedAt: z.ZodISODateTime;
        endedAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"override.changed">;
    state: z.ZodObject<{
        workspace: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            connectionId: z.ZodNullable<z.ZodString>;
            config: z.ZodObject<{
                rates: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                    complained: "complained";
                    deferred: "deferred";
                    delivered: "delivered";
                    failed: "failed";
                    hard_bounce: "hard_bounce";
                    soft_bounce: "soft_bounce";
                }> & z.core.$partial, z.ZodNumber>>;
                rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    match: z.ZodString;
                    status: z.ZodOptional<z.ZodEnum<{
                        complained: "complained";
                        deferred: "deferred";
                        delivered: "delivered";
                        failed: "failed";
                        hard_bounce: "hard_bounce";
                        soft_bounce: "soft_bounce";
                    }>>;
                    delayMs: z.ZodOptional<z.ZodNumber>;
                    smtpCode: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>>;
                latency: z.ZodOptional<z.ZodObject<{
                    minMs: z.ZodNumber;
                    maxMs: z.ZodNumber;
                }, z.core.$strip>>;
                chaos: z.ZodOptional<z.ZodObject<{
                    errorRate: z.ZodNumber;
                    httpCodes: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodLiteral<429>, z.ZodLiteral<500>, z.ZodLiteral<502>, z.ZodLiteral<503>]>>>;
                    smtpCodes: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodLiteral<421>, z.ZodLiteral<451>, z.ZodLiteral<452>, z.ZodLiteral<550>]>>>;
                }, z.core.$strip>>;
                rateLimit: z.ZodOptional<z.ZodObject<{
                    limit: z.ZodNumber;
                    windowSeconds: z.ZodDefault<z.ZodNumber>;
                    burst: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            activatedVia: z.ZodEnum<{
                api: "api";
                mcp: "mcp";
                simulation: "simulation";
                ui: "ui";
            }>;
            expiresAt: z.ZodNullable<z.ZodISODateTime>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        connections: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            connectionId: z.ZodNullable<z.ZodString>;
            config: z.ZodObject<{
                rates: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
                    complained: "complained";
                    deferred: "deferred";
                    delivered: "delivered";
                    failed: "failed";
                    hard_bounce: "hard_bounce";
                    soft_bounce: "soft_bounce";
                }> & z.core.$partial, z.ZodNumber>>;
                rules: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    match: z.ZodString;
                    status: z.ZodOptional<z.ZodEnum<{
                        complained: "complained";
                        deferred: "deferred";
                        delivered: "delivered";
                        failed: "failed";
                        hard_bounce: "hard_bounce";
                        soft_bounce: "soft_bounce";
                    }>>;
                    delayMs: z.ZodOptional<z.ZodNumber>;
                    smtpCode: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>>;
                latency: z.ZodOptional<z.ZodObject<{
                    minMs: z.ZodNumber;
                    maxMs: z.ZodNumber;
                }, z.core.$strip>>;
                chaos: z.ZodOptional<z.ZodObject<{
                    errorRate: z.ZodNumber;
                    httpCodes: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodLiteral<429>, z.ZodLiteral<500>, z.ZodLiteral<502>, z.ZodLiteral<503>]>>>;
                    smtpCodes: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodLiteral<421>, z.ZodLiteral<451>, z.ZodLiteral<452>, z.ZodLiteral<550>]>>>;
                }, z.core.$strip>>;
                rateLimit: z.ZodOptional<z.ZodObject<{
                    limit: z.ZodNumber;
                    windowSeconds: z.ZodDefault<z.ZodNumber>;
                    burst: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            activatedVia: z.ZodEnum<{
                api: "api";
                mcp: "mcp";
                simulation: "simulation";
                ui: "ui";
            }>;
            expiresAt: z.ZodNullable<z.ZodISODateTime>;
            createdAt: z.ZodISODateTime;
        }, z.core.$strip>>;
        effective: z.ZodRecord<z.ZodString, z.ZodObject<{
            rates: z.ZodDefault<z.ZodRecord<z.ZodEnum<{
                complained: "complained";
                deferred: "deferred";
                delivered: "delivered";
                failed: "failed";
                hard_bounce: "hard_bounce";
                soft_bounce: "soft_bounce";
            }> & z.core.$partial, z.ZodNumber>>;
            rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
                match: z.ZodString;
                status: z.ZodOptional<z.ZodEnum<{
                    complained: "complained";
                    deferred: "deferred";
                    delivered: "delivered";
                    failed: "failed";
                    hard_bounce: "hard_bounce";
                    soft_bounce: "soft_bounce";
                }>>;
                delayMs: z.ZodOptional<z.ZodNumber>;
                smtpCode: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
            latency: z.ZodDefault<z.ZodObject<{
                minMs: z.ZodNumber;
                maxMs: z.ZodNumber;
            }, z.core.$strip>>;
            openRate: z.ZodDefault<z.ZodNumber>;
            clickRate: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"messages.purged">;
    count: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"workspace.deleted">;
    workspaceId: z.ZodString;
}, z.core.$strip>], "type">;
export declare const StreamEventType: z.ZodEnum<{
    "log.api": "log.api";
    "log.smtp": "log.smtp";
    "message.created": "message.created";
    "message.event": "message.event";
    "message.status": "message.status";
    "messages.purged": "messages.purged";
    "override.changed": "override.changed";
    "webhook.delivery": "webhook.delivery";
    "workspace.deleted": "workspace.deleted";
}>;
/** `types`: comma-separated or repeated; `workspace.deleted` is always sent. */
export declare const StreamQuery: z.ZodObject<{
    connectionId: z.ZodOptional<z.ZodString>;
    types: z.ZodOptional<z.ZodPreprocess<z.ZodArray<z.ZodEnum<{
        "log.api": "log.api";
        "log.smtp": "log.smtp";
        "message.created": "message.created";
        "message.event": "message.event";
        "message.status": "message.status";
        "messages.purged": "messages.purged";
        "override.changed": "override.changed";
        "webhook.delivery": "webhook.delivery";
        "workspace.deleted": "workspace.deleted";
    }>>, unknown>>;
}, z.core.$strip>;
export type StreamEvent = z.output<typeof StreamEvent>;
export type StreamEventType = z.output<typeof StreamEventType>;
export type StreamQuery = z.output<typeof StreamQuery>;
