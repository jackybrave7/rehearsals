$ports = @(3000, 3003, 3001)
$killed = @()

foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        $processId = $conn.OwningProcess
        if ($processId -and $processId -ne 0 -and $killed -notcontains $processId) {
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            $killed += $processId
            Write-Host "Stopped PID $processId (port $port)"
        }
    }
}

if ($killed.Count -eq 0) {
    Write-Host "No listeners on ports $($ports -join ', ')"
}

Start-Sleep -Seconds 1

foreach ($port in $ports) {
    $still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($still) {
        Write-Host "WARNING: port $port is still in use (PID $($still.OwningProcess))"
        exit 1
    }
}

exit 0
