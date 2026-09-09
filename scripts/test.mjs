import { execFileSync } from 'node:child_process';
import { cpSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json'], {
  cwd: root, stdio: 'inherit',
});
// Rust is unchanged; test the checked-in WASM artifact with freshly compiled wrappers.
cpSync(new URL('../src/wasm-pkg/', import.meta.url), new URL('../dist/wasm-pkg/', import.meta.url), { recursive: true });
const tests = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => name.endsWith('.test.mjs')).map(name => `tests/${name}`);
execFileSync(process.execPath, ['--test', ...tests], { cwd: root, stdio: 'inherit' });
