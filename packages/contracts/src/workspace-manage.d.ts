import { z } from 'zod';
/**
 * Lower-case ASCII, words joined by `-`; `workspace` when nothing is left. The base of
 * generated slugs (core) and the live slug preview of the UI creation dialog.
 */
export declare function slugify(name: string): string;
/** Editable workspace settings; absent keys are left alone, `null` clears a nullable one. */
export declare const UpdateWorkspaceRequest: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    retention: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>, z.ZodNumber>>;
    rateLimit: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        limit: z.ZodNumber;
        windowSeconds: z.ZodDefault<z.ZodNumber>;
        burst: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
    maxMessages: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
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
}, z.core.$strip>;
/** Rename a connection, or disable it (`enabled: false` sets `disabledAt`). */
export declare const UpdateConnectionRequest: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/** A connection with its secrets: answered once, at creation or rotation. */
export declare const CreatedConnection: z.ZodObject<{
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
}, z.core.$strip>;
/** `POST /admin/workspaces/:id/key/rotate`: the new `mskw_` key, answered once. */
export declare const RotatedWorkspaceKey: z.ZodObject<{
    workspaceKey: z.ZodString;
    keyPreview: z.ZodString;
}, z.core.$strip>;
export type UpdateWorkspaceRequest = z.output<typeof UpdateWorkspaceRequest>;
export type RotatedWorkspaceKey = z.output<typeof RotatedWorkspaceKey>;
export type UpdateConnectionRequest = z.output<typeof UpdateConnectionRequest>;
export type CreatedConnection = z.output<typeof CreatedConnection>;
