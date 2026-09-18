import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const root = dirname(dirname(fileURLToPath(import.meta.url)));

test('the published package contains its entry points without Cargo build output', () => {
  const output = execFileSync(
    process.execPath,
    [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: root, encoding: 'utf8' },
  );
  const [{ files }] = JSON.parse(output);
  const paths = new Set(files.map((file) => file.path.replaceAll('\\', '/')));

  assert.ok(paths.has('dist/index.js'));
  assert.ok(paths.has('dist/index.d.ts'));
  assert.ok(paths.has('dist/wasm.js'));
  assert.ok(paths.has('dist/wasm-pkg/jamiblossom_core_bg.wasm'));
  assert.ok(paths.has('wasm/Cargo.toml'));
  assert.ok(paths.has('wasm/src/lib.rs'));
  assert.equal(
    [...paths].some((path) => path.startsWith('wasm/target/')),
    false,
  );
});
