$ErrorActionPreference = 'Stop'
foreach ($runtime in (Get-Command node.exe -All)) {
    $version = [version]((& $runtime.Source --version).TrimStart('v'))
    if ($version -ge [version]'24.0.0') {
        & $runtime.Source (Join-Path $PSScriptRoot 'qualifier.mjs') @args
        exit $LASTEXITCODE
    }
}
throw 'La qualification utilise Node.js 24 ou plus récent.'
