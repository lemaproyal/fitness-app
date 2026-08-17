@echo off
rem Startet den lokalen Server und oeffnet die App im Standardbrowser.
rem Der Server laeuft in einem eigenen Fenster — dieses Fenster schliesst sich selbst.

title Fitness-App Starter
cd /d "%~dp0"

start "Fitness-Server (nicht schliessen)" cmd /k node server.js

rem Kurz warten, damit der Server bereit ist, bevor der Browser anklopft.
timeout /t 2 /nobreak >nul

start "" http://localhost:5173/verwaltung.html
exit
