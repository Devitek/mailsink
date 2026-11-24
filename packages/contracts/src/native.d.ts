import { z } from 'zod';
import { ApiError } from './errors';
export declare const MAX_RECIPIENTS = 50;
export declare const MAX_BATCH_SIZE = 100;
export declare const AttachmentInput: z.ZodObject<{
    filename: z.ZodString;
    content: z.ZodBase64;
    contentType: z.ZodOptional<z.ZodString>;
    contentId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SendEmailRequest: z.ZodObject<{
    from: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>;
    to: z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>, z.ZodArray<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>;
    cc: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>, z.ZodArray<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    bcc: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>, z.ZodArray<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    replyTo: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>, z.ZodArray<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    subject: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        filename: z.ZodString;
        content: z.ZodBase64;
        contentType: z.ZodOptional<z.ZodString>;
        contentId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const SendEmailResponse: z.ZodObject<{
    id: z.ZodString;
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
}, z.core.$strip>;
/**
 * Batch envelope: 1 to 100 items. Items are validated one by one with SendEmailRequest
 * (see parseBatchItem) so a bad item only fails its own slot (partial success, 207).
 */
export declare const BatchRequest: z.ZodArray<z.ZodUnknown>;
export declare const BatchItemResult: z.ZodDiscriminatedUnion<[z.ZodObject<{
    ok: z.ZodLiteral<true>;
    index: z.ZodNumber;
    id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    index: z.ZodNumber;
    error: z.ZodObject<{
        code: z.ZodEnum<{
            chaos_injected: "chaos_injected";
            conflict: "conflict";
            forbidden: "forbidden";
            idempotency_mismatch: "idempotency_mismatch";
            internal_error: "internal_error";
            not_found: "not_found";
            payload_too_large: "payload_too_large";
            rate_limited: "rate_limited";
            unauthorized: "unauthorized";
            validation_error: "validation_error";
            wait_timeout: "wait_timeout";
        }>;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>], "ok">;
/** 207 when partial, 200 when every item is accepted. */
export declare const BatchResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        ok: z.ZodLiteral<true>;
        index: z.ZodNumber;
        id: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        ok: z.ZodLiteral<false>;
        index: z.ZodNumber;
        error: z.ZodObject<{
            code: z.ZodEnum<{
                chaos_injected: "chaos_injected";
                conflict: "conflict";
                forbidden: "forbidden";
                idempotency_mismatch: "idempotency_mismatch";
                internal_error: "internal_error";
                not_found: "not_found";
                payload_too_large: "payload_too_large";
                rate_limited: "rate_limited";
                unauthorized: "unauthorized";
                validation_error: "validation_error";
                wait_timeout: "wait_timeout";
            }>;
            message: z.ZodString;
            details: z.ZodOptional<z.ZodUnknown>;
        }, z.core.$strip>;
    }, z.core.$strip>], "ok">>;
}, z.core.$strip>;
/** Validates one batch item; the error is ready for a BatchItemResult. */
export declare function parseBatchItem(item: unknown): {
    ok: true;
    data: SendEmailRequest;
} | {
    ok: false;
    error: ApiError;
};
export type AttachmentInput = z.output<typeof AttachmentInput>;
export type SendEmailRequest = z.output<typeof SendEmailRequest>;
export type SendEmailRequestInput = z.input<typeof SendEmailRequest>;
export type SendEmailResponse = z.output<typeof SendEmailResponse>;
export type BatchItemResult = z.output<typeof BatchItemResult>;
export type BatchResponse = z.output<typeof BatchResponse>;
