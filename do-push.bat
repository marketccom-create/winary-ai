@echo off
setlocal

set "GIT=C:\Program Files\Git\cmd\git.exe"
set "REPO=C:\RESERVOIR\Apps Dev\FIRST AI\skild-ai"

cd /d "%REPO%"

echo Initialisation Git...
"%GIT%" init

"%GIT%" config user.name "WINARY AI"
"%GIT%" config user.email "admin@winaryai.com"

echo Configuration remote...
"%GIT%" remote remove origin 2>nul
"%GIT%" remote add origin https://github.com/marketccom-create/winary-ai.git

echo Ajout des fichiers...
"%GIT%" add .

echo Commit...
"%GIT%" commit -m "feat: WINARY AI production - Supabase + 12 API Routes + Auth reelle + CRUD Annonces"

echo Branch main...
"%GIT%" branch -M main

echo Push GitHub...
"%GIT%" push -u origin main --force

echo.
echo TERMINE. Code envoye sur GitHub.
