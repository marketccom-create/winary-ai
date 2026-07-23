@echo off
setlocal

set GIT=C:\Program Files\Git\cmd\git.exe
set REPO=C:\RESERVOIR\Apps Dev\FIRST AI\skild-ai

cd /d "%REPO%"

echo.
echo ==========================================
echo   WINARY AI - Push GitHub / Vercel
echo ==========================================
echo.

"%GIT%" status --short
echo.

set MSG=
set /p MSG=Message de commit (Entree = mise a jour auto) : 
if "%MSG%"=="" set MSG=update: mise a jour WINARY AI

echo.
echo [1/3] Ajout des fichiers...
"%GIT%" add .

echo [2/3] Commit...
"%GIT%" commit -m "%MSG%"

echo [3/3] Push vers GitHub...
"%GIT%" push origin main

echo.
IF %ERRORLEVEL%==0 (
    echo ==========================================
    echo   SUCCES ! Code envoye sur GitHub.
    echo   Vercel va redeployer automatiquement.
    echo ==========================================
    echo.
    echo   Repo   : https://github.com/marketccom-create/winary-ai
    echo   Vercel : https://vercel.com/dashboard
    echo.
) ELSE (
    echo ==========================================
    echo   ERREUR lors du push !
    echo ==========================================
    echo.
    echo Solutions :
    echo   1. Verifiez votre connexion Internet
    echo   2. Git auth : "%GIT%" config --global credential.helper manager
    echo   3. Token    : https://github.com/settings/tokens/new
    echo.
)
pause
