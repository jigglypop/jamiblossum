#Requires -Version 5.1
param([string]$DistributionId = 'E1GZVFASVCCZI8', [string]$FunctionName = 'jamiblossum-canonical-host')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$codePath = Join-Path $workspace 'deploy/canonical-host-function.js'
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$configPath = Join-Path $tempRoot "jamiblossum-cloudfront-$([guid]::NewGuid()).json"
try {
  $account = aws sts get-caller-identity --query Account --output text
  if ($LASTEXITCODE -ne 0 -or $account -ne '960243570517') { throw "Unexpected AWS account: $account" }
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  aws cloudfront describe-function --name $FunctionName *> $null
  $functionExists = $LASTEXITCODE -eq 0
  $ErrorActionPreference = $previousPreference
  if ($functionExists) {
    $functionEtag = aws cloudfront describe-function --name $FunctionName --query ETag --output text
    aws cloudfront update-function --name $FunctionName --if-match $functionEtag --function-config 'Comment=Redirect www to canonical apex,Runtime=cloudfront-js-2.0' --function-code "fileb://$codePath" | Out-Null
  } else {
    aws cloudfront create-function --name $FunctionName --function-config 'Comment=Redirect www to canonical apex,Runtime=cloudfront-js-2.0' --function-code "fileb://$codePath" | Out-Null
  }
  if ($LASTEXITCODE -ne 0) { throw 'CloudFront Function create/update failed.' }
  $publishEtag = aws cloudfront describe-function --name $FunctionName --query ETag --output text
  $published = aws cloudfront publish-function --name $FunctionName --if-match $publishEtag | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'CloudFront Function publish failed.' }
  $functionArn = $published.FunctionSummary.FunctionMetadata.FunctionARN

  $distribution = aws cloudfront get-distribution-config --id $DistributionId | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Distribution config lookup failed.' }
  $associations = @($distribution.DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items | Where-Object { $null -ne $_ })
  $viewerRequest = @($associations | Where-Object EventType -eq 'viewer-request')
  if ($viewerRequest.Count -gt 0 -and $viewerRequest[0].FunctionARN -ne $functionArn) { throw "Existing viewer-request association must be reviewed: $($viewerRequest[0].FunctionARN)" }
  if ($viewerRequest.Count -eq 0) { $associations += [pscustomobject]@{ FunctionARN=$functionArn; EventType='viewer-request' } }
  $distribution.DistributionConfig.DefaultCacheBehavior.FunctionAssociations = [pscustomobject]@{ Quantity=$associations.Count; Items=$associations }
  $configJson = $distribution.DistributionConfig | ConvertTo-Json -Depth 100
  [IO.File]::WriteAllText($configPath, $configJson, [Text.UTF8Encoding]::new($false))
  aws cloudfront update-distribution --id $DistributionId --if-match $distribution.ETag --distribution-config "file://$configPath" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Distribution association update failed.' }
  aws cloudfront wait distribution-deployed --id $DistributionId
  if ($LASTEXITCODE -ne 0) { throw 'Distribution did not reach Deployed state.' }
  Write-Host "Associated $functionArn with viewer-request on $DistributionId."
} finally {
  $resolved = [IO.Path]::GetFullPath($configPath)
  if ($resolved.StartsWith($tempRoot) -and (Split-Path -Leaf $resolved) -like 'jamiblossum-cloudfront-*.json') { Remove-Item -LiteralPath $resolved -Force -ErrorAction SilentlyContinue }
}
