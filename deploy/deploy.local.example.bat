@echo off
rem Copy to deploy\deploy.local.bat and adjust if needed (file is gitignored).
rem deploy.bat loads this automatically before connecting.

set "SSH_HOST=root@45.153.71.162"
set "SSH_PORT=22"
set "SSH_KEY=%USERPROFILE%\.ssh\rehearsals_vps"
set "REMOTE_DIR=/var/www/rehearsals"
