// Request and response types of the SDK, derived from the Zod contracts of the server
// (`@mailsink/contracts`, bundled at build): `z.input` for what the SDK sends, `z.output`
// for what it reads back.
import type * as C from '@mailsink/contracts'
import type { z } from 'zod'
import type { QueryOf } from './query'

type In<S extends z.ZodType> = z.input<S>
type Out<S extends z.ZodType> = z.output<S>
type Query<S extends z.ZodType> = QueryOf<Out<S>>

// Admin
export type CreateWorkspaceInput = In<typeof C.CreateWorkspaceRequest>
export type CreateWorkspaceResult = Out<typeof C.CreateWorkspaceResponse>
export type ListWorkspacesParams = Query<typeof C.ListWorkspacesQuery>
export type WorkspacePage = Out<typeof C.ListWorkspacesResponse>
export type Workspace = Out<typeof C.WorkspaceView>
export type WorkspaceDetail = Out<typeof C.WorkspaceDetail>
export type UpdateWorkspaceInput = In<typeof C.UpdateWorkspaceRequest>
export type RotatedWorkspaceKey = Out<typeof C.RotatedWorkspaceKey>
export type ConnectionInput = In<typeof C.ConnectionInput>
export type Connection = Out<typeof C.ConnectionView>
export type CreatedConnection = Out<typeof C.CreatedConnection>
export type UpdateConnectionInput = In<typeof C.UpdateConnectionRequest>
export type TemplateInput = In<typeof C.TemplateInput>
export type TemplatePatch = In<typeof C.TemplatePatch>
export type Template = Out<typeof C.TemplateView>
export type ListTemplatesParams = Query<typeof C.ListTemplatesQuery>
export type TemplatePage = Out<typeof C.ListTemplatesResponse>

// Capture
export type ListMessagesParams = Omit<Query<typeof C.ListMessagesQuery>, 'wait' | 'timeout'>
export type MessagePage = Out<typeof C.ListMessagesResponse>
export type MessageSummary = Out<typeof C.MessageSummary>
export type MessageDetail = Out<typeof C.MessageDetail>
export type MessageEvent = Out<typeof C.MessageEventView>
export type TriggerEventInput = In<typeof C.TriggerEventRequest>
export type TriggerEventResult = Out<typeof C.TriggerEventResponse>
export type PurgeParams = Query<typeof C.PurgeQuery>
export type PurgeResult = Out<typeof C.PurgeResponse>
export type SeedDemoInput = In<typeof C.SeedDemoRequest>
export type SeedDemoResult = Out<typeof C.SeedDemoResponse>
export type DeliveryStatus = Out<typeof C.DeliveryStatus>

// Overrides and suppressions
export type OverrideConfig = In<typeof C.OverrideConfig>
export type ActivateOverrideInput = In<typeof C.ActivateOverrideRequest>
export type OverrideState = Out<typeof C.OverrideState>
export type ListSuppressionsParams = Query<typeof C.ListSuppressionsQuery>
export type SuppressionPage = Out<typeof C.ListSuppressionsResponse>
export type DeleteSuppressionsResult = Out<typeof C.DeleteSuppressionsResponse>

// Webhooks
export type WebhookEndpointInput = In<typeof C.WebhookEndpointInput>
export type WebhookEndpointPatch = In<typeof C.WebhookEndpointPatch>
export type WebhookEndpoint = Out<typeof C.WebhookEndpointView>
export type WebhookEndpointWithSecret = Out<typeof C.WebhookEndpointWithSecret>
export type ListWebhookEndpointsParams = Query<typeof C.ListWebhookEndpointsQuery>
export type WebhookEndpointPage = Out<typeof C.ListWebhookEndpointsResponse>
export type WebhookPreviewInput = In<typeof C.WebhookPreviewRequest>
export type WebhookPreview = Out<typeof C.WebhookPreviewResponse>
export type WebhookTestInput = In<typeof C.WebhookTestRequest>
export type ListWebhookDeliveriesParams = Query<typeof C.ListWebhookDeliveriesQuery>
export type WebhookDeliveryPage = Out<typeof C.ListWebhookDeliveriesResponse>
export type WebhookDelivery = Out<typeof C.WebhookDeliveryView>
export type WebhookDeliveryDetail = Out<typeof C.WebhookDeliveryDetail>
export type ReplayInput = In<typeof C.ReplayRequest>

// Logs
export type ListApiLogsParams = Query<typeof C.ListApiLogsQuery>
export type ApiLogPage = Out<typeof C.ListApiLogsResponse>
export type ApiLogDetail = Out<typeof C.ApiLogDetail>
export type ListSmtpSessionsParams = Query<typeof C.ListSmtpSessionsQuery>
export type SmtpSessionPage = Out<typeof C.ListSmtpSessionsResponse>
export type SmtpSessionDetail = Out<typeof C.SmtpSessionDetail>

// Stream
export type StreamEvent = Out<typeof C.StreamEvent>
export type StreamEventType = Out<typeof C.StreamEventType>
