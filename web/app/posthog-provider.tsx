'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

/**
 * Init PostHog cookieless. Solo mount-side; SSR no toca esto.
 *
 * Config privacy-first:
 *  - `persistence: 'memory'` → distinct_id efímero por tab, sin cookies.
 *  - `ip: false` + anonymize IPs server-side → no PII.
 *  - autocapture/recording/pageview OFF → solo eventos manuales explícitos.
 *  - `respect_dnt` → si el browser manda Do-Not-Track, no trackea.
 *
 * Si falta NEXT_PUBLIC_POSTHOG_KEY (dev local sin .env), no inicializa
 * pero el wrapper de `lib/analytics.ts` sigue siendo no-op safe.
 */
export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    if (!key) return;

    posthog.init(key, {
      api_host: host,
      persistence: 'memory',
      disable_session_recording: true,
      disable_surveys: true,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
      ip: false,
      respect_dnt: true,
      advanced_disable_decide: true,
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.debug();
      }
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
