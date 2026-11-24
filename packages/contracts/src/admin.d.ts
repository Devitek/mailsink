import { z } from 'zod';
export declare const ConnectionInput: z.ZodDiscriminatedUnion<[z.ZodObject<{
    name: z.ZodString;
    retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    simulation: z.ZodOptional<z.ZodObject<{
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
        openRate: z.ZodOptional<z.ZodNumber>;
        clickRate: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    kind: z.ZodLiteral<"resend">;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodString;
    retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    simulation: z.ZodOptional<z.ZodObject<{
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
        openRate: z.ZodOptional<z.ZodNumber>;
        clickRate: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    kind: z.ZodLiteral<"brevo">;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodString;
    retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    simulation: z.ZodOptional<z.ZodObject<{
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
        openRate: z.ZodOptional<z.ZodNumber>;
        clickRate: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    kind: z.ZodLiteral<"smtp">;
    smtpUsername: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "kind">;
export declare const IDLE_TTL_BOUNDS: {
    readonly min: 60;
    readonly max: number;
};
/**
 * `idleTtlSeconds` is only accepted for ephemeral workspaces; when absent the server applies
 * its configured default (contracts never read the environment).
 */
export declare const CreateWorkspaceRequest: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    ephemeral: z.ZodDefault<z.ZodBoolean>;
    idleTtlSeconds: z.ZodOptional<z.ZodNumber>;
    retention: z.ZodDefault<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    maxMessages: z.ZodOptional<z.ZodNumber>;
    rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    simulation: z.ZodOptional<z.ZodObject<{
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
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    connections: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        name: z.ZodString;
        retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
        rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        simulation: z.ZodOptional<z.ZodObject<{
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
            openRate: z.ZodOptional<z.ZodNumber>;
            clickRate: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        kind: z.ZodLiteral<"resend">;
    }, z.core.$strip>, z.ZodObject<{
        name: z.ZodString;
        retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
        rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        simulation: z.ZodOptional<z.ZodObject<{
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
            openRate: z.ZodOptional<z.ZodNumber>;
            clickRate: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        kind: z.ZodLiteral<"brevo">;
    }, z.core.$strip>, z.ZodObject<{
        name: z.ZodString;
        retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
        rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        simulation: z.ZodOptional<z.ZodObject<{
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
            openRate: z.ZodOptional<z.ZodNumber>;
            clickRate: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        kind: z.ZodLiteral<"smtp">;
        smtpUsername: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>], "kind">>>;
    templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        subject: z.ZodString;
        html: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        sender: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
            email: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
            email: string;
            name?: string | undefined;
        }>>>>;
        externalId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const ConnectionView: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        smtp: "smtp";
    }>;
    smtpUsername: z.ZodNullable<z.ZodString>;
    keyPreview: z.ZodNullable<z.ZodString>;
    retentionSeconds: z.ZodNullable<z.ZodNumber>;
    rateLimit: z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    simulation: z.ZodNullable<z.ZodObject<{
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
        openRate: z.ZodOptional<z.ZodNumber>;
        clickRate: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    disabledAt: z.ZodNullable<z.ZodISODateTime>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const WorkspaceView: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    ephemeral: z.ZodBoolean;
    idleTtlSeconds: z.ZodNullable<z.ZodNumber>;
    expiresAt: z.ZodNullable<z.ZodISODateTime>;
    lastActivityAt: z.ZodISODateTime;
    retentionSeconds: z.ZodNumber;
    maxMessages: z.ZodNullable<z.ZodNumber>;
    rateLimit: z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    simulation: z.ZodObject<{
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
    }, z.core.$strip>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
    urls: z.ZodObject<{
        ui: z.ZodString;
        capture: z.ZodString;
        mcp: z.ZodString;
    }, z.core.$strip>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const WorkspaceDetail: z.ZodObject<{
    id: z.ZodString;
    slug: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    ephemeral: z.ZodBoolean;
    idleTtlSeconds: z.ZodNullable<z.ZodNumber>;
    expiresAt: z.ZodNullable<z.ZodISODateTime>;
    lastActivityAt: z.ZodISODateTime;
    retentionSeconds: z.ZodNumber;
    maxMessages: z.ZodNullable<z.ZodNumber>;
    rateLimit: z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    simulation: z.ZodObject<{
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
    }, z.core.$strip>;
    metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
    urls: z.ZodObject<{
        ui: z.ZodString;
        capture: z.ZodString;
        mcp: z.ZodString;
    }, z.core.$strip>;
    createdAt: z.ZodISODateTime;
    connections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            brevo: "brevo";
            resend: "resend";
            smtp: "smtp";
        }>;
        smtpUsername: z.ZodNullable<z.ZodString>;
        keyPreview: z.ZodNullable<z.ZodString>;
        retentionSeconds: z.ZodNullable<z.ZodNumber>;
        rateLimit: z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        simulation: z.ZodNullable<z.ZodObject<{
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
            openRate: z.ZodOptional<z.ZodNumber>;
            clickRate: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        disabledAt: z.ZodNullable<z.ZodISODateTime>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Secrets, returned once at creation. */
export declare const ConnectionCredentials: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"resend">;
    apiKey: z.ZodString;
    baseUrl: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"brevo">;
    apiKey: z.ZodString;
    baseUrl: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"smtp">;
    smtpHost: z.ZodString;
    smtpPort: z.ZodNumber;
    smtpUser: z.ZodString;
    smtpPass: z.ZodString;
}, z.core.$strip>], "kind">;
/** 201, secrets shown once. */
export declare const CreateWorkspaceResponse: z.ZodObject<{
    workspace: z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        ephemeral: z.ZodBoolean;
        idleTtlSeconds: z.ZodNullable<z.ZodNumber>;
        expiresAt: z.ZodNullable<z.ZodISODateTime>;
        lastActivityAt: z.ZodISODateTime;
        retentionSeconds: z.ZodNumber;
        maxMessages: z.ZodNullable<z.ZodNumber>;
        rateLimit: z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        simulation: z.ZodObject<{
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
        }, z.core.$strip>;
        metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
        urls: z.ZodObject<{
            ui: z.ZodString;
            capture: z.ZodString;
            mcp: z.ZodString;
        }, z.core.$strip>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>;
    workspaceKey: z.ZodString;
    connections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<{
            brevo: "brevo";
            resend: "resend";
            smtp: "smtp";
        }>;
        smtpUsername: z.ZodNullable<z.ZodString>;
        keyPreview: z.ZodNullable<z.ZodString>;
        retentionSeconds: z.ZodNullable<z.ZodNumber>;
        rateLimit: z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        simulation: z.ZodNullable<z.ZodObject<{
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
            openRate: z.ZodOptional<z.ZodNumber>;
            clickRate: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        disabledAt: z.ZodNullable<z.ZodISODateTime>;
        createdAt: z.ZodISODateTime;
        credentials: z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"resend">;
            apiKey: z.ZodString;
            baseUrl: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"brevo">;
            apiKey: z.ZodString;
            baseUrl: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            kind: z.ZodLiteral<"smtp">;
            smtpHost: z.ZodString;
            smtpPort: z.ZodNumber;
            smtpUser: z.ZodString;
            smtpPass: z.ZodString;
        }, z.core.$strip>], "kind">;
        envSnippet: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ListWorkspacesQuery: z.ZodObject<{
    includeEphemeral: z.ZodDefault<z.ZodUnion<readonly [z.ZodBoolean, z.ZodCodec<z.ZodString, z.ZodBoolean>]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const ListWorkspacesResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        slug: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        ephemeral: z.ZodBoolean;
        idleTtlSeconds: z.ZodNullable<z.ZodNumber>;
        expiresAt: z.ZodNullable<z.ZodISODateTime>;
        lastActivityAt: z.ZodISODateTime;
        retentionSeconds: z.ZodNumber;
        maxMessages: z.ZodNullable<z.ZodNumber>;
        rateLimit: z.ZodNullable<z.ZodObject<{
            limit: z.ZodNumber;
            windowSeconds: z.ZodDefault<z.ZodNumber>;
            burst: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        simulation: z.ZodObject<{
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
        }, z.core.$strip>;
        metadata: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodString>>;
        urls: z.ZodObject<{
            ui: z.ZodString;
            capture: z.ZodString;
            mcp: z.ZodString;
        }, z.core.$strip>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ConnectionInput = z.output<typeof ConnectionInput>;
export type CreateWorkspaceRequest = z.output<typeof CreateWorkspaceRequest>;
export type ConnectionView = z.output<typeof ConnectionView>;
export type WorkspaceView = z.output<typeof WorkspaceView>;
export type WorkspaceDetail = z.output<typeof WorkspaceDetail>;
export type ConnectionCredentials = z.output<typeof ConnectionCredentials>;
export type CreateWorkspaceResponse = z.output<typeof CreateWorkspaceResponse>;
export type ListWorkspacesQuery = z.output<typeof ListWorkspacesQuery>;
