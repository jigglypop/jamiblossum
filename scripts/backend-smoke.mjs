import { spawnSync } from 'node:child_process';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { calculateZiweiChart } from '../dist/calculate.js';

const chart = calculateZiweiChart({ calendar: 'solar', date: '1990-01-01', time: '12:00', gender: '남성', language: 'ko-KR' });
const event = { requestContext: { identity: { userArn: 'arn:aws:iam::960243570517:user/signed-smoke' } }, body: JSON.stringify({ domain: 'saju', question: '용신과 격국의 고전 원문 근거를 구분해 설명해 주세요.', chart }) };
const token = randomUUID();
const payloadPath = join(tmpdir(), `jamiblossum-payload-${token}.json`);
const outputPath = join(tmpdir(), `jamiblossum-output-${token}.json`);
try {
  await writeFile(payloadPath, JSON.stringify(event));
  const invocation = spawnSync('aws', ['lambda', 'invoke', '--function-name', 'jamiblossum-reading-backend', '--cli-binary-format', 'raw-in-base64-out', '--payload', `fileb://${payloadPath}`, outputPath], { encoding: 'utf8' });
  if (invocation.status !== 0) throw new Error(invocation.stderr || invocation.stdout);
  const envelope = JSON.parse(await readFile(outputPath, 'utf8'));
  const body = JSON.parse(envelope.body);
  console.log(JSON.stringify({ statusCode: envelope.statusCode, status: body.status, dryRun: body.dryRun, model: body.model, generationDisabledReason: body.generationDisabledReason, citations: body.citations?.length, estimatedInputChars: body.estimatedInputChars, corpusFingerprint: body.corpusFingerprint }));
} finally {
  await rm(payloadPath, { force: true }); await rm(outputPath, { force: true });
}
