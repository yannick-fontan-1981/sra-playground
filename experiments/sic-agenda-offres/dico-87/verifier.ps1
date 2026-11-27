$ErrorActionPreference = 'Stop'
foreach ($runtime in (Get-Command node.exe -All)) {
    if ([version]((& $runtime.Source --version).TrimStart('v')) -ge [version]'24.0.0') {
        & $runtime.Source (Join-Path $PSScriptRoot 'verifier.mjs') @args
        exit $LASTEXITCODE
    }
}
throw 'Ce rejeu utilise Node.js 24 ou plus récent.'
