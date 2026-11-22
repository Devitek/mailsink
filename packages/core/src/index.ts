export { hashApiKey, secretsEqual } from './crypto'
export { DomainError, type DomainErrorOptions, ERROR_STATUS, isDomainError } from './errors'
export { type BackoffOptions, backoffSeconds } from './jobs/backoff'
export { type SimulateDeliveryPayload, simulateDeliveryHandler } from './jobs/handlers/simulate'
export {
  createJobRunner,
  type JobContext,
  type JobHandler,
  type JobHandlers,
  type JobRunner,
  type JobRunnerOptions,
  PermanentJobError,
} from './jobs/queue'
export { startWorker, type Worker, type WorkerOptions } from './jobs/worker'
export { type RetentionReport, retentionTotal, runRetention } from './retention/run'
export { type RetentionSchedulerOptions, startRetentionScheduler } from './retention/scheduler'
export { aggregateStatus } from './simulation/aggregate'
export {
  baselinePlanner,
  type DeliveryPlanner,
  type PlanInput,
  type RecipientOutcome,
} from './simulation/planner'
export {
  type RecipientTransition,
  type SimulateDeliveryOptions,
  type SimulationResult,
  simulateDelivery,
} from './simulation/simulate-delivery'
