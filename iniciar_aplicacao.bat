@echo off
title VozTreina - Narração de Treinamentos PT-BR
chcp 65001 > nul
cls

echo ===========================================================
echo    🎙️ Iniciando VozTreina - Narração de Treinamentos
echo ===========================================================
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo [!] Dependencias nao instaladas. Executando npm install...
    call npm install
    echo.
)

if not exist .env (
    if exist .env.example (
        echo [!] Arquivo .env nao encontrado. Criando modelo .env...
        copy .env.example .env
        echo [!] ATENCAO: Verifique se sua GEMINI_API_KEY esta configurada no arquivo .env
        echo.
    )
)

echo [i] Abrindo o navegador em http://localhost:3000...
start "" "http://localhost:3000"

echo [i] Iniciando servidor Node.js/Express na porta 3000...
echo.
call npm run dev

pause
