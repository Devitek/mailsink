import { z } from 'zod';
export declare const TemplateId: z.ZodString;
/** Brevo template id: positive 32-bit integer (Postgres `integer`). */
export declare const TemplateExternalId: z.ZodCoercedNumber<unknown>;
/** `POST /admin/workspaces/:id/templates` and the `templates` seed of a new workspace. */
export declare const TemplateInput: z.ZodObject<{
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
}, z.core.$strip>;
/** `PATCH /admin/workspaces/:id/templates/:templateId`: absent fields are kept. */
export declare const TemplatePatch: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    html: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    text: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sender: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        email: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>]>, z.ZodTransform<import("./address").ParsedAddress, string | {
        email: string;
        name?: string | undefined;
    }>>>>;
}, z.core.$strip>;
export declare const TemplateView: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodNumber;
    name: z.ZodString;
    subject: z.ZodString;
    html: z.ZodNullable<z.ZodString>;
    text: z.ZodNullable<z.ZodString>;
    sender: z.ZodNullable<z.ZodObject<{
        email: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
/** `:templateId` of the Admin template routes: the numeric `externalId`. */
export declare const TemplateParams: z.ZodObject<{
    id: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
    templateId: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
/** Ascending `externalId`; `nextCursor` is the `externalId` of the last row. */
export declare const ListTemplatesQuery: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const ListTemplatesResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        externalId: z.ZodNumber;
        name: z.ZodString;
        subject: z.ZodString;
        html: z.ZodNullable<z.ZodString>;
        text: z.ZodNullable<z.ZodString>;
        sender: z.ZodNullable<z.ZodObject<{
            email: z.ZodString;
            name: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
/** At most this many templates in the `templates` seed of `POST /admin/workspaces`. */
export declare const MAX_SEEDED_TEMPLATES = 500;
export declare const TemplateSeed: z.ZodArray<z.ZodObject<{
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
}, z.core.$strip>>;
export type TemplateInput = z.output<typeof TemplateInput>;
export type TemplateInputRaw = z.input<typeof TemplateInput>;
export type TemplatePatch = z.output<typeof TemplatePatch>;
export type TemplateView = z.output<typeof TemplateView>;
export type ListTemplatesQuery = z.output<typeof ListTemplatesQuery>;
export type ListTemplatesResponse = z.output<typeof ListTemplatesResponse>;
