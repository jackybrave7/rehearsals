#!/usr/bin/env bash
# One-time: SSH on port 54321 (already allowed in Timeweb firewall "Polite Crossbill").
# After this, on Windows: copy deploy/deploy.local.example.bat → deploy/deploy.local.bat
# and set SSH_PORT=54321, then deploy.bat --skip-git

set -euo pipefail

SSHD="/etc/ssh/sshd_config"
MARK="# rehearsals-deploy-alt-port"

if grep -q "$MARK" "$SSHD" 2>/dev/null; then
  echo "Port 54321 already configured ($MARK)"
else
  echo "Adding Port 54321 to $SSHD"
  printf '\n%s\nPort 54321\n' "$MARK" | tee -a "$SSHD" >/dev/null
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ufw allow 54321/tcp comment 'SSH alt for deploy' || true
fi

sshd -t
systemctl reload ssh || systemctl reload sshd

echo "OK: sshd listens on 22 and 54321. Test from PC:"
echo "  ssh -i %USERPROFILE%\\.ssh\\rehearsals_vps -p 54321 root@45.153.71.162"
