import * as C from '@mailsink/contracts'
import { seg, type Transport } from '../http'
import type { QueryValue } from '../query'
import type {
  ListWebhookDeliveriesParams,
  ListWebhookEndpointsParams,
  ReplayInput,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookDeliveryPage,
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEndpointPage,
  WebhookEndpointPatch,
  WebhookEndpointWithSecret,
  WebhookPreview,
  WebhookPreviewInput,
  WebhookTestInput,
} from '../types'

/** `/capture/webhooks`: endpoints, the delivery log and replays. */
export function webhooksApi(t: Transport) {
  const path = (id: string, suffix = '') => `/capture/webhooks/${seg(id)}${suffix}`
  const deliveryPath = (id: string, suffix = '') =>
    `/capture/webhooks/deliveries/${seg(id)}${suffix}`
  return {
    /** Endpoints of a connection scope and of the workspace scope, oldest first. */
    list: (params: ListWebhookEndpointsParams = {}) =>
      t.json<WebhookEndpointPage>({
        method: 'GET',
        path: '/capture/webhooks',
        auth: 'workspace',
        query: params as Record<string, QueryValue>,
        schema: C.ListWebhookEndpointsResponse,
      }),
    /** Creates an endpoint; its signing secret is answered once. */
    create: (input: WebhookEndpointInput) =>
      t.json<WebhookEndpointWithSecret>({
        method: 'POST',
        path: '/capture/webhooks',
        auth: 'workspace',
        body: input,
        schema: C.WebhookEndpointWithSecret,
      }),
    get: (id: string) =>
      t.json<WebhookEndpoint>({
        method: 'GET',
        path: path(id),
        auth: 'workspace',
        schema: C.WebhookEndpointView,
      }),
    /** `secret` is set when one was issued (`rotateSecret: true`, format change). */
    update: (id: string, patch: WebhookEndpointPatch) =>
      t.json<WebhookEndpointWithSecret>({
        method: 'PATCH',
        path: path(id),
        auth: 'workspace',
        body: patch,
        schema: C.WebhookEndpointWithSecret,
      }),
    /** Deletes the endpoint and its deliveries. */
    delete: (id: string) =>
      t.json<{ id: string }>({ method: 'DELETE', path: path(id), auth: 'workspace' }),
    /** Body and headers the real formatter would send, secrets masked. */
    preview: (input: WebhookPreviewInput) =>
      t.json<WebhookPreview>({
        method: 'POST',
        path: '/capture/webhooks/preview',
        auth: 'workspace',
        body: input,
        schema: C.WebhookPreviewResponse,
      }),
    /** Sends one signed sample event (default `email.delivered`) to the endpoint now. */
    test: (id: string, input: WebhookTestInput = {}) =>
      t.json<WebhookDeliveryDetail>({
        method: 'POST',
        path: path(id, '/test'),
        auth: 'workspace',
        body: input,
        schema: C.WebhookDeliveryDetail,
      }),
    deliveries: {
      /** Newest first, filtered by endpoint, format, message or status. */
      list: (params: ListWebhookDeliveriesParams = {}) =>
        t.json<WebhookDeliveryPage>({
          method: 'GET',
          path: '/capture/webhooks/deliveries',
          auth: 'workspace',
          query: params as Record<string, QueryValue>,
          schema: C.ListWebhookDeliveriesResponse,
        }),
      /** A delivery with every attempt and its exact headers. */
      get: (id: string) =>
        t.json<WebhookDeliveryDetail>({
          method: 'GET',
          path: deliveryPath(id),
          auth: 'workspace',
          schema: C.WebhookDeliveryDetail,
        }),
      /** Queues a replay (`exact` headers or `resign`), answered pending. */
      replay: (id: string, input: ReplayInput = {}) =>
        t.json<WebhookDelivery>({
          method: 'POST',
          path: deliveryPath(id, '/replay'),
          auth: 'workspace',
          body: input,
          schema: C.WebhookDeliveryView,
        }),
    },
  }
}

export type WebhooksApi = ReturnType<typeof webhooksApi>
