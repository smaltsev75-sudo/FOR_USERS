@echo off
chcp 65001 >nul
title Sprint Planner Server

:: Гарантия: рабочая директория = папка, где лежит этот bat
:: (без этого `python -m http.server` отдавал бы файлы из cwd вызывающего)
cd /d "%~dp0"

:: Нестандартный порт, чтобы не пересекаться с другими локальными проектами
:: (старый 8000 часто занят и приводит к конфликту Service Worker'ов)
set PORT=8123
set URL=http://localhost:%PORT%

echo ========================================
echo       Запуск Sprint Planner на %URL%
echo ========================================
echo.

:: Проверяем наличие Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python найден. Запускаем сервер...
    echo.
    start "" %URL%
    python -m http.server %PORT%
    goto end
)

:: Проверяем наличие Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js найден. Запускаем сервер...
    echo.
    start "" %URL%
    npx http-server -p %PORT%
    goto end
)

:: Если ничего не найдено
echo [ERROR] Не удалось найти ни Python, ни Node.js.
echo.
echo Пожалуйста, установите Python (https://python.org) или Node.js (https://nodejs.org).
echo После установки запустите этот файл снова.
pause
exit /b

:end
echo.
echo Сервер остановлен. Нажмите любую клавишу для выхода...
pause >nul
