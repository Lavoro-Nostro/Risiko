$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Write-Host "Running focused game-flow shortcut tests..."
dotnet test Risk.Engine.Tests/Risk.Engine.Tests.csproj -c Release --filter "FullyQualifiedName~GameFlowShortcutTests"

Write-Host "Done."
