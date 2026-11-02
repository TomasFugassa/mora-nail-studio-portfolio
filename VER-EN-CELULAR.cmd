@echo off
cd /d "%~dp0"
echo Mora Nail Studio - Vista en tu red local
echo Conecta el celular al Wi-Fi del mismo router que la computadora.
echo Abri en el celular la direccion Network de tu computadora que aparece abajo.
echo Para el panel, agrega /admin al final de esa direccion.
call npm.cmd run dev:lan
pause
