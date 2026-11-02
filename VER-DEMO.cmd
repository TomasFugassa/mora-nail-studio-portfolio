@echo off
cd /d "%~dp0"
echo Mora Nail Studio - Vista local
echo Abri http://127.0.0.1:4324/ cuando indique que esta lista.
echo El panel esta en http://127.0.0.1:4324/admin
echo La clave inicial se guarda en .local-admin-access.txt
call npm.cmd run dev
pause
