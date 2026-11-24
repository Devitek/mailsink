import { z } from 'zod';
/** `/`: the workspace picker; ephemeral workspaces are hidden by default (#37). */
export declare const PickerSearch: z.ZodObject<{
    ephemeral: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type PickerSearch = z.infer<typeof PickerSearch>;
/** Tabs of the message viewer (#40). */
export declare const InboxTab: z.ZodEnum<{
    headers: "headers";
    history: "history";
    links: "links";
    preview: "preview";
    text: "text";
}>;
export type InboxTab = z.infer<typeof InboxTab>;
/**
 * `/w/$workspaceSlug`: the inbox (#39) and its message viewer (#40). Filters live in the
 * URL so a filtered view can be shared and survives a reload; an invalid value is dropped.
 * - `q`: search box (full text, `to:` / `from:` operators, an address searches recipients);
 * - `status`, `connectionId`, `tag` (`name` or `name:value`): facets;
 * - `m`: the open message, `tab`: its viewer tab (preview when absent).
 */
export declare const InboxSearch: z.ZodObject<{
    q: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    status: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        complained: "complained";
        deferred: "deferred";
        delivered: "delivered";
        failed: "failed";
        hard_bounce: "hard_bounce";
        queued: "queued";
        sent: "sent";
        soft_bounce: "soft_bounce";
        suppressed: "suppressed";
    }>>>;
    connectionId: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    tag: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    m: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    tab: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        headers: "headers";
        history: "history";
        links: "links";
        preview: "preview";
        text: "text";
    }>>>;
}, z.core.$strip>;
export type InboxSearch = z.infer<typeof InboxSearch>;
/** Tabs of the logs explorer (#41). */
export declare const LogsTab: z.ZodEnum<{
    api: "api";
    smtp: "smtp";
    webhooks: "webhooks";
}>;
export type LogsTab = z.infer<typeof LogsTab>;
/** Sort of the log tables: the API sort keys; `createdAt` is `startedAt` for SMTP. */
export declare const LogsSort: z.ZodEnum<{
    "-createdAt": "-createdAt";
    "-durationMs": "-durationMs";
    "-statusCode": "-statusCode";
    createdAt: "createdAt";
    durationMs: "durationMs";
    statusCode: "statusCode";
}>;
export type LogsSort = z.infer<typeof LogsSort>;
/**
 * `/w/$workspaceSlug/logs`: the logs explorer (#41). Every key is optional so links stay
 * short; `features/logs/search-query.ts` resolves the defaults (tab `api`, sort
 * `-createdAt`, page 1, 50 rows). An invalid value is dropped, never an error page.
 * - `q`: API path substring, SMTP address / hostname / AUTH user substring;
 * - `connectionId`: API and SMTP; `dialect`, `code` (HTTP status `404` or class `4xx`): API;
 *   `outcome`: SMTP;
 * - `delivery` (status), `format` (payload format), `endpointId`: webhooks, one value each
 *   (the delivery log filters on one value);
 * - `messageId`: every tab (rows naming that message); `since`, `until`: API and SMTP (ISO
 *   dates, inclusive); `method`, `errorCode`: API (#112);
 * - `sort`: API and SMTP; `page`, `pageSize`: every tab (page numbers with a total);
 * - `cursor`: webhooks, keyset of the delivery log, kept for old links (`page` wins, #112);
 * - `inspect`: the row open in the inspector sheet.
 */
export declare const LogsSearch: z.ZodObject<{
    tab: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        api: "api";
        smtp: "smtp";
        webhooks: "webhooks";
    }>>>;
    q: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
    connectionId: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    dialect: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        admin: "admin";
        brevo: "brevo";
        capture: "capture";
        mcp: "mcp";
        native: "native";
        resend: "resend";
    }>>>, unknown>>;
    code: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodString>>, unknown>>;
    outcome: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        accepted: "accepted";
        auth_failed: "auth_failed";
        error: "error";
        rejected: "rejected";
    }>>>, unknown>>;
    delivery: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        failed: "failed";
        pending: "pending";
        retrying: "retrying";
        succeeded: "succeeded";
    }>>>;
    format: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>>>;
    endpointId: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    messageId: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    since: z.ZodCatch<z.ZodOptional<z.ZodISODateTime>>;
    until: z.ZodCatch<z.ZodOptional<z.ZodISODateTime>>;
    method: z.ZodCatch<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    errorCode: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    sort: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        "-createdAt": "-createdAt";
        "-durationMs": "-durationMs";
        "-statusCode": "-statusCode";
        createdAt: "createdAt";
        durationMs: "durationMs";
        statusCode: "statusCode";
    }>>>;
    page: z.ZodCatch<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    pageSize: z.ZodCatch<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    cursor: z.ZodCatch<z.ZodOptional<z.ZodString>>;
    inspect: z.ZodCatch<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type LogsSearch = z.infer<typeof LogsSearch>;
/**
 * `/w/$workspaceSlug/connections`: the connection open in the side panel, by id, or `new`
 * for the creation form (#38). Absent: the first connection.
 */
export declare const ConnectionsSearch: z.ZodObject<{
    connection: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ConnectionsSearch = z.infer<typeof ConnectionsSearch>;
/** Sections of the workspace settings page (#43, prototype « Paramètres »). */
export declare const SettingsSection: z.ZodEnum<{
    connections: "connections";
    mcp: "mcp";
    retention: "retention";
    simulation: "simulation";
    templates: "templates";
    webhooks: "webhooks";
}>;
export type SettingsSection = z.infer<typeof SettingsSection>;
/** `/w/$workspaceSlug/settings`: the open section (webhooks when absent or invalid). */
export declare const SettingsSearch: z.ZodObject<{
    section: z.ZodCatch<z.ZodOptional<z.ZodEnum<{
        connections: "connections";
        mcp: "mcp";
        retention: "retention";
        simulation: "simulation";
        templates: "templates";
        webhooks: "webhooks";
    }>>>;
}, z.core.$strip>;
export type SettingsSearch = z.infer<typeof SettingsSearch>;
/** `/w/$workspaceSlug/suppressions`: the address filter (case-insensitive substring, #42). */
export declare const SuppressionsSearch: z.ZodObject<{
    email: z.ZodCatch<z.ZodPreprocess<z.ZodOptional<z.ZodString>, unknown>>;
}, z.core.$strip>;
export type SuppressionsSearch = z.infer<typeof SuppressionsSearch>;
