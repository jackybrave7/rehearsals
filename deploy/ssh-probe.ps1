param(
  [Parameter(Mandatory = $true)][string]$SshBin,
  [Parameter(Mandatory = $true)][string]$KeyPath,
  [Parameter(Mandatory = $true)][string]$HostSpec,
  [int]$Port = 22,
  [int]$TimeoutSec = 25
)

$args = @(
  '-i', $KeyPath,
  '-p', "$Port",
  '-o', 'ConnectTimeout=20',
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'GSSAPIAuthentication=no',
  '-o', 'KbdInteractiveAuthentication=no',
  '-o', 'PreferredAuthentications=publickey',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'PubkeyAuthentication=yes',
  '-o', 'PasswordAuthentication=no',
  '-o', 'NumberOfPasswordPrompts=0',
  $HostSpec,
  'echo ok'
)

$p = Start-Process -FilePath $SshBin -ArgumentList $args -PassThru -NoNewWindow `
  -RedirectStandardOutput ([IO.Path]::GetTempFileName()) `
  -RedirectStandardError ([IO.Path]::GetTempFileName())

if (-not $p.WaitForExit($TimeoutSec * 1000)) {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Write-Output 'TIMEOUT'
  exit 124
}

if ($p.ExitCode -ne 0) {
  Write-Output 'AUTH_FAIL'
  exit $p.ExitCode
}

Write-Output 'OK'
exit 0
