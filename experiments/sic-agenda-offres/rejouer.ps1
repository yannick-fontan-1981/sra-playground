# Le dépôt demande Node 22.18 ou plus récent. Plusieurs versions peuvent être dans PATH.
$ErrorActionPreference = 'Stop'
foreach ($runtime in (Get-Command node.exe -All)) {
    $version = [version]((& $runtime.Source --version).TrimStart('v'))
    if ($version -ge [version]'22.18.0') {
        & $runtime.Source (Join-Path $PSScriptRoot 'experiences.mjs') @args
        exit $LASTEXITCODE
    }
}
throw 'Le rejeu nécessite Node.js 22.18 ou plus récent.'
