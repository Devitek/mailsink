import rootPackage from '../../../package.json' with { type: 'json' }

/**
 * Release version of Mailsink, read from one place: the `version` of the root
 * `package.json`, bumped at release (D181). The MCP server (`serverInfo`) and
 * the instance block of the UI show it; workspace packages stay private at 0.0.0.
 */
export const MAILSINK_VERSION: string = rootPackage.version
