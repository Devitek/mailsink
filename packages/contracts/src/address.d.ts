import { z } from 'zod';
export type ParsedAddress = {
    email: string;
    name?: string;
};
/**
 * Parses "jane@x.io", "Jane <jane@x.io>" or "\"Doe, Jane\" <jane@x.io>".
 * Returns null when the e-mail part is invalid. The e-mail is lower-cased.
 */
export declare function parseAddress(input: string): ParsedAddress | null;
/** "Jane <jane@x.io>" | "jane@x.io" | { email, name? } -> { email, name? } */
export declare const Address: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>, z.ZodTransform<ParsedAddress, string | {
    email: string;
    name?: string | undefined;
}>>;
/** One address or an array of addresses, always output as an array. */
export declare const AddressList: z.ZodPipe<z.ZodUnion<readonly [z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>, z.ZodTransform<ParsedAddress, string | {
    email: string;
    name?: string | undefined;
}>>, z.ZodArray<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    email: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>, z.ZodTransform<ParsedAddress, string | {
    email: string;
    name?: string | undefined;
}>>>]>, z.ZodTransform<ParsedAddress[], ParsedAddress[] | ParsedAddress>>;
/** Address as returned by the API (keys always present). */
export declare const AddressOut: z.ZodObject<{
    email: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Address = z.output<typeof Address>;
export type AddressOut = z.output<typeof AddressOut>;
