import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const distDir = join(root, 'dist');
const sourceWasmDir = join(root, 'src', 'wasm-pkg');
const distWasmDir = join(distDir, 'wasm-pkg');

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
  });
}

if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}

run('wasm-pack', [
  'build',
  'wasm',
  '--target',
  'web',
  '--out-dir',
  '../src/wasm-pkg',
  '--out-name',
  'jamiblossom_core',
]);

writeFileSync(
  join(sourceWasmDir, '.gitignore'),
  '# Keep wasm-pack output in the package so jamiblossom can be published directly.\n',
);

run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json']);

cpSync(sourceWasmDir, distWasmDir, { recursive: true });
