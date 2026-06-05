@echo off
setlocal

set "GIT=C:\Program Files\Git\cmd\git.exe"
set "REPO=C:\RESERVOIR\Apps Dev\FIRST AI\skild-ai"

cd /d "%REPO%"

echo.
echo ==========================================
echo  WINARY AI - Push GitHub (Etape 2)
echo ==========================================
echo.
echo Le commit a deja ete fait. On envoie maintenant vers GitHub.
echo.
echo Si une fenetre de connexion s'ouvre, connectez-vous avec :
echo   - Votre compte GitHub : marketccom-create
echo   - Cliquez "Sign in with browser" ou entrez votre token
echo.

:: Configurer credential helper
"%GIT%" config --global credential.helper manager

:: Push avec affichage verbose
"%GIT%" push -u origin main --force --progress

echo.
IF %ERRORLEVEL%==0 (
    color 0A
    echo ==========================================
    echo   SUCCES ! Code en ligne sur GitHub.
    echo ==========================================
    echo.
    echo Votre depot : https://github.com/marketccom-create/winary-ai
    echo.
    echo PROCHAINE ETAPE : Deployer sur Vercel
    echo  1. https://vercel.com - New Project
    echo  2. Importer marketccom-create/winary-ai
    echo  3. Ajouter les 4 variables d'environnement
    echo  4. Deploy !
) ELSE (
    color 0C
    echo ==========================================
    echo   ATTENTION - Authentification requise
    echo ==========================================
    echo.
    echo Option 1 : Ouvrez GitHub Desktop et connectez-vous
    echo Option 2 : Creez un token sur :
    echo   https://github.com/settings/tokens/new
    echo   (cochez : repo, workflow)
    echo   Puis re-executez ce script.
    echo.
    echo Option 3 : Utilisez GitHub Desktop pour importer ce dossier.
)
echo.
pause
