#Requires -Version 5.1
param([string]$Bucket = 'jamiblossom-web-960243570517', [string]$Stack = 'jamiblossum-reading-backend')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$stage = Join-Path ([IO.Path]::GetTempPath()) ('jamiblossum-backend-' + [guid]::NewGuid())
$zip = "$stage.zip"
try {
  New-Item -ItemType Directory -Path "$stage/server","$stage/data/sources/normalized" -Force | Out-Null
  Copy-Item "$workspace/server/backend.mjs","$workspace/server/retrieval.mjs" "$stage/server/"
  Copy-Item "$workspace/data/sources/normalized/chunks.jsonl" "$stage/data/sources/normalized/"
  Compress-Archive -Path "$stage/*" -DestinationPath $zip
  $sha = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  $key = "backend/releases/$sha.zip"
  aws s3 cp $zip "s3://$Bucket/$key" --no-progress
  if ($LASTEXITCODE -ne 0) { throw 'Backend artifact upload failed.' }
  $version = aws s3api head-object --bucket $Bucket --key $key --query VersionId --output text
  if ($LASTEXITCODE -ne 0) { throw 'Backend artifact lookup failed.' }
  if ([string]::IsNullOrWhiteSpace($version) -or $version -eq 'None') { $version = 'NONE' }
  aws cloudformation deploy --stack-name $Stack --template-file "$workspace/deploy/backend.yml" --capabilities CAPABILITY_NAMED_IAM --region ap-northeast-2 --parameter-overrides ArtifactBucket=$Bucket ArtifactKey=$key ArtifactVersion=$version
  if ($LASTEXITCODE -ne 0) { throw 'Backend stack deployment failed.' }
  aws cloudformation describe-stacks --stack-name $Stack --region ap-northeast-2 --query 'Stacks[0].Outputs' --output json
} finally {
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $resolvedStage = [IO.Path]::GetFullPath($stage)
  $resolvedZip = [IO.Path]::GetFullPath($zip)
  if ($resolvedStage.StartsWith($tempRoot) -and $resolvedZip.StartsWith($tempRoot) -and (Split-Path -Leaf $resolvedStage) -like 'jamiblossum-backend-*') {
    Remove-Item -LiteralPath $resolvedStage,$resolvedZip -Recurse -Force -ErrorAction SilentlyContinue
  } else { Write-Warning 'Temporary paths failed the cleanup boundary check.' }
}
