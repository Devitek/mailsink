import { z } from 'zod';
export declare const DemoLocale: z.ZodEnum<{
    en: "en";
    fr: "fr";
}>;
export declare const SeedDemoRequest: z.ZodObject<{
    locale: z.ZodDefault<z.ZodEnum<{
        en: "en";
        fr: "fr";
    }>>;
}, z.core.$strip>;
export declare const SeedDemoResponse: z.ZodObject<{
    count: z.ZodNumber;
    messageIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type DemoLocale = z.output<typeof DemoLocale>;
export type SeedDemoRequest = z.output<typeof SeedDemoRequest>;
export type SeedDemoResponse = z.output<typeof SeedDemoResponse>;
