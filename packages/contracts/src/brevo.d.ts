import { z } from 'zod';
/** Brevo caps a message version at 99 recipients and a request at 2000. */
export declare const BREVO_MAX_VERSION_RECIPIENTS = 99;
export declare const BREVO_MAX_TOTAL_RECIPIENTS = 2000;
export declare const BrevoAddress: z.ZodObject<{
    email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const BrevoAttachment: z.ZodObject<{
    content: z.ZodOptional<z.ZodBase64>;
    url: z.ZodOptional<z.ZodURL>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const BrevoMessageVersion: z.ZodObject<{
    to: z.ZodArray<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    cc: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    bcc: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    replyTo: z.ZodOptional<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    subject: z.ZodOptional<z.ZodString>;
    htmlContent: z.ZodOptional<z.ZodString>;
    textContent: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const BrevoSendRequest: z.ZodObject<{
    sender: z.ZodOptional<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    to: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    cc: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    bcc: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    replyTo: z.ZodOptional<z.ZodObject<{
        email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    subject: z.ZodOptional<z.ZodString>;
    htmlContent: z.ZodOptional<z.ZodString>;
    textContent: z.ZodOptional<z.ZodString>;
    templateId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    headers: z.ZodOptional<z.ZodPipe<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>, z.ZodTransform<{
        [k: string]: string;
    }, Record<string, string | number | boolean>>>>;
    attachment: z.ZodOptional<z.ZodArray<z.ZodObject<{
        content: z.ZodOptional<z.ZodBase64>;
        url: z.ZodOptional<z.ZodURL>;
        name: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    scheduledAt: z.ZodOptional<z.ZodISODateTime>;
    batchId: z.ZodOptional<z.ZodUUID>;
    messageVersions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        to: z.ZodArray<z.ZodObject<{
            email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        cc: z.ZodOptional<z.ZodArray<z.ZodObject<{
            email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        bcc: z.ZodOptional<z.ZodArray<z.ZodObject<{
            email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        replyTo: z.ZodOptional<z.ZodObject<{
            email: z.ZodPipe<z.ZodEmail, z.ZodTransform<string, string>>;
            name: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        subject: z.ZodOptional<z.ZodString>;
        htmlContent: z.ZodOptional<z.ZodString>;
        textContent: z.ZodOptional<z.ZodString>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/** 201: `messageId` for a single message, `messageIds` (one per version) otherwise. */
export declare const BrevoSendResponse: z.ZodUnion<readonly [z.ZodObject<{
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    messageIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>]>;
/** Brevo error codes Mailsink answers with (developers.brevo.com, « Error codes »). */
export declare const BrevoErrorCode: z.ZodEnum<{
    chaos_injected: "chaos_injected";
    document_not_found: "document_not_found";
    duplicate_parameter: "duplicate_parameter";
    duplicate_request: "duplicate_request";
    internal_error: "internal_error";
    invalid_parameter: "invalid_parameter";
    missing_parameter: "missing_parameter";
    out_of_range: "out_of_range";
    permission_denied: "permission_denied";
    too_many_requests: "too_many_requests";
    unauthorized: "unauthorized";
}>;
export declare const BrevoError: z.ZodObject<{
    code: z.ZodEnum<{
        chaos_injected: "chaos_injected";
        document_not_found: "document_not_found";
        duplicate_parameter: "duplicate_parameter";
        duplicate_request: "duplicate_request";
        internal_error: "internal_error";
        invalid_parameter: "invalid_parameter";
        missing_parameter: "missing_parameter";
        out_of_range: "out_of_range";
        permission_denied: "permission_denied";
        too_many_requests: "too_many_requests";
        unauthorized: "unauthorized";
    }>;
    message: z.ZodString;
}, z.core.$strip>;
export type BrevoAddress = z.output<typeof BrevoAddress>;
export type BrevoAttachment = z.output<typeof BrevoAttachment>;
export type BrevoMessageVersion = z.output<typeof BrevoMessageVersion>;
export type BrevoSendRequest = z.output<typeof BrevoSendRequest>;
export type BrevoSendRequestInput = z.input<typeof BrevoSendRequest>;
export type BrevoSendResponse = z.output<typeof BrevoSendResponse>;
export type BrevoErrorCode = z.output<typeof BrevoErrorCode>;
export type BrevoError = z.output<typeof BrevoError>;
