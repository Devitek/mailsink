import { z } from 'zod';
export declare const DEFAULT_RETENTION_SECONDS: number;
/** Retention: a Duration between 1 minute and 365 days. */
export declare const Retention: z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>;
/** Percentages per simulated status; the remainder goes to `delivered`. */
export declare const StatusRates: z.ZodRecord<z.ZodEnum<{
    complained: "complained";
    deferred: "deferred";
    delivered: "delivered";
    failed: "failed";
    hard_bounce: "hard_bounce";
    soft_bounce: "soft_bounce";
}> & z.core.$partial, z.ZodNumber>;
export declare const RecipientRule: z.ZodObject<{
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
}, z.core.$strip>;
export declare const Latency: z.ZodObject<{
    minMs: z.ZodNumber;
    maxMs: z.ZodNumber;
}, z.core.$strip>;
/** Fails the request itself (HTTP or SMTP), before ingestion. */
export declare const Chaos: z.ZodObject<{
    errorRate: z.ZodNumber;
    httpCodes: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodLiteral<429>, z.ZodLiteral<500>, z.ZodLiteral<502>, z.ZodLiteral<503>]>>>;
    smtpCodes: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodLiteral<421>, z.ZodLiteral<451>, z.ZodLiteral<452>, z.ZodLiteral<550>]>>>;
}, z.core.$strip>;
export declare const RateLimitSettings: z.ZodObject<{
    limit: z.ZodNumber;
    windowSeconds: z.ZodDefault<z.ZodNumber>;
    burst: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const RecipientRules: z.ZodArray<z.ZodObject<{
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
}, z.core.$strip>>;
/** Partial simulation settings (connection level, override): absent keys inherit. */
export declare const SimulationSettingsPatch: z.ZodObject<{
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
}, z.core.$strip>;
/** Complete simulation settings (workspace level, resolved values). */
export declare const SimulationSettings: z.ZodObject<{
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
export type StatusRates = z.output<typeof StatusRates>;
export type RecipientRule = z.output<typeof RecipientRule>;
export type Latency = z.output<typeof Latency>;
export type Chaos = z.output<typeof Chaos>;
export type RateLimitSettings = z.output<typeof RateLimitSettings>;
export type SimulationSettingsPatch = z.output<typeof SimulationSettingsPatch>;
export type SimulationSettings = z.output<typeof SimulationSettings>;
