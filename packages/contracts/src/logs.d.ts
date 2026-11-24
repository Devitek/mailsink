import { z } from 'zod';
export declare const ApiLogId: z.ZodString;
export declare const SmtpSessionId: z.ZodString;
/** Mirrors the `api_dialect` pg enum: the HTTP surface a call hit. */
export declare const ApiDialect: z.ZodEnum<{
    admin: "admin";
    brevo: "brevo";
    capture: "capture";
    mcp: "mcp";
    native: "native";
    resend: "resend";
}>;
/** Mirrors the `smtp_outcome` pg enum. */
export declare const SmtpOutcome: z.ZodEnum<{
    accepted: "accepted";
    auth_failed: "auth_failed";
    error: "error";
    rejected: "rejected";
}>;
/** Page-number pagination of the log tables (server side, with the total for the pager). */
export declare function NumberedPage<T extends z.ZodType>(item: T): z.ZodObject<{
    data: z.ZodArray<T>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
/** One status code (`404`) or a class (`4xx`). */
export declare const StatusFilter: z.ZodString;
export declare const ApiLogSort: z.ZodEnum<{
    "-createdAt": "-createdAt";
    "-durationMs": "-durationMs";
    "-statusCode": "-statusCode";
    createdAt: "createdAt";
    durationMs: "durationMs";
    statusCode: "statusCode";
}>;
export declare const ListApiLogsQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    connectionId: z.ZodOptional<z.ZodString>;
    dialect: z.ZodOptional<z.ZodPreprocess<z.ZodArray<z.ZodEnum<{
        admin: "admin";
        brevo: "brevo";
        capture: "capture";
        mcp: "mcp";
        native: "native";
        resend: "resend";
    }>>, unknown>>;
    status: z.ZodOptional<z.ZodPreprocess<z.ZodArray<z.ZodString>, unknown>>;
    errorCode: z.ZodOptional<z.ZodString>;
    method: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    path: z.ZodOptional<z.ZodString>;
    messageId: z.ZodOptional<z.ZodString>;
    since: z.ZodOptional<z.ZodISODateTime>;
    until: z.ZodOptional<z.ZodISODateTime>;
    sort: z.ZodDefault<z.ZodEnum<{
        "-createdAt": "-createdAt";
        "-durationMs": "-durationMs";
        "-statusCode": "-statusCode";
        createdAt: "createdAt";
        durationMs: "durationMs";
        statusCode: "statusCode";
    }>>;
}, z.core.$strip>;
export declare const ApiLogSummary: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    dialect: z.ZodEnum<{
        admin: "admin";
        brevo: "brevo";
        capture: "capture";
        mcp: "mcp";
        native: "native";
        resend: "resend";
    }>;
    method: z.ZodString;
    path: z.ZodString;
    statusCode: z.ZodNumber;
    durationMs: z.ZodNumber;
    errorCode: z.ZodNullable<z.ZodString>;
    messageIds: z.ZodArray<z.ZodString>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ApiLogDetail: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    dialect: z.ZodEnum<{
        admin: "admin";
        brevo: "brevo";
        capture: "capture";
        mcp: "mcp";
        native: "native";
        resend: "resend";
    }>;
    method: z.ZodString;
    path: z.ZodString;
    statusCode: z.ZodNumber;
    durationMs: z.ZodNumber;
    errorCode: z.ZodNullable<z.ZodString>;
    messageIds: z.ZodArray<z.ZodString>;
    createdAt: z.ZodISODateTime;
    requestHeaders: z.ZodRecord<z.ZodString, z.ZodString>;
    requestBody: z.ZodNullable<z.ZodUnknown>;
    responseHeaders: z.ZodRecord<z.ZodString, z.ZodString>;
    responseBody: z.ZodNullable<z.ZodUnknown>;
    ip: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ListApiLogsResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodNullable<z.ZodString>;
        dialect: z.ZodEnum<{
            admin: "admin";
            brevo: "brevo";
            capture: "capture";
            mcp: "mcp";
            native: "native";
            resend: "resend";
        }>;
        method: z.ZodString;
        path: z.ZodString;
        statusCode: z.ZodNumber;
        durationMs: z.ZodNumber;
        errorCode: z.ZodNullable<z.ZodString>;
        messageIds: z.ZodArray<z.ZodString>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
