export { authenticate, type SmtpUser } from './auth'
export {
  CREDENTIAL_CACHE_SIZE,
  type CredentialCache,
  createCredentialCache,
} from './credential-cache'
export {
  type SmtpLogger,
  type SmtpServerHandle,
  type SmtpServerOptions,
  startSmtpServer,
} from './server'
export {
  noopRecordSmtpSession,
  type RecordSmtpSession,
  type SmtpSessionOutcome,
  type SmtpSessionRecord,
} from './session-record'
export { readTlsFiles, type SmtpTlsFiles } from './tls'
export { MAX_LINE_LENGTH, MAX_TRANSCRIPT_LINES } from './transcript'
