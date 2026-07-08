@echo off
setlocal

set "GIT=C:\Program Files\Git\cmd\git.exe"

"%GIT%" add .
"%GIT%" commit -m "feat: integration de l'API Sene-Pay (depots et achats)"
"%GIT%" push origin main

echo Termine !
