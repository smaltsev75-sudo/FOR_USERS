@echo off
chcp 65001 >nul
title Sprint Planner Server

echo ========================================
echo       Запуск Sprint Planner
echo ========================================
echo.

:: Проверяем наличие Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Python найден. Запускаем сервер...
    echo.
    start http://localhost:8000
    python -m http.server 8000
    goto end
)

:: Проверяем наличие Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Node.js найден. Запускаем сервер...
    echo.
    start http://localhost:8000
    npx http-server -p 8000
    goto end
)

:: Если ничего не найдено
echo [✗] Не удалось найти ни Python, ни Node.js.
echo.
echo Пожалуйста, установите Python (https://python.org) или Node.js (https://nodejs.org).
echo После установки запустите этот файл снова.
pause
exit /b

:end
echo.
echo Сервер остановлен. Нажмите любую клавишу для выхода...
pause >nul