'use client';

import { useSyncExternalStore } from 'react';

import { isCryptoSupported } from '@/lib/crypto/core';

/**
 * Browser-only facts, read during render instead of in an effect.
 *
 * Crypto support exists only on the client, so the server renders a neutral
 * placeholder and the client corrects it after hydration.
 * `useSyncExternalStore` is the supported way to do that: it returns the
 * server snapshot during SSR and the real value in the browser, without a
 * setState-in-effect round trip.
 */

/** Support cannot change during the life of the page, so nothing subscribes. */
const noSubscription = () => () => undefined;

/** True when the browser provides the Web Crypto APIs ShredNote needs. */
export function useCryptoSupport(): boolean {
  // Optimistic on the server: assume support and let the client correct it,
  // so a supported browser never flashes an error state.
  return useSyncExternalStore(noSubscription, isCryptoSupported, () => true);
}
