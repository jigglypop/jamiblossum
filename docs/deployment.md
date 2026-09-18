# Web deployment

Production uses the private S3 bucket `jamiblossom-web-960243570517` in `ap-northeast-2` behind CloudFront distribution `E1GZVFASVCCZI8`. The public URL is <https://jamiblossom.com>.

## Automatic deployment

`.github/workflows/deploy-production.yml` runs tests and type checking for every push to `main`, obtains short-lived AWS credentials through GitHub OIDC, then builds, publishes, and verifies that exact commit SHA at `/version.json`. The workflow uses no stored AWS access key. If a GitHub environment is added later, update the IAM OIDC `sub` condition because GitHub changes the subject claim for environment jobs.

The IAM role is defined in `deploy/github-oidc-role.yml`. Apply it once from AWS account `960243570517`:

```powershell
aws cloudformation deploy `
  --stack-name jamiblossum-github-production-deploy `
  --template-file deploy/github-oidc-role.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --region ap-northeast-2
```

Its trust policy accepts only `jigglypop/jamiblossum`'s `main` branch. Its permissions are limited to reading/writing this site's bucket and invalidating this distribution.

## Local deployment and watch mode

Run one verified release with `pwsh ./scripts/deploy-web.ps1`. For continuous local deployment, run `pwsh ./scripts/watch-deploy-web.ps1`; these scripts require PowerShell 7. The watcher debounces changes, ignores generated/dependency/deployment directories, and the deploy lock prevents overlap. Stop it with Ctrl+C.

The deploy script validates the build and referenced files locally, requires a WASM asset, saves the current production index under `s3://jamiblossom-web-960243570517/rollback/<release>/index.html`, uploads content-addressed assets first, and publishes `version.json` and `index.html` last. It never deletes old assets. After CloudFront invalidation, it verifies the release ID, every HTML asset reference, and the production WASM hash. A JSON receipt is written to `deploy/releases/`.

## Rollback

Use the failed release ID whose pre-release index should be restored:

```powershell
pwsh ./scripts/rollback-web.ps1 -ReleaseId <release-id>
```

Rollback restores the saved `index.html` and its paired `version.json`; retained content-addressed assets continue to satisfy the restored index.
