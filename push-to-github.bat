@echo off
title WINARY AI — Push vers GitHub
color 0A
echo.
echo ==========================================
echo   WINARY AI - Deploiement GitHub
echo ==========================================
echo.

:: Chercher Git dans tous les emplacements possibles
SET GIT=
IF EXIST "C:\Program Files\Git\cmd\git.exe"                     SET GIT=C:\Program Files\Git\cmd\git.exe
IF EXIST "C:\Program Files (x86)\Git\cmd\git.exe"               SET GIT=C:\Program Files (x86)\Git\cmd\git.exe
IF EXIST "%LOCALAPPDATA%\Programs\Git\cmd\git.exe"              SET GIT=%LOCALAPPDATA%\Programs\Git\cmd\git.exe
IF EXIST "%LOCALAPPDATA%\GitHubDesktop\app-4.3.0\resources\app\git\cmd\git.exe" SET GIT=%LOCALAPPDATA%\GitHubDesktop\app-4.3.0\resources\app\git\cmd\git.exe

:: Essayer aussi avec le PATH system
git --version >nul 2>&1
IF %ERRORLEVEL%==0 SET GIT=git

IF "%GIT%"=="" (
    echo [ERREUR] Git n'est pas trouve.
    echo.
    echo Installez Git depuis : https://git-scm.com/download/win
    echo Redemarrez votre PC apres l'installation.
    echo.
    pause
    start https://git-scm.com/download/win
    exit /b 1
)

echo [OK] Git trouve.
echo.

cd /d "C:\RESERVOIR\Apps Dev\FIRST AI\skild-ai"

echo [1/5] Initialisation du depot Git...
"%GIT%" init
"%GIT%" config user.name "WINARY AI"
"%GIT%" config user.email "admin@winaryai.com"

echo.
echo [2/5] Configuration du remote GitHub...
"%GIT%" remote remove origin 2>nul
"%GIT%" remote add origin https://github.com/marketccom-create/winary-ai.git

echo.
echo [3/5] Ajout des fichiers (hors secrets)...
"%GIT%" add .

echo.
echo [4/5] Commit initial...
"%GIT%" commit -m "feat: WINARY AI production - Supabase + API Routes + Auth reelle"

echo.
echo [5/5] Push vers GitHub...
echo (Une fenetre de connexion GitHub peut apparaitre)
"%GIT%" branch -M main
"%GIT%" push -u origin main --force

echo.
IF %ERRORLEVEL%==0 (
    echo ==========================================
    echo   SUCCES ! Code en ligne sur GitHub.
    echo ==========================================
    echo.
    echo Prochaine etape : Deployer sur Vercel
    echo  1. Allez sur https://vercel.com
    echo  2. New Project - Import - winary-ai
    echo  3. Ajoutez vos variables d'environnement
    echo  4. Deploy !
) ELSE (
    echo [ERREUR] Le push a echoue.
    echo Verifiez que le depot GitHub existe bien :
    echo   https://github.com/marketccom-create/winary-ai
    echo.
    echo Si le depot est prive, authentifiez-vous avec :
    echo   git config --global credential.helper manager
)
echo.
pause
