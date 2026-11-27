param([string]$Operateur)

$ErrorActionPreference = 'Stop'
$depot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
if (-not $Operateur) {
    $Operateur = Join-Path $depot '../symbolic-public-format/experiments/symbolic-situations/public-format/operator/run.mjs'
}
$node = (Get-Command node.exe -All | Where-Object {
    [version]((& $_.Source --version).TrimStart('v')) -ge [version]'24.0.0'
} | Select-Object -First 1).Source
if (-not $node) { throw 'Node 24 requis' }
$programme = 'experiments/sic-agenda-offres/public-v1'
$dossier = New-Item -Type Directory -Path (Join-Path ([IO.Path]::GetTempPath()) ('sic-developpement-' + (New-Guid).Guid))

function Mesurer([string]$sha) {
    $rapport = Join-Path $dossier.FullName ($sha + '.json')
    & $node $Operateur --partition developpement --depot $depot --sha $sha --entree "$programme/solveur.mjs" `
        --dep "$programme/admission.mjs" --dep "$programme/planifier.mjs" --dep "$programme/schema.json" `
        --dep experiments/sic-agenda-offres/agenda.mjs --dep src/sic/reasoning-mode.ts --rapport $rapport | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Échec de l’opérateur pour $sha" }
    $mesure = Get-Content -LiteralPath $rapport -Raw -Encoding utf8 | ConvertFrom-Json
    if ($mesure.partition -ne 'developpement' -or $mesure.consommateur -ne $sha -or $mesure.bilan.departs -ne 18) {
        throw 'Reçu de développement inattendu'
    }
    return $mesure
}

$base = Mesurer 'f296ac1c2e18f9d02b8e3045c3a225c61553c0e6'
$candidat = Mesurer 'bd61ff40b0a9fbc243787ea269b4e89225206dd8'
if ($base.operateur -ne $candidat.operateur) { throw "Versions différentes de l’opérateur" }
for ($i = 0; $i -lt $base.departs.Count; $i++) {
    $ancien = $base.departs[$i] | ConvertTo-Json -Depth 15 -Compress
    $nouveau = $candidat.departs[$i] | ConvertTo-Json -Depth 15 -Compress
    if ($ancien -cne $nouveau) { throw "Première divergence au départ de développement $($i + 1)" }
}
if ($candidat.bilan.issues.succes -ne 18 -or $candidat.bilan.actions.executees -ne 74) { throw 'Bilan inattendu' }
Write-Output "Opérateur $($candidat.operateur) · développement"
Write-Output '18 départs identiques, commandes, retours, lectures et issues compris.'
Write-Output ($candidat.bilan | ConvertTo-Json -Depth 4 -Compress)
Write-Output "Reçus locaux : $($dossier.FullName)"
