@echo off
rem Copy to deploy\deploy.local.bat and adjust if needed (file is gitignored).
rem deploy.bat loads this automatically before connecting.

set "SSH_HOST=root@45.153.71.162"
rem If outbound TCP 22 is blocked from your ISP, use alt SSH (once on server: bash deploy/setup-ssh-port-54321.sh)
set "SSH_PORT=54321"
rem set "SSH_PORT=22"
set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "REMOTE_DIR=/var/www/rehearsals"
