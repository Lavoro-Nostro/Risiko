param(
    [string]$HostUrl = "",
    [string]$MapId = "world-classic",
    [string]$HostPeerId = "host-local",
    [string]$HostDisplayName = "Host",
    [string]$Peer2Id = "peer-local-2",
    [string]$Peer2DisplayName = "Peer 2",
    [int]$RngSeed = 12345
)

$ErrorActionPreference = "Stop"

function Resolve-HostBaseUrl {
    param([string]$PreferredUrl)

    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($PreferredUrl)) {
        $candidates += $PreferredUrl
    }
    $candidates += "http://localhost:5050"
    $candidates += "http://localhost:5213"
    $candidates = $candidates | Select-Object -Unique

    foreach ($candidate in $candidates) {
        try {
            $health = Invoke-RestMethod -Method Get -Uri "$($candidate.TrimEnd('/'))/health"
            if ($health.status -eq "healthy") {
                return $candidate.TrimEnd("/")
            }
        } catch {
            continue
        }
    }

    throw "Risk.Host is not reachable. Start it first with ./scripts/run-dev.ps1, then retry."
}

$baseUrl = Resolve-HostBaseUrl -PreferredUrl $HostUrl

Write-Host "Using host: $baseUrl"
Write-Host "Creating room..."

$createBody = @{
    hostPeerId = $HostPeerId
    hostDisplayName = $HostDisplayName
    mapId = $MapId
} | ConvertTo-Json

$room = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/rooms" -ContentType "application/json" -Body $createBody

Write-Host "Joining second player..."

$joinBody = @{
    peerId = $Peer2Id
    displayName = $Peer2DisplayName
} | ConvertTo-Json

$null = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/rooms/$($room.roomId)/join" -ContentType "application/json" -Body $joinBody

Write-Host "Starting match..."

$startBody = @{
    hostPeerId = $HostPeerId
    mapId = $MapId
    rngSeed = $RngSeed
} | ConvertTo-Json

$start = Invoke-RestMethod -Method Post -Uri "$baseUrl/api/rooms/$($room.roomId)/start" -ContentType "application/json" -Body $startBody

Write-Host ""
Write-Host "Local match ready."
Write-Host "Host URL : $baseUrl"
Write-Host "Room ID  : $($start.roomId)"
Write-Host "Match ID : $($start.matchId)"
Write-Host ""
Write-Host "Use these values in Risk.Web:"
Write-Host "URL Host  = $baseUrl"
Write-Host "Match ID  = $($start.matchId)"
Write-Host "Peer ID   = $HostPeerId"
Write-Host "Player ID = $HostPeerId"
Write-Host ""
Write-Host "Second player (for another browser tab/window):"
Write-Host "Peer ID   = $Peer2Id"
Write-Host "Player ID = $Peer2Id"
