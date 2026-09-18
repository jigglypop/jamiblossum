#Requires -Version 7.0
param(
  [Parameter(Mandatory)][string]$ReleaseId,
  [string]$Bucket = 'jamiblossom-web-960243570517',
  [string]$DistributionId = 'E1GZVFASVCCZI8'
)
$ErrorActionPreference = 'Stop'
$lockPath = Join-Path ([System.IO.Path]::GetTempPath()) 'jamiblossom-web-deploy.lock'
$lock = $null
if ($ReleaseId -notmatch '^[A-Za-z0-9._-]+$') { throw 'ReleaseId has invalid characters.' }
try { $lock = [System.IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') } catch { throw 'A deploy or rollback is already running.' }
try {
  $account = aws sts get-caller-identity --query Account --output text
  if ($LASTEXITCODE -ne 0 -or $account -ne '960243570517') { throw "Unexpected AWS account: $account" }
  $origin = aws cloudfront get-distribution --id $DistributionId --query 'Distribution.DistributionConfig.Origins.Items[0].[DomainName,OriginAccessControlId]' --output text
  if ($LASTEXITCODE -ne 0 -or $origin -notmatch [regex]::Escape("$Bucket.s3.ap-northeast-2.amazonaws.com") -or $origin -notmatch 'EQE07ZQ2TZ3Z1') { throw 'CloudFront origin or OAC mismatch.' }
  foreach ($name in @('index.html','version.json')) {
    $key = "rollback/$ReleaseId/$name"
    aws s3api head-object --bucket $Bucket --key $key *> $null
    if ($LASTEXITCODE -ne 0) { throw "Rollback object does not exist: s3://$Bucket/$key" }
  }
  aws s3api copy-object --bucket $Bucket --copy-source "$Bucket/rollback/$ReleaseId/version.json" --key version.json --cache-control 'no-cache,no-store,must-revalidate' --content-type 'application/json' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Version rollback failed.' }
  aws s3api copy-object --bucket $Bucket --copy-source "$Bucket/rollback/$ReleaseId/index.html" --key index.html --cache-control 'no-cache,no-store,must-revalidate' --content-type 'text/html' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Index rollback failed.' }
  $invalidation = aws cloudfront create-invalidation --distribution-id $DistributionId --paths '/' '/index.html' '/version.json' --query Invalidation.Id --output text
  if ($LASTEXITCODE -ne 0) { throw 'Rollback invalidation failed.' }
  aws cloudfront wait invalidation-completed --distribution-id $DistributionId --id $invalidation
  if ($LASTEXITCODE -ne 0) { throw 'Rollback invalidation did not complete.' }
  Write-Host "Restored the index and version saved before release $ReleaseId."
} finally { if ($lock) { $lock.Dispose() } }
