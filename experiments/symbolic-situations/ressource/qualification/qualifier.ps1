param(
    [string] $Solveur,
    [string] $Lot,
    [string] $Rapport
)

$ErrorActionPreference = 'Stop'
$runtime = Get-Command node.exe -All | Where-Object {
    [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0'
} | Select-Object -First 1
if (-not $runtime) { throw 'Node.js 24 ou ultérieur est nécessaire.' }

$cli = @((Join-Path $PSScriptRoot 'operer.mjs'))
if ($Solveur) { $cli += @('--solveur', $Solveur) }
if ($Lot) { $cli += @('--lot', $Lot) }
if ($Rapport) { $cli += @('--rapport', $Rapport) }
& $runtime.Source @cli
exit $LASTEXITCODE
