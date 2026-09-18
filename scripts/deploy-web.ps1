#Requires -Version 7.0
param(
  [string]$Bucket = 'jamiblossom-web-960243570517',
  [string]$DistributionId = 'E1GZVFASVCCZI8',
  [string]$Domain = 'jamiblossom.com',
  [string]$ReleaseId = '',
  [switch]$SkipBuild,
  [switch]$SkipCloudFrontWait,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path ([System.IO.Path]::GetTempPath()) 'jamiblossom-web-deploy.lock'
$lock = $null

function Invoke-Checked([scriptblock]$Command, [string]$Failure) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw $Failure }
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

try {
  $lock = [System.IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None')
} catch {
  throw 'Another jamiblossom web deployment is already running.'
}

Push-Location $workspacePath
try {
  $awsAccount = aws sts get-caller-identity --query Account --output text
  if ($LASTEXITCODE -ne 0 -or $awsAccount -ne '960243570517') { throw "Expected AWS account 960243570517, got $awsAccount." }
  $bucketRegion = aws s3api get-bucket-location --bucket $Bucket --query LocationConstraint --output text
  if ($LASTEXITCODE -ne 0 -or $bucketRegion -ne 'ap-northeast-2') { throw "Bucket $Bucket is not in ap-northeast-2." }
  $origin = aws cloudfront get-distribution --id $DistributionId --query 'Distribution.DistributionConfig.Origins.Items[0].[DomainName,OriginAccessControlId]' --output text
  if ($LASTEXITCODE -ne 0 -or $origin -notmatch [regex]::Escape("$Bucket.s3.ap-northeast-2.amazonaws.com") -or $origin -notmatch 'EQE07ZQ2TZ3Z1') { throw 'CloudFront origin or OAC does not match the expected production resources.' }

  if (-not $SkipBuild) { Invoke-Checked { pnpm build:web } 'Web build failed.' }
  $distPath = Join-Path $workspacePath 'web-dist'
  $indexPath = Join-Path $distPath 'index.html'
  if (-not (Test-Path -LiteralPath $indexPath)) { throw 'web-dist/index.html is missing.' }
  $index = Get-Content -Raw -LiteralPath $indexPath
  $references = [regex]::Matches($index, '(?:src|href)=["'']([^"''?#]+)') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notmatch '^(?:https?:)?//' -and $_ -notmatch '^(?:mailto:|tel:|data:)' } | ForEach-Object { $_.TrimStart('/') }
  foreach ($reference in $references) {
    if (-not (Test-Path -LiteralPath (Join-Path $distPath $reference))) { throw "Built index references missing file: $reference" }
  }
  $wasmFiles = @(Get-ChildItem -LiteralPath $distPath -Recurse -File -Filter '*.wasm')
  if ($wasmFiles.Count -lt 1) { throw 'Build contains no WASM asset.' }

  if ([string]::IsNullOrWhiteSpace($ReleaseId)) {
    $ReleaseId = "$(Get-Date -AsUTC -Format 'yyyyMMddTHHmmssZ')-local"
  }
  if ($ReleaseId -notmatch '^[A-Za-z0-9._-]+$') { throw 'ReleaseId has invalid characters.' }
  $files = @(Get-ChildItem -LiteralPath $distPath -Recurse -File | Where-Object Name -ne 'version.json')
  $manifest = [ordered]@{}
  foreach ($file in $files) {
    $relative = [System.IO.Path]::GetRelativePath($distPath, $file.FullName).Replace('\', '/')
    $manifest[$relative] = Get-Sha256 $file.FullName
  }
  $version = [ordered]@{ release=$ReleaseId; deployedAtUtc=(Get-Date -AsUTC -Format 'o'); files=$manifest }
  $versionPath = Join-Path $distPath 'version.json'
  $version | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $versionPath -Encoding utf8NoBOM
  if ($ValidateOnly) {
    Write-Host "Validated release $ReleaseId locally: $($files.Count) files, $($references.Count) local HTML references, $($wasmFiles.Count) WASM asset(s)."
    return
  }

  $rollbackKey = "rollback/$ReleaseId/index.html"
  $rollbackVersionKey = "rollback/$ReleaseId/version.json"
  aws s3api head-object --bucket $Bucket --key index.html *> $null
  if ($LASTEXITCODE -eq 0) {
    Invoke-Checked { aws s3api copy-object --bucket $Bucket --copy-source "$Bucket/index.html" --key $rollbackKey --cache-control 'no-cache,no-store,must-revalidate' --content-type 'text/html' | Out-Null } 'Failed to preserve the previous index.'
  }
  aws s3api head-object --bucket $Bucket --key version.json *> $null
  if ($LASTEXITCODE -eq 0) {
    Invoke-Checked { aws s3api copy-object --bucket $Bucket --copy-source "$Bucket/version.json" --key $rollbackVersionKey --cache-control 'no-cache,no-store,must-revalidate' --content-type 'application/json' | Out-Null } 'Failed to preserve the previous version record.'
  }
  Invoke-Checked { aws s3 sync (Join-Path $distPath 'assets') "s3://$Bucket/assets" --cache-control 'public,max-age=31536000,immutable' --no-progress } 'Immutable asset upload failed.'
  $fontsPath = Join-Path $distPath 'fonts'
  if (Test-Path -LiteralPath $fontsPath) { Invoke-Checked { aws s3 sync $fontsPath "s3://$Bucket/fonts" --cache-control 'public,max-age=86400' --no-progress } 'Font upload failed.' }
  foreach ($mutable in @('robots.txt', 'sitemap.xml', 'guides/manse.html', 'guides/ziwei.html')) {
    $mutablePath = Join-Path $distPath $mutable
    if (Test-Path -LiteralPath $mutablePath) {
      $contentType = if ($mutable -eq 'sitemap.xml') { 'application/xml' } elseif ($mutable.EndsWith('.html')) { 'text/html' } else { 'text/plain' }
      Invoke-Checked { aws s3 cp $mutablePath "s3://$Bucket/$mutable" --cache-control 'no-cache,no-store,must-revalidate' --content-type $contentType --no-progress } "Mutable SEO upload failed: $mutable"
    }
  }
  Invoke-Checked { aws s3 cp $versionPath "s3://$Bucket/version.json" --cache-control 'no-cache,no-store,must-revalidate' --content-type 'application/json' --no-progress } 'Version upload failed.'
  Invoke-Checked { aws s3 cp $indexPath "s3://$Bucket/index.html" --cache-control 'no-cache,no-store,must-revalidate' --content-type 'text/html' --no-progress } 'HTML upload failed.'

  $invalidationId = aws cloudfront create-invalidation --distribution-id $DistributionId --paths '/' '/index.html' '/version.json' '/robots.txt' '/sitemap.xml' '/guides/*' --query 'Invalidation.Id' --output text
  if ($LASTEXITCODE -ne 0) { throw 'CloudFront invalidation failed.' }
  if (-not $SkipCloudFrontWait) {
    Invoke-Checked { aws cloudfront wait invalidation-completed --distribution-id $DistributionId --id $invalidationId } 'CloudFront invalidation did not complete.'
    $remoteVersionText = curl.exe --fail --silent --show-error --header 'Cache-Control: no-cache' "https://$Domain/version.json?release=$ReleaseId"
    if ($LASTEXITCODE -ne 0) { throw 'Production version verification failed.' }
    $remoteVersion = $remoteVersionText | ConvertFrom-Json
    if ($remoteVersion.release -ne $ReleaseId) { throw "Production release mismatch: expected $ReleaseId, got $($remoteVersion.release)." }
    $remoteIndexTemporary = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
    try {
      Invoke-Checked { curl.exe --fail --silent --show-error --header 'Cache-Control: no-cache' --output $remoteIndexTemporary "https://$Domain/?release=$ReleaseId" } 'Production index fetch failed.'
      if ((Get-Sha256 $remoteIndexTemporary) -ne $manifest['index.html']) { throw 'Production index hash does not match the release manifest.' }
    } finally { Remove-Item -LiteralPath $remoteIndexTemporary -Force -ErrorAction SilentlyContinue }
    foreach ($reference in $references) { Invoke-Checked { curl.exe --fail --silent --show-error --output NUL "https://$Domain/$reference" } "Production asset verification failed: $reference" }
    foreach ($wasm in $wasmFiles) {
      $relative = [System.IO.Path]::GetRelativePath($distPath, $wasm.FullName).Replace('\', '/')
      $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
      try {
        Invoke-Checked { curl.exe --fail --silent --show-error --output $temporary "https://$Domain/$relative" } "Production WASM fetch failed: $relative"
        if ((Get-Sha256 $temporary) -ne $manifest[$relative]) { throw "Production WASM hash mismatch: $relative" }
      } finally { Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue }
    }
  }
  $receipt = [ordered]@{ release=$ReleaseId; deployedAtUtc=$version.deployedAtUtc; bucket=$Bucket; distributionId=$DistributionId; invalidationId=$invalidationId; rollbackIndexKey=$rollbackKey; rollbackVersionKey=$rollbackVersionKey; manifest=$manifest }
  $receiptPath = Join-Path $workspacePath "deploy/releases/$ReleaseId.json"
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $receiptPath) | Out-Null
  $receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $receiptPath -Encoding utf8NoBOM
  Write-Host "Deployed release $ReleaseId to https://$Domain/ (receipt: $receiptPath)"
} finally {
  Pop-Location
  if ($lock) { $lock.Dispose() }
}
