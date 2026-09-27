import type { IncomingMessage, ServerResponse } from 'node:http'

export function normalizePrefix(value: string): string {
  const prefix = String(value || '').trim()
  if (prefix === '' || prefix === '/') return ''
  return '/' + prefix.replace(/^\/+|\/+$/g, '')
}

export function rewritePath(rawUrl: string | undefined, gatewayPrefix: string): string {
  if (!rawUrl || rawUrl === '*') return rawUrl || '/'

  let parsed: URL
  try {
    parsed = new URL(rawUrl, 'http://dsh-gateway.invalid')
  } catch {
    return rawUrl
  }

  const pathname = parsed.pathname || '/'
  if (gatewayPrefix && (pathname === gatewayPrefix || pathname === gatewayPrefix + '/')) {
    parsed.pathname = '/'
  } else if (gatewayPrefix && pathname.startsWith(gatewayPrefix + '/')) {
    parsed.pathname = pathname.slice(gatewayPrefix.length) || '/'
  }

  return (parsed.pathname || '/') + parsed.search
}

export function addGatewayPrefix(path: string, gatewayPrefix: string): string {
  if (!gatewayPrefix || !path || !path.startsWith('/') || path.startsWith('//')) return path
  if (path === gatewayPrefix || path.startsWith(gatewayPrefix + '/')) return path
  return gatewayPrefix + path
}

export function rewriteLocation(value: unknown, gatewayPrefix: string): unknown {
  if (typeof value !== 'string') return value
  return value.startsWith('/') && !value.startsWith('//') ? addGatewayPrefix(value, gatewayPrefix) : value
}

/**
 * Redirect the bare gateway prefix to its directory form.
 *
 * DSH answers a tokenized index request with the relative `Location: ./`, so a
 * document URL that lacks the trailing slash resolves it against the *parent*
 * directory and the browser leaves the app. Canonicalizing the entry once makes
 * every relative redirect resolve inside the prefix.
 */
export function canonicalPrefixTarget(rawUrl: string | undefined, method: string | undefined, gatewayPrefix: string): string | undefined {
  if (gatewayPrefix === '' || method !== 'GET' || rawUrl === undefined || rawUrl === '' || rawUrl === '*') return undefined
  const path = rawUrl.split('?', 1)[0] ?? ''
  return path === gatewayPrefix ? gatewayPrefix + '/' + rawUrl.slice(path.length) : undefined
}

export function pathRewriteMiddleware(gatewayPrefix: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const canonical = canonicalPrefixTarget(req.url, req.method, gatewayPrefix)
    if (canonical !== undefined) {
      res.writeHead(308, { location: canonical })
      res.end()
      return
    }
    if (req.url) {
      req.url = rewritePath(req.url, gatewayPrefix)
    }
    next()
  }
}
