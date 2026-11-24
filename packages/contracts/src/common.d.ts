import { z } from 'zod';
/**
 * Refinement options carrying an English message (D19) and a stable machine-readable code
 * in `params.code`, so the UI can map it to a translated label.
 */
export declare function issue(code: string, message: string, path?: PropertyKey[]): {
    message: string;
    path: PropertyKey[] | undefined;
    params: {
        code: string;
    };
};
/** Stable code of a custom issue raised by these contracts, if any. */
export declare function issueCode(zodIssue: z.core.$ZodIssue | undefined): string | undefined;
/** Lower-cased e-mail address. */
export declare const Email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
export declare const Slug: z.ZodString;
/** "90s" | "30m" | "1h" | "7d" -> seconds, or null when the string is not a duration. */
export declare function parseDuration(input: string): number | null;
/** Positive integer seconds, or a string such as "1h" or "7d". Output: seconds. */
export declare const Duration: z.ZodPipe<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>, z.ZodTransform<number, string | number>>;
/** Boolean from a query string ("true", "1", "yes"…) or from a router that already parsed it. */
export declare const QueryBool: z.ZodUnion<readonly [z.ZodBoolean, z.ZodCodec<z.ZodString, z.ZodBoolean>]>;
export declare const IsoDateTime: z.ZodISODateTime;
export declare const Tag: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>;
/** Cursor pagination envelope shared by every list endpoint. */
export declare function Page<T extends z.ZodType>(item: T): z.ZodObject<{
    data: z.ZodArray<T>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const PageLimit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
export type Duration = z.output<typeof Duration>;
export type Tag = z.output<typeof Tag>;
