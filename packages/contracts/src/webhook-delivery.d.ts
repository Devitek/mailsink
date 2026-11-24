import { z } from 'zod';
export declare const WebhookDeliveryStatus: z.ZodEnum<{
    failed: "failed";
    pending: "pending";
    retrying: "retrying";
    succeeded: "succeeded";
}>;
export declare const ReplayMode: z.ZodEnum<{
    exact: "exact";
    resign: "resign";
}>;
export declare const WebhookDeliveryView: z.ZodObject<{
    id: z.ZodString;
    endpointId: z.ZodString;
    messageId: z.ZodNullable<z.ZodString>;
    eventId: z.ZodNullable<z.ZodString>;
    payloadFormat: z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>;
    canonicalEvent: z.ZodEnum<{
        "email.clicked": "email.clicked";
        "email.complained": "email.complained";
        "email.deferred": "email.deferred";
        "email.delivered": "email.delivered";
        "email.failed": "email.failed";
        "email.hard_bounced": "email.hard_bounced";
        "email.opened": "email.opened";
        "email.sent": "email.sent";
        "email.soft_bounced": "email.soft_bounced";
        "email.suppressed": "email.suppressed";
    }>;
    dialectEvent: z.ZodString;
    recipient: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        failed: "failed";
        pending: "pending";
        retrying: "retrying";
        succeeded: "succeeded";
    }>;
    attemptCount: z.ZodNumber;
    nextAttemptAt: z.ZodNullable<z.ZodISODateTime>;
    lastStatusCode: z.ZodNullable<z.ZodNumber>;
    replayOf: z.ZodNullable<z.ZodString>;
    replayMode: z.ZodNullable<z.ZodEnum<{
        exact: "exact";
        resign: "resign";
    }>>;
    endpointUrl: z.ZodNullable<z.ZodString>;
    durationMs: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const WebhookAttemptView: z.ZodObject<{
    id: z.ZodString;
    attemptNo: z.ZodNumber;
    requestHeaders: z.ZodRecord<z.ZodString, z.ZodString>;
    signedAt: z.ZodNullable<z.ZodNumber>;
    responseStatus: z.ZodNullable<z.ZodNumber>;
    responseBody: z.ZodNullable<z.ZodString>;
    durationMs: z.ZodNumber;
    error: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const WebhookDeliveryDetail: z.ZodObject<{
    id: z.ZodString;
    endpointId: z.ZodString;
    messageId: z.ZodNullable<z.ZodString>;
    eventId: z.ZodNullable<z.ZodString>;
    payloadFormat: z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>;
    canonicalEvent: z.ZodEnum<{
        "email.clicked": "email.clicked";
        "email.complained": "email.complained";
        "email.deferred": "email.deferred";
        "email.delivered": "email.delivered";
        "email.failed": "email.failed";
        "email.hard_bounced": "email.hard_bounced";
        "email.opened": "email.opened";
        "email.sent": "email.sent";
        "email.soft_bounced": "email.soft_bounced";
        "email.suppressed": "email.suppressed";
    }>;
    dialectEvent: z.ZodString;
    recipient: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<{
        failed: "failed";
        pending: "pending";
        retrying: "retrying";
        succeeded: "succeeded";
    }>;
    attemptCount: z.ZodNumber;
    nextAttemptAt: z.ZodNullable<z.ZodISODateTime>;
    lastStatusCode: z.ZodNullable<z.ZodNumber>;
    replayOf: z.ZodNullable<z.ZodString>;
    replayMode: z.ZodNullable<z.ZodEnum<{
        exact: "exact";
        resign: "resign";
    }>>;
    endpointUrl: z.ZodNullable<z.ZodString>;
    durationMs: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodISODateTime;
    body: z.ZodString;
    contentType: z.ZodString;
    attempts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        attemptNo: z.ZodNumber;
        requestHeaders: z.ZodRecord<z.ZodString, z.ZodString>;
        signedAt: z.ZodNullable<z.ZodNumber>;
        responseStatus: z.ZodNullable<z.ZodNumber>;
        responseBody: z.ZodNullable<z.ZodString>;
        durationMs: z.ZodNumber;
        error: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ListWebhookDeliveriesQuery: z.ZodObject<{
    endpointId: z.ZodOptional<z.ZodString>;
    payloadFormat: z.ZodOptional<z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>>;
    messageId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        failed: "failed";
        pending: "pending";
        retrying: "retrying";
        succeeded: "succeeded";
    }>>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    cursor: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
/** One page, its keyset cursor and the number of deliveries matching the filters. */
export declare const ListWebhookDeliveriesResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        endpointId: z.ZodString;
        messageId: z.ZodNullable<z.ZodString>;
        eventId: z.ZodNullable<z.ZodString>;
        payloadFormat: z.ZodEnum<{
            brevo: "brevo";
            resend: "resend";
            unified: "unified";
        }>;
        canonicalEvent: z.ZodEnum<{
            "email.clicked": "email.clicked";
            "email.complained": "email.complained";
            "email.deferred": "email.deferred";
            "email.delivered": "email.delivered";
            "email.failed": "email.failed";
            "email.hard_bounced": "email.hard_bounced";
            "email.opened": "email.opened";
            "email.sent": "email.sent";
            "email.soft_bounced": "email.soft_bounced";
            "email.suppressed": "email.suppressed";
        }>;
        dialectEvent: z.ZodString;
        recipient: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<{
            failed: "failed";
            pending: "pending";
            retrying: "retrying";
            succeeded: "succeeded";
        }>;
        attemptCount: z.ZodNumber;
        nextAttemptAt: z.ZodNullable<z.ZodISODateTime>;
        lastStatusCode: z.ZodNullable<z.ZodNumber>;
        replayOf: z.ZodNullable<z.ZodString>;
        replayMode: z.ZodNullable<z.ZodEnum<{
            exact: "exact";
            resign: "resign";
        }>>;
        endpointUrl: z.ZodNullable<z.ZodString>;
        durationMs: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodISODateTime;
    }, z.core.$strip>>;
    nextCursor: z.ZodNullable<z.ZodString>;
    total: z.ZodNumber;
}, z.core.$strip>;
export declare const ReplayRequest: z.ZodObject<{
    mode: z.ZodDefault<z.ZodEnum<{
        exact: "exact";
        resign: "resign";
    }>>;
    attemptId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WebhookDeliveryStatus = z.output<typeof WebhookDeliveryStatus>;
export type ReplayMode = z.output<typeof ReplayMode>;
export type WebhookDeliveryView = z.output<typeof WebhookDeliveryView>;
export type WebhookAttemptView = z.output<typeof WebhookAttemptView>;
export type WebhookDeliveryDetail = z.output<typeof WebhookDeliveryDetail>;
export type ListWebhookDeliveriesQuery = z.output<typeof ListWebhookDeliveriesQuery>;
export type ListWebhookDeliveriesResponse = z.output<typeof ListWebhookDeliveriesResponse>;
export type ReplayRequest = z.output<typeof ReplayRequest>;
