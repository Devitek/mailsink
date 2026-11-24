import { z } from 'zod';
export declare const UnifiedWebhookPayload: z.ZodObject<{
    id: z.ZodString;
    event: z.ZodEnum<{
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
    occurredAt: z.ZodISODateTime;
    workspaceId: z.ZodString;
    connectionId: z.ZodNullable<z.ZodString>;
    connectionKind: z.ZodNullable<z.ZodEnum<{
        brevo: "brevo";
        resend: "resend";
        smtp: "smtp";
    }>>;
    messageId: z.ZodString;
    providerMessageId: z.ZodString;
    recipient: z.ZodNullable<z.ZodString>;
    from: z.ZodString;
    to: z.ZodArray<z.ZodString>;
    subject: z.ZodString;
    tags: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, z.core.$strip>>;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    detail: z.ZodObject<{
        reason: z.ZodOptional<z.ZodString>;
        smtpCode: z.ZodOptional<z.ZodNumber>;
        url: z.ZodOptional<z.ZodString>;
        userAgent: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const ResendWebhookPayload: z.ZodObject<{
    type: z.ZodEnum<{
        "email.bounced": "email.bounced";
        "email.clicked": "email.clicked";
        "email.complained": "email.complained";
        "email.delivered": "email.delivered";
        "email.delivery_delayed": "email.delivery_delayed";
        "email.failed": "email.failed";
        "email.opened": "email.opened";
        "email.sent": "email.sent";
    }>;
    created_at: z.ZodISODateTime;
    data: z.ZodObject<{
        email_id: z.ZodString;
        from: z.ZodString;
        to: z.ZodArray<z.ZodString>;
        subject: z.ZodString;
        created_at: z.ZodISODateTime;
        tags: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        bounce: z.ZodOptional<z.ZodObject<{
            message: z.ZodString;
            type: z.ZodLiteral<"Permanent">;
            subType: z.ZodString;
        }, z.core.$strip>>;
        click: z.ZodOptional<z.ZodObject<{
            link: z.ZodString;
            ipAddress: z.ZodString;
            userAgent: z.ZodString;
            timestamp: z.ZodISODateTime;
        }, z.core.$strip>>;
        failed: z.ZodOptional<z.ZodObject<{
            reason: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const BrevoWebhookPayload: z.ZodObject<{
    event: z.ZodEnum<{
        blocked: "blocked";
        click: "click";
        deferred: "deferred";
        delivered: "delivered";
        hard_bounce: "hard_bounce";
        opened: "opened";
        request: "request";
        soft_bounce: "soft_bounce";
        spam: "spam";
    }>;
    email: z.ZodString;
    id: z.ZodNumber;
    date: z.ZodString;
    ts: z.ZodNumber;
    ts_event: z.ZodNumber;
    ts_epoch: z.ZodNumber;
    'message-id': z.ZodString;
    subject: z.ZodString;
    tag: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    template_id: z.ZodOptional<z.ZodNumber>;
    'X-Mailin-custom': z.ZodOptional<z.ZodString>;
    link: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodEnum<{
        API: "API";
        SMTP: "SMTP";
    }>>;
}, z.core.$strip>;
export type UnifiedWebhookPayload = z.output<typeof UnifiedWebhookPayload>;
export type ResendWebhookPayload = z.output<typeof ResendWebhookPayload>;
export type BrevoWebhookPayload = z.output<typeof BrevoWebhookPayload>;
