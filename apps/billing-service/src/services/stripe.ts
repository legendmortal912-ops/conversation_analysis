import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_mock';
const isMockMode = STRIPE_SECRET_KEY.startsWith('sk_test_mock');

if (isMockMode) {
  logger.warn('Running Stripe in MOCK mode (STRIPE_SECRET_KEY starts with sk_test_mock)');
}

// In mock mode, we create a proxy that resolves to fake data
// so development can proceed without a real Stripe account.
export const stripe = isMockMode
  ? (new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'checkout') {
          return {
            sessions: {
              create: async (params: any) => ({
                id: 'cs_test_mock',
                url: `${process.env['FRONTEND_URL']}/mock-checkout?session_id=cs_test_mock&client_reference_id=${params.client_reference_id}`,
              }),
            },
          };
        }
        if (prop === 'billingPortal') {
          return {
            sessions: {
              create: async () => ({
                url: `${process.env['FRONTEND_URL']}/settings/billing`,
              }),
            },
          };
        }
        if (prop === 'webhooks') {
          return {
            constructEvent: (payload: any) => JSON.parse(payload.toString()),
          };
        }
        return async () => ({});
      },
    }) as unknown as Stripe)
  : new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-04-10', // Ensure stable API version
      appInfo: {
        name: 'ConvoGuard',
        version: '1.0.0',
      },
    });
