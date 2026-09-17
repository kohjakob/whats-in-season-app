import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PRODUCE_DIR = join(__dirname, 'data', 'produce');
const PRODUCE_ID = 'virtual:produce';

/**
 * All produce records as one module. In dev this is a single request instead of 92 JSON imports
 * under /data/, one of which ad blockers were found to block, which left the page blank.
 */
function produce(): Plugin {
  const VIRTUAL = `\0${PRODUCE_ID}`;
  return {
    name: 'produce-season-produce',
    resolveId(id) {
      return id === PRODUCE_ID ? VIRTUAL : undefined;
    },
    load(id) {
      if (id !== VIRTUAL) return undefined;
      const records = readdirSync(PRODUCE_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(PRODUCE_DIR, f), 'utf8')) as unknown);
      return `export default ${JSON.stringify(records)};`;
    },
    configureServer(server) {
      // Watch the records ourselves. addWatchFile() would register them as imports of the
      // virtual module and Vite then tries to resolve them, which fails for a directory.
      server.watcher.add(PRODUCE_DIR);
      const bust = (file: string) => {
        if (!file.startsWith(PRODUCE_DIR)) return;
        const mod = server.moduleGraph.getModuleById(VIRTUAL);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', bust);
      server.watcher.on('change', bust);
      server.watcher.on('unlink', bust);
    },
  };
}

/** Serve /api/normals in the dev server with the same handler Vercel runs. */
function devApi(): Plugin {
  return {
    name: 'produce-season-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/normals', async (req, res) => {
        const mod = (await server.ssrLoadModule('/src/server/normals.ts')) as typeof import('./src/server/normals');
        const response = await mod.handleNormals(new URL(req.url ?? '/', 'http://localhost'));
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), produce(), devApi()],
  build: { outDir: 'dist', sourcemap: true },
});
