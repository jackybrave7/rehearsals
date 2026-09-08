rem Shared OpenSSH client options (include from deploy.bat / deploy-check.bat / ssh.bat)

set "SSH_COMMON_OPTS=-o ConnectTimeout=20 -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=accept-new -o GSSAPIAuthentication=no -o KbdInteractiveAuthentication=no -o PreferredAuthentications=publickey -o IdentitiesOnly=yes -o PubkeyAuthentication=yes"
set "SSH_BATCH_OPTS=%SSH_COMMON_OPTS% -o BatchMode=yes -o PasswordAuthentication=no -o NumberOfPasswordPrompts=0"
