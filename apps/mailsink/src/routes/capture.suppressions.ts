import { createFileRoute } from '@tanstack/react-router'
import { deleteSuppressionsApi, listSuppressionsApi } from '../http/capture/suppressions'

export const Route = createFileRoute('/capture/suppressions')({
  server: { handlers: { GET: listSuppressionsApi, DELETE: deleteSuppressionsApi } },
})