export declare const SmtpSessionSort: z.ZodEnum<{
    "-startedAt": "-startedAt";
    startedAt: "startedAt";
}>;
export declare const ListSmtpSessionsQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    connectionId: z.ZodOptional<z.ZodString>;
    outcome: z.ZodOptional<z.ZodPreprocess<z.ZodArray<z.ZodEnum<{
        accepted: "accepted";
        auth_failed: "auth_failed";
        error: "error";
        rejected: "rejected";
    }>>, unknown>>;
    q: z.ZodOptional<z.ZodString>;
    messageId: z.ZodOptional<z.ZodString>;
    since: z.ZodOptional<z.ZodISODateTime>;
    until: z.ZodOptional<z.ZodISODateTime>;
    sort: z.ZodDefault<z.ZodEnum<{
        "-startedAt": "-startedAt";
        startedAt: "startedAt";
    }>>;
}, z.core.$strip>;
export declare const TranscriptLine: z.ZodObject<{
    at: z.ZodNumber;
    dir: z.ZodEnum<{
        C: "C";
        S: "S";
    }>;
    line: z.ZodString;
}, z.core.$strip>;
export declare const SmtpSessionSummary: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    remoteAddress: z.ZodString;
    clientHostname: z.ZodNullable<z.ZodString>;
    authUser: z.ZodNullable<z.ZodString>;
    secure: z.ZodBoolean;
    outcome: z.ZodEnum<{
        accepted: "accepted";
        auth_failed: "auth_failed";
        error: "error";
        rejected: "rejected";
    }>;
    error: z.ZodNullable<z.ZodString>;
    messageIds: z.ZodArray<z.ZodString>;
    startedAt: z.ZodISODateTime;
    endedAt: z.ZodNullable<z.ZodISODateTime>;
}, z.core.$strip>;
export declare const SmtpSessionDetail: z.ZodObject<{
    id: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    remoteAddress: z.ZodString;
    clientHostname: z.ZodNullable<z.ZodString>;
    authUser: z.ZodNullable<z.ZodString>;
    secure: z.ZodBoolean;
    outcome: z.ZodEnum<{
        accepted: "accepted";
        auth_failed: "auth_failed";
        error: "error";
        rejected: "rejected";
    }>;
    error: z.ZodNullable<z.ZodString>;
    messageIds: z.ZodArray<z.ZodString>;
    startedAt: z.ZodISODateTime;
    endedAt: z.ZodNullable<z.ZodISODateTime>;
    transcript: z.ZodArray<z.ZodObject<{
        at: z.ZodNumber;
        dir: z.ZodEnum<{
            C: "C";
            S: "S";
        }>;
        line: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ListSmtpSessionsResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        connectionId: z.ZodNullable<z.ZodString>;
        remoteAddress: z.ZodString;
        clientHostname: z.ZodNullable<z.ZodString>;
        authUser: z.ZodNullable<z.ZodString>;
        secure: z.ZodBoolean;
        outcome: z.ZodEnum<{
            accepted: "accepted";
            auth_failed: "auth_failed";
            error: "error";
            rejected: "rejected";
        }>;
        error: z.ZodNullable<z.ZodString>;
        messageIds: z.ZodArray<z.ZodString>;
        startedAt: z.ZodISODateTime;
        endedAt: z.ZodNullable<z.ZodISODateTime>;
    }, z.core.$strip>>;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
}, z.core.$strip>;
export declare const ApiLogParams: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const SmtpSessionParams: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export type ApiDialect = z.output<typeof ApiDialect>;
export type SmtpOutcome = z.output<typeof SmtpOutcome>;
export type ListApiLogsQuery = z.output<typeof ListApiLogsQuery>;
export type ApiLogSummary = z.output<typeof ApiLogSummary>;
export type ApiLogDetail = z.output<typeof ApiLogDetail>;
export type ListApiLogsResponse = z.output<typeof ListApiLogsResponse>;
export type ListSmtpSessionsQuery = z.output<typeof ListSmtpSessionsQuery>;
export type TranscriptLine = z.output<typeof TranscriptLine>;
export type SmtpSessionSummary = z.output<typeof SmtpSessionSummary>;
export type SmtpSessionDetail = z.output<typeof SmtpSessionDetail>;
export type ListSmtpSessionsResponse = z.output<typeof ListSmtpSessionsResponse>;
