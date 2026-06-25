import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// In a real system, this would be persisted in the DB
let LATEST_MODEL_VERSION = {
  version: "1.4.2",
  download_url: "https://cdn.convoguard.com/models/v1.4.2.enc",
  sha256: "placeholder-hash",
  signature: "placeholder-signature"
};

export async function modelVersionRoutes(app: FastifyInstance): Promise<void> {
  // Admin endpoint to publish a new model
  app.post('/publish', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    LATEST_MODEL_VERSION = {
      version: body.version,
      download_url: body.download_url,
      sha256: body.sha256,
      signature: body.signature,
    };
    return { status: 'published', latest: LATEST_MODEL_VERSION };
  });

  // Telemetry Heartbeat endpoint (Flaws 4, 6, 8, 9)
  app.post('/telemetry', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      org_hash: string;
      turns_processed: number;
      period_start: string;
      period_end: string;
      merkle_root: string;
      chain_signature: string;
      current_model_version: string;
    };

    // 1. Verify chain_signature (Flaw 4)
    // In a real system, we'd verify the Ed25519 signature of the merkle_root
    // using the client certificate's public key.
    
    // 2. Deduplicate based on merkle_root (Flaw 8 - catch-up sync)
    // We'd check if this merkle_root was already recorded.
    
    // 3. Log usage anonymously (Flaw 9)
    // We only log the org_hash, not the IP address or raw api_key.
    request.log.info({
      event: 'TELEMETRY_HEARTBEAT',
      org_hash: body.org_hash,
      turns_processed: body.turns_processed,
      merkle_root: body.merkle_root
    });

    // 4. Return heartbeat response, optionally with a model update (Flaw 6)
    const responsePayload: any = {
      status: 'ok',
    };

    if (body.current_model_version !== LATEST_MODEL_VERSION.version) {
      responsePayload.model_update = LATEST_MODEL_VERSION;
    }

    // 5. In a complete flow, we'd also trigger a renewal of the license here
    // and include it in the response: responsePayload.license = newLicenseJwt;

    return reply.status(200).send(responsePayload);
  });
}
