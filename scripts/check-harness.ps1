$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$process = $null
$processStarted = $false

function Read-Response([System.Diagnostics.Process]$Child, [int]$Id) {
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        $read = $Child.StandardOutput.ReadLineAsync()
        $remaining = 15000 - [int]$timer.ElapsedMilliseconds
        if ($remaining -le 0 -or -not $read.Wait($remaining)) {
            throw "response timeout (id=$Id)"
        }
        $line = $read.Result
        if ($null -eq $line) { throw "unexpected EOF (id=$Id)" }
        $message = $line | ConvertFrom-Json
        if ($message.id -eq $Id) { return $message }
    }
}

try {
    $codex = (Get-Command codex -ErrorAction Stop).Source
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $codex
    $start.Arguments = 'app-server --strict-config'
    $start.WorkingDirectory = $root
    $start.UseShellExecute = $false
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    [void]$process.Start()
    $processStarted = $true
    $process.BeginErrorReadLine()

    $initialize = @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{
        clientInfo = @{ name = 'jamiblossom_harness_check'; version = '1.0' }
        capabilities = @{ experimentalApi = $true }
    }} | ConvertTo-Json -Compress -Depth 8
    $process.StandardInput.WriteLine($initialize)
    $process.StandardInput.Flush()
    $initializedResponse = Read-Response $process 1
    if ($initializedResponse.error) { throw 'initialize failed' }

    $process.StandardInput.WriteLine('{"jsonrpc":"2.0","method":"initialized","params":{}}')
    $request = @{ jsonrpc = '2.0'; id = 2; method = 'config/read'; params = @{
        cwd = $root; includeLayers = $true
    }} | ConvertTo-Json -Compress -Depth 8
    $process.StandardInput.WriteLine($request)
    $process.StandardInput.Flush()
    $response = Read-Response $process 2
    if ($response.error) { throw 'config/read failed' }

    $config = $response.result.config
    $expectedProjectFolder = [System.IO.Path]::GetFullPath((Join-Path $root '.codex')).TrimEnd('\', '/')
    $projectLayer = $null
    foreach ($layer in @($response.result.layers)) {
        if ($layer.name.type -ne 'project' -or -not $layer.name.dotCodexFolder) { continue }
        $layerFolder = [System.IO.Path]::GetFullPath($layer.name.dotCodexFolder).TrimEnd('\', '/')
        if ($layerFolder -eq $expectedProjectFolder) { $projectLayer = $layer; break }
    }
    $expected = [ordered]@{
        model = 'gpt-6-astra'
        model_reasoning_effort = 'low'
        model_verbosity = 'low'
        tool_output_token_limit = 2000
        agents_enabled = $true
        agents_default_model = 'gpt-5.6-sol'
        agents_default_effort = 'low'
        agents_max_concurrent = 2
        agents_max_depth = 1
        project_layer_active = $true
    }
    $actual = [ordered]@{
        model = $config.model
        model_reasoning_effort = $config.model_reasoning_effort
        model_verbosity = $config.model_verbosity
        tool_output_token_limit = $config.tool_output_token_limit
        agents_enabled = $config.agents.enabled
        agents_default_model = $config.agents.default_subagent_model
        agents_default_effort = $config.agents.default_subagent_reasoning_effort
        agents_max_concurrent = $config.agents.max_concurrent_threads_per_session
        agents_max_depth = $config.agents.max_depth
        project_layer_active = ($null -ne $projectLayer -and $null -eq $projectLayer.disabledReason)
    }
    foreach ($key in $expected.Keys) {
        if ($actual[$key] -ne $expected[$key]) { throw "configuration mismatch: $key" }
    }

    $agentsPath = Join-Path $root 'AGENTS.md'
    $agentsText = [System.IO.File]::ReadAllText($agentsPath, [System.Text.Encoding]::UTF8)
    $result = [ordered]@{
        expected = $expected
        actual = $actual
        agents_utf8_bytes = ([System.IO.File]::ReadAllBytes($agentsPath)).Length
        agents_characters = $agentsText.Length
        passed = $true
    }
    $result | ConvertTo-Json -Depth 5
    exit 0
}
catch {
    [ordered]@{ passed = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
}
finally {
    if ($null -ne $process) {
        if ($processStarted -and -not $process.HasExited) {
            $process.Kill()
            [void]$process.WaitForExit(2000)
        }
        $process.Dispose()
    }
}
