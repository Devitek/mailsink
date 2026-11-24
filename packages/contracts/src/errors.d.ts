import { z } from 'zod';
/** Error codes of the native, capture and admin APIs. Messages stay English (D19). */
export declare const ErrorCode: z.ZodEnum<{
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
export declare const ApiError: z.ZodObject<{
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
/** Error body: `{ error: { code, message, details? }, requestId }`. */
export declare const ApiErrorBody: z.ZodObject<{
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
    requestId: z.ZodString;
}, z.core.$strip>;
export type ErrorCode = z.output<typeof ErrorCode>;
export type ApiError = z.output<typeof ApiError>;
export type ApiErrorBody = z.output<typeof ApiErrorBody>;
