/**
 * The demo for the movies: the stand-in HubSpot and Supertext APIs (real translations of the sample
 * account, tests/standin/samples.json) and the app in-process, set up like tests/docs/screenshots.ts.
 * Nothing reaches HubSpot, Supertext or the Commando Center.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../../src/app.js';
import { loadConfig } from '../../../src/config.js';
import { MemoryStore } from '../../../src/store/store.js';
import { createHubSpotStandin } from '../../standin/hubspot.js';
import { createSupertextStandin } from '../../standin/supertext.js';

const listen = (fetch: (request: Request) => Response | Promise<Response>, port = 0) =>
  new Promise<string>((resolve) => {
    const server = serve({ fetch, port, hostname: '127.0.0.1' }, () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });

/**
 * Starts the stand-ins and the app on MOVIE_PORT (default 8797). `statusDelayMs` holds every status
 * answer of the Supertext stand-in, so the waiting state is visible (the movie cuts the wait).
 */
export async function startDemo({ statusDelayMs = 0 } = {}): Promise<string> {
  const hubspot = createHubSpotStandin();
  const supertext = createSupertextStandin();
  const supertextHandle = async (request: Request) => {
    if (statusDelayMs && /\/status$/.test(new URL(request.url).pathname)) await new Promise((r) => setTimeout(r, statusDelayMs));
    return supertext.handle(request);
  };
  const hubspotUrl = await listen((request) => hubspot.handle(request));
  const supertextUrl = await listen(supertextHandle);
  const reviewUrl = await listen(supertextHandle);
  const port = Number(process.env.MOVIE_PORT || 8797);
  const appUrl = `http://127.0.0.1:${port}`;
  const app = createApp({
    config: loadConfig({
      APP_URL: appUrl,
      HUBSPOT_CLIENT_ID: 'movie',
      HUBSPOT_CLIENT_SECRET: 'movie-secret',
      HUBSPOT_APP_BASE: hubspotUrl,
      HUBSPOT_API_BASE: hubspotUrl,
      SUPERTEXT_API_ENDPOINT: `${supertextUrl}/v1/`,
      SUPERTEXT_REVIEW_URL: `${reviewUrl}/v1/`,
      SUPERTEXT_REPORT_URL: `${supertextUrl}/report`,
    }),
    store: new MemoryStore(),
  });
  app.use('/static/*', serveStatic({ root: new URL('../../../public/', import.meta.url).pathname, rewriteRequestPath: (path) => path.replace(/^\/static/, '') }));
  await listen(app.fetch, port);
  return appUrl;
}
