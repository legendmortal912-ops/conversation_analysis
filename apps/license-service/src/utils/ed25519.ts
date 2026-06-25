import { SignJWT, importPKCS8 } from 'jose';

/**
 * Signs a payload using Ed25519 and formats it as a JWT.
 * Requires LICENSE_PRIVATE_KEY_PEM environment variable containing the PKCS8 PEM.
 */
export async function signLicenseJwt(payload: Record<string, any>): Promise<string> {
  const pem = process.env['LICENSE_PRIVATE_KEY_PEM'];
  if (!pem) {
    throw new Error('LICENSE_PRIVATE_KEY_PEM is not configured');
  }

  const privateKey = await importPKCS8(pem, 'EdDSA');

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuedAt(payload.iat)
    .setExpirationTime(payload.exp)
    .sign(privateKey);

  return jwt;
}
