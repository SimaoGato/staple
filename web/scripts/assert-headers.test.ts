// @vitest-environment node
import { execFile } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const script = fileURLToPath(new URL('./assert-headers.sh', import.meta.url));

const SECURE_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

let server: Server | undefined;

afterEach(() => server?.close());

/** Serves the old (header-less) version for the first `staleRequests` requests, like an edge that has not yet picked up a deploy. */
async function startEdge(staleRequests: number): Promise<string> {
  let requests = 0;
  server = createServer((_req, res) => {
    requests += 1;
    res.writeHead(200, requests > staleRequests ? SECURE_HEADERS : {});
    res.end();
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function check(url: string) {
  return run('bash', [script, url], {
    env: {
      ...process.env,
      HEADER_CHECK_ATTEMPTS: '5',
      HEADER_CHECK_DELAY: '0',
    },
  });
}

describe('assert-headers.sh', () => {
  it('passes once the edge starts serving the new deploy', async () => {
    const url = await startEdge(1);
    await expect(check(url)).resolves.toBeDefined();
  });

  it('fails and names the missing headers when the edge never serves them', async () => {
    const url = await startEdge(Infinity);
    await expect(check(url)).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining(
        'MISSING on /: cross-origin-opener-policy: same-origin',
      ),
    });
  });
});
