import { z } from 'zod';
export declare const OverrideConfig: z.ZodObject<{
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
export declare const ActivateOverrideRequest: z.ZodObject<{
    connectionId: z.ZodOptional<z.ZodString>;
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
    ttl: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>>;
}, z.core.$strip>;
export declare const ResetOverrideRequest: z.ZodObject<{
    connectionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const OverrideView: z.ZodObject<{
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
}, z.core.$strip>;
export declare const OverrideState: z.ZodObject<{
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
export type OverrideConfig = z.output<typeof OverrideConfig>;
export type ActivateOverrideRequest = z.output<typeof ActivateOverrideRequest>;
export type OverrideView = z.output<typeof OverrideView>;
export type OverrideState = z.output<typeof OverrideState>;
