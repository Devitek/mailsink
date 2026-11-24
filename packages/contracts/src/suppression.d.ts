import { z } from 'zod';
export declare const SuppressionId: z.ZodString;
/** Mirrors the pg enum `suppression_reason`. */
export declare const SuppressionReason: z.ZodEnum<{
    complained: "complained";
    hard_bounce: "hard_bounce";
    manual: "manual";
}>;
/** `GET /capture/suppressions`: newest first, keyset cursor (the id of the last row). */
export declare const ListSuppressionsQuery: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    cursor: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** `DELETE /capture/suppressions[?email=]`: one address, or the whole list when omitted. */
export declare const DeleteSuppressionsQuery: z.ZodObject<{
    email: z.ZodOptional<z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>>;
}, z.core.$strip>;
export declare const SuppressionView: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    reason: z.ZodEnum<{
        complained: "complained";
        hard_bounce: "hard_bounce";
        manual: "manual";
    }>;
    messageId: z.ZodNullable<z.ZodString>;
    connectionId: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
/** One page plus the number of addresses matching the filter (every page). */
export declare const ListSuppressionsResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        reason: z.ZodEnum<{
            complained: "complained";
            hard_bounce: "hard_bounce";
            manual: "manual";
        }>;
        messageId: z.ZodNullable<z.ZodString>;
        connectionId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
    total: z.ZodNumber;
}, z.core.$strip>;
export declare const DeleteSuppressionsResponse: z.ZodObject<{
    count: z.ZodNumber;
}, z.core.$strip>;
export type SuppressionReason = z.output<typeof SuppressionReason>;
export type ListSuppressionsQuery = z.output<typeof ListSuppressionsQuery>;
export type DeleteSuppressionsQuery = z.output<typeof DeleteSuppressionsQuery>;
export type SuppressionView = z.output<typeof SuppressionView>;
export type ListSuppressionsResponse = z.output<typeof ListSuppressionsResponse>;
export type DeleteSuppressionsResponse = z.output<typeof DeleteSuppressionsResponse>;
