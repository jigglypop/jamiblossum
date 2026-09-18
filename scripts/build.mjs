import { cpSync, existsSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const distDir = join(root, 'dist');
const sourceWasmDir = join(root, 'src', 'wasm-pkg');
const stageRoot = mkdtempSync(join(dirname(root), '.jamiblossom-build-'));
const stageDistDir = join(stageRoot, 'dist');
const stageWasmDir = join(stageRoot, 'wasm-pkg');
const backupDistDir = join(stageRoot, 'dist-backup');

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
  });
}

let oldDistMoved = false;
let preserveStage = false;

try {
  run('wasm-pack', [
    'build',
    'wasm',
    '--target',
    'web',
    '--out-dir',
    stageWasmDir,
    '--out-name',
    'jamiblossom_core',
  ]);

  writeFileSync(
    join(stageWasmDir, '.gitignore'),
    '# Keep wasm-pack output in the package so jamiblossom can be published directly.\n',
  );
  rmSync(sourceWasmDir, { recursive: true, force: true });
  cpSync(stageWasmDir, sourceWasmDir, { recursive: true });

  run(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '-p',
    'tsconfig.build.json',
    '--outDir',
    stageDistDir,
  ]);

  cpSync(stageWasmDir, join(stageDistDir, 'wasm-pkg'), { recursive: true });

  if (existsSync(distDir)) {
    renameSync(distDir, backupDistDir);
    oldDistMoved = true;
  }

  try {
    renameSync(stageDistDir, distDir);
  } catch (error) {
    if (oldDistMoved) {
      try {
        renameSync(backupDistDir, distDir);
        oldDistMoved = false;
      } catch (restoreError) {
        preserveStage = true;
        throw new AggregateError(
          [error, restoreError],
          `Failed to replace dist and restore it. The previous dist is preserved at ${backupDistDir}`,
        );
      }
    }
    throw error;
  }
} finally {
  if (!preserveStage) {
    rmSync(stageRoot, { recursive: true, force: true });
  }
}
