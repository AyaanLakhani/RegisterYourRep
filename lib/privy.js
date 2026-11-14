// lib/privy.js
// Server-side verification of Privy access tokens.
//
// Tokens are checked against Privy's public signing keys (JWKS), so no app
// secret is needed — only the public app id. The SDK checks the signature,
// issuer ("privy.io"), audience (our app id) and expiry.
import { verifyAccessToken } from '@privy-io/node'
import { createRemoteJWKSet } from 'jose'

const PRIVY_API_URL = 'https://api.privy.io'

// Cached per serverless instance; jose caches the fetched keys internally.
let jwks = null

function getAppId() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  if (!appId) throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not configured')
  return appId
}

function getJwks(appId) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${PRIVY_API_URL}/v1/apps/${appId}/jwks.json`), {
      cacheMaxAge: 60 * 60 * 1000,     // re-fetch keys at most hourly
      cooldownDuration: 10 * 60 * 1000,
    })
  }
  return jwks
}

/**
 * Verifies a Privy access token and returns the Privy user id (DID).
 * Throws if the token is forged, expired, or issued for another app.
 */
export async function verifyPrivyToken(token) {
  const appId = getAppId()
  const claims = await verifyAccessToken({
    access_token: token,
    app_id: appId,
    verification_key: getJwks(appId),
  })
  return claims.user_id
}
