import { z } from 'zod';
import { type ConnectionKind } from './status';
export declare const PayloadFormat: z.ZodEnum<{
    brevo: "brevo";
    resend: "resend";
    unified: "unified";
}>;
export declare const BrevoAuth: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"none">;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"bearer">;
    token: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"basic">;
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>], "type">;
export declare const CustomHeader: z.ZodObject<{
    key: z.ZodString;
    value: z.ZodString;
}, z.core.$strip>;
export declare const WebhookEndpointInput: z.ZodObject<{
    connectionId: z.ZodNullable<z.ZodString>;
    url: z.ZodURL;
    payloadFormat: z.ZodOptional<z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>>;
    events: z.ZodArray<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    brevoAuth: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"bearer">;
        token: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"basic">;
        username: z.ZodString;
        password: z.ZodString;
    }, z.core.$strip>], "type">>;
    customHeaders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/** PATCH: every field optional; `rotateSecret: true` issues a new `whsec_` secret. */
export declare const WebhookEndpointPatch: z.ZodObject<{
    connectionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodURL>;
    payloadFormat: z.ZodOptional<z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>>;
    events: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    brevoAuth: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"none">;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"bearer">;
        token: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"basic">;
        username: z.ZodString;
        password: z.ZodString;
    }, z.core.$strip>], "type">>;
    customHeaders: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    rotateSecret: z.ZodOptional<z.ZodLiteral<true>>;
}, z.core.$strip>;
/** Creation default (D20): connection kind for resend/brevo, else unified. */
export declare function defaultPayloadFormat(scope: {
    kind: ConnectionKind;
} | null): PayloadFormat;
export declare const WebhookEndpointView: z.ZodObject<{
    id: z.ZodString;
    numericId: z.ZodNumber;
    connectionId: z.ZodNullable<z.ZodString>;
    url: z.ZodString;
    payloadFormat: z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>;
    events: z.ZodArray<z.ZodString>;
    canonicalEvents: z.ZodArray<z.ZodEnum<{
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
    }>>;
    unsupportedEvents: z.ZodArray<z.ZodEnum<{
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
    }>>;
    description: z.ZodNullable<z.ZodString>;
    brevoAuth: z.ZodObject<{
        type: z.ZodEnum<{
            basic: "basic";
            bearer: "bearer";
            none: "none";
        }>;
        username: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    customHeaders: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    secretPreview: z.ZodNullable<z.ZodString>;
    enabled: z.ZodBoolean;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
}, z.core.$strip>;
/** Creation and rotation answer the clear secret once (unified and resend formats). */
export declare const WebhookEndpointWithSecret: z.ZodObject<{
    id: z.ZodString;
    numericId: z.ZodNumber;
    connectionId: z.ZodNullable<z.ZodString>;
    url: z.ZodString;
    payloadFormat: z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>;
    events: z.ZodArray<z.ZodString>;
    canonicalEvents: z.ZodArray<z.ZodEnum<{
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
    }>>;
    unsupportedEvents: z.ZodArray<z.ZodEnum<{
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
    }>>;
    description: z.ZodNullable<z.ZodString>;
    brevoAuth: z.ZodObject<{
        type: z.ZodEnum<{
            basic: "basic";
            bearer: "bearer";
            none: "none";
        }>;
        username: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    customHeaders: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    secretPreview: z.ZodNullable<z.ZodString>;
    enabled: z.ZodBoolean;
    createdAt: z.ZodISODateTime;
    updatedAt: z.ZodISODateTime;
    secret: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const ListWebhookEndpointsQuery: z.ZodObject<{
    connectionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const ListWebhookEndpointsResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        numericId: z.ZodNumber;
        connectionId: z.ZodNullable<z.ZodString>;
        url: z.ZodString;
        payloadFormat: z.ZodEnum<{
            brevo: "brevo";
            resend: "resend";
            unified: "unified";
        }>;
        events: z.ZodArray<z.ZodString>;
        canonicalEvents: z.ZodArray<z.ZodEnum<{
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
        }>>;
        unsupportedEvents: z.ZodArray<z.ZodEnum<{
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
        }>>;
        description: z.ZodNullable<z.ZodString>;
        brevoAuth: z.ZodObject<{
            type: z.ZodEnum<{
                basic: "basic";
                bearer: "bearer";
                none: "none";
            }>;
            username: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        customHeaders: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            value: z.ZodString;
        }, z.core.$strip>>;
        secretPreview: z.ZodNullable<z.ZodString>;
        enabled: z.ZodBoolean;
        createdAt: z.ZodISODateTime;
        updatedAt: z.ZodISODateTime;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const WebhookPreviewRequest: z.ZodObject<{
    payloadFormat: z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        unified: "unified";
    }>;
    event: z.ZodString;
    connectionId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const WebhookPreviewResponse: z.ZodObject<{
    body: z.ZodString;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
}, z.core.$strip>;
/** `POST /capture/webhooks/:id/test`: one signed sample event (default email.delivered). */
export declare const WebhookTestRequest: z.ZodObject<{
    event: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PayloadFormat = z.output<typeof PayloadFormat>;
export type BrevoAuth = z.output<typeof BrevoAuth>;
export type CustomHeader = z.output<typeof CustomHeader>;
export type WebhookEndpointInput = z.output<typeof WebhookEndpointInput>;
export type WebhookEndpointPatch = z.output<typeof WebhookEndpointPatch>;
export type WebhookEndpointView = z.output<typeof WebhookEndpointView>;
export type WebhookEndpointWithSecret = z.output<typeof WebhookEndpointWithSecret>;
export type ListWebhookEndpointsQuery = z.output<typeof ListWebhookEndpointsQuery>;
export type WebhookPreviewRequest = z.output<typeof WebhookPreviewRequest>;
export type WebhookPreviewResponse = z.output<typeof WebhookPreviewResponse>;
export type WebhookTestRequest = z.output<typeof WebhookTestRequest>;
