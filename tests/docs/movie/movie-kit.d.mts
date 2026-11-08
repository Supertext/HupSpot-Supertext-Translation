// Types for the shared Supertext movie kit (movie-kit.mjs), for this repo's TypeScript movie scripts.
import type { Locator, Page } from 'playwright';

export class MovieKit {
  static start(page: Page, options: { workDir: string; assets: string; voiceCache?: string }): Promise<MovieKit>;
  caption(text: string, ms?: number): Promise<void>;
  moveTo(locator: Locator): Promise<void>;
  click(locator: Locator, options?: Parameters<Locator['click']>[0]): Promise<void>;
  type(locator: Locator, text: string): Promise<void>;
  hold(ms: number): Promise<void>;
  pause(): void;
  resume(): void;
  say(text: string, options?: { caption?: string; during?: () => unknown; after?: number }): Promise<void>;
  terminal(options: { title?: string; lines: ({ cmd: string } | { out: string; wait?: number })[] }): Promise<void>;
  finish(
    out: string,
    options: { system: string; repo: string; gif?: string; introLine?: string; outroLine?: string; kind?: 'demo' | 'install' },
  ): Promise<void>;
}
