// Shared mocks for the lead-capture pipeline test suite. Not picked up by
// the vitest `*.test.ts` include glob.
import { vi } from "vitest";

export interface D1Call {
  sql: string;
  bind: unknown[];
}

export interface MockD1 {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      run: () => Promise<unknown>;
      all: <T = unknown>() => Promise<{ results: T[] }>;
      first: <T = unknown>() => Promise<T | null>;
    };
  };
  _calls: D1Call[];
  _allResults: unknown[];
  _firstResult: unknown;
}

/** D1 mock that records every (sql, bind) pair. */
export function makeD1Mock(initial?: { allResults?: unknown[]; firstResult?: unknown }): MockD1 {
  const calls: D1Call[] = [];
  const state = {
    allResults: initial?.allResults ?? ([] as unknown[]),
    firstResult: initial?.firstResult ?? null,
  };
  const mock: MockD1 = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => {
        calls.push({ sql, bind: args });
        return {
          run: async () => ({}),
          all: async <T = unknown>() => ({ results: state.allResults as T[] }),
          first: async <T = unknown>() => state.firstResult as T | null,
        };
      },
    }),
    _calls: calls,
    get _allResults() {
      return state.allResults;
    },
    set _allResults(v) {
      state.allResults = v;
    },
    get _firstResult() {
      return state.firstResult;
    },
    set _firstResult(v) {
      state.firstResult = v;
    },
  };
  return mock;
}

export interface MockKV {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
  _store: Map<string, string>;
}

/** KV mock backed by an in-memory Map. */
export function makeKVMock(seed?: Record<string, string>): MockKV {
  const store = new Map<string, string>(seed ? Object.entries(seed) : undefined);
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    _store: store,
  };
}

export interface MockCtx {
  waitUntil: (p: Promise<unknown>) => void;
  _promises: Promise<unknown>[];
}

/** ctx.waitUntil tracker so tests can await background work. */
export function makeCtxMock(): MockCtx {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: (p: Promise<unknown>) => {
      promises.push(p);
    },
    _promises: promises,
  };
}

/** Drains all queued waitUntil promises so async assertions are reliable. */
export async function drainWaitUntil(ctx: MockCtx): Promise<void> {
  await Promise.all(ctx._promises);
}

/** Build a fetch mock that returns a stack of responses in order. */
export function stackedFetch(responses: Array<Partial<Response> & { jsonBody?: unknown; textBody?: string }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? responses[responses.length - 1];
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: r.statusText ?? "OK",
      json: async () => r.jsonBody ?? {},
      text: async () => (r.textBody !== undefined ? r.textBody : JSON.stringify(r.jsonBody ?? {})),
    } as unknown as Response;
  });
}
