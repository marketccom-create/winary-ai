@echo off
setlocal

set "GIT=C:\Program Files\Git\cmd\git.exe"

"%GIT%" add .
"%GIT%" commit -m "fix: suppression des identifiants demo"
"%GIT%" push origin main

echo Termine !
