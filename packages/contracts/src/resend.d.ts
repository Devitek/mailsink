import { z } from 'zod';
export declare const RESEND_ADDRESS_HINT = "The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.";
/** "jane@x.io" or "Jane <jane@x.io>" (strings only, as Resend) to { email, name? }. */
export declare const ResendAddress: z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>;
/** One address or an array of addresses, always output as an array. */
export declare const ResendAddressList: z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>, z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>;
export declare const ResendTag: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>;
export declare const ResendAttachment: z.ZodObject<{
    content: z.ZodOptional<z.ZodBase64>;
    path: z.ZodOptional<z.ZodString>;
    filename: z.ZodOptional<z.ZodString>;
    content_type: z.ZodOptional<z.ZodString>;
    content_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ResendSendRequest: z.ZodObject<{
    from: z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>;
    to: z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>, z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>;
    subject: z.ZodString;
    cc: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>, z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    bcc: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>, z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    reply_to: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>, z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    replyTo: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>, z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<import("./address").ParsedAddress, string>>>]>, z.ZodTransform<import("./address").ParsedAddress[], import("./address").ParsedAddress[] | import("./address").ParsedAddress>>>;
    html: z.ZodOptional<z.ZodString>;
    text: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    attachments: z.ZodOptional<z.ZodArray<z.ZodObject<{
        content: z.ZodOptional<z.ZodBase64>;
        path: z.ZodOptional<z.ZodString>;
        filename: z.ZodOptional<z.ZodString>;
        content_type: z.ZodOptional<z.ZodString>;
        content_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
    scheduled_at: z.ZodOptional<z.ZodString>;
    topic_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    template: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type ResendSendRequest = z.output<typeof ResendSendRequest>;
/** `x-batch-validation` header of `POST /emails/batch` (SDK option `batchValidation`). */
export declare const ResendBatchValidation: z.ZodEnum<{
    permissive: "permissive";
    strict: "strict";
}>;
export type ResendBatchValidation = z.output<typeof ResendBatchValidation>;
export declare const RESEND_MAX_BATCH_SIZE = 100;
export declare const ResendSendResponse: z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strip>;
export declare const ResendBatchResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
    }, z.core.$strip>>;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        message: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ResendSendResponse = z.output<typeof ResendSendResponse>;
export type ResendBatchResponse = z.output<typeof ResendBatchResponse>;
export declare const ResendLastEvent: z.ZodEnum<{
    bounced: "bounced";
    canceled: "canceled";
    clicked: "clicked";
    complained: "complained";
    delivered: "delivered";
    delivery_delayed: "delivery_delayed";
    failed: "failed";
    opened: "opened";
    queued: "queued";
    scheduled: "scheduled";
    sent: "sent";
    suppressed: "suppressed";
}>;
/** `GET /emails/:id` */
export declare const ResendEmail: z.ZodObject<{
    object: z.ZodLiteral<"email">;
    id: z.ZodUUID;
    message_id: z.ZodString;
    to: z.ZodArray<z.ZodString>;
    from: z.ZodString;
    created_at: z.ZodString;
    subject: z.ZodString;
    html: z.ZodNullable<z.ZodString>;
    text: z.ZodNullable<z.ZodString>;
    bcc: z.ZodArray<z.ZodString>;
    cc: z.ZodArray<z.ZodString>;
    reply_to: z.ZodArray<z.ZodString>;
    last_event: z.ZodEnum<{
        bounced: "bounced";
        canceled: "canceled";
        clicked: "clicked";
        complained: "complained";
        delivered: "delivered";
        delivery_delayed: "delivery_delayed";
        failed: "failed";
        opened: "opened";
        queued: "queued";
        scheduled: "scheduled";
        sent: "sent";
        suppressed: "suppressed";
    }>;
    scheduled_at: z.ZodNullable<z.ZodString>;
    tags: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ResendEmail = z.output<typeof ResendEmail>;
export type ResendLastEvent = z.output<typeof ResendLastEvent>;
/** Names Mailsink answers with (a subset of the SDK's `RESEND_ERROR_CODE_KEY`). */
export declare const ResendErrorName: z.ZodEnum<{
    application_error: "application_error";
    concurrent_idempotent_requests: "concurrent_idempotent_requests";
    invalid_attachment: "invalid_attachment";
    invalid_idempotency_key: "invalid_idempotency_key";
    invalid_idempotent_request: "invalid_idempotent_request";
    invalid_parameter: "invalid_parameter";
    missing_api_key: "missing_api_key";
    missing_required_field: "missing_required_field";
    not_found: "not_found";
    rate_limit_exceeded: "rate_limit_exceeded";
    restricted_api_key: "restricted_api_key";
    service_unavailable: "service_unavailable";
    validation_error: "validation_error";
}>;
export type ResendErrorName = z.output<typeof ResendErrorName>;
/** Every Resend error body: `{ statusCode, name, message }`. */
export declare const ResendErrorBody: z.ZodObject<{
    statusCode: z.ZodNumber;
    name: z.ZodEnum<{
        application_error: "application_error";
        concurrent_idempotent_requests: "concurrent_idempotent_requests";
        invalid_attachment: "invalid_attachment";
        invalid_idempotency_key: "invalid_idempotency_key";
        invalid_idempotent_request: "invalid_idempotent_request";
        invalid_parameter: "invalid_parameter";
        missing_api_key: "missing_api_key";
        missing_required_field: "missing_required_field";
        not_found: "not_found";
        rate_limit_exceeded: "rate_limit_exceeded";
        restricted_api_key: "restricted_api_key";
        service_unavailable: "service_unavailable";
        validation_error: "validation_error";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
export type ResendErrorBody = z.output<typeof ResendErrorBody>;
