#!/usr/bin/env bash
# ============================================================
# Sprint Planner — запуск локального HTTP-сервера
# Linux / macOS
#
# Запуск (не требует прав на исполнение файла):
#   bash start-server.sh
#
# Если права на исполнение выданы (chmod +x start-server.sh):
#   ./start-server.sh
# ============================================================

PORT=8000
URL="http://localhost:$PORT"

echo "========================================"
echo "       Запуск Sprint Planner"
echo "========================================"
echo ""

# ---------- Функция открытия браузера ----------
open_browser() {
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$URL" &          # Linux (X11 / Wayland)
    elif command -v open >/dev/null 2>&1; then
        open "$URL"                # macOS
    else
        echo "  Откройте браузер вручную: $URL"
    fi
}

# ---------- Python 3 ----------
if command -v python3 >/dev/null 2>&1; then
    echo "[✓] Python 3 найден. Запускаем сервер на порту $PORT..."
    echo ""
    echo "  Адрес: $URL"
    echo "  Для остановки нажмите Ctrl+C"
    echo ""
    open_browser
    python3 -m http.server "$PORT"
    exit 0
fi

# ---------- Python 2 (запасной вариант) ----------
if command -v python >/dev/null 2>&1; then
    PY_VER=$(python -c 'import sys; print(sys.version_info[0])' 2>/dev/null)
    if [ "$PY_VER" = "3" ]; then
        echo "[✓] Python 3 найден (как 'python'). Запускаем сервер на порту $PORT..."
        echo ""
        echo "  Адрес: $URL"
        echo "  Для остановки нажмите Ctrl+C"
        echo ""
        open_browser
        python -m http.server "$PORT"
        exit 0
    elif [ "$PY_VER" = "2" ]; then
        echo "[✓] Python 2 найден. Запускаем сервер на порту $PORT..."
        echo ""
        echo "  Адрес: $URL"
        echo "  Для остановки нажмите Ctrl+C"
        echo ""
        open_browser
        python -m SimpleHTTPServer "$PORT"
        exit 0
    fi
fi

# ---------- Node.js ----------
if command -v node >/dev/null 2>&1; then
    echo "[✓] Node.js найден. Запускаем сервер на порту $PORT..."
    echo ""
    echo "  Адрес: $URL"
    echo "  Для остановки нажмите Ctrl+C"
    echo ""
    open_browser
    npx http-server -p "$PORT"
    exit 0
fi

# ---------- PHP ----------
if command -v php >/dev/null 2>&1; then
    echo "[✓] PHP найден. Запускаем сервер на порту $PORT..."
    echo ""
    echo "  Адрес: $URL"
    echo "  Для остановки нажмите Ctrl+C"
    echo ""
    open_browser
    php -S "localhost:$PORT"
    exit 0
fi

# ---------- Ничего не найдено ----------
echo "[✗] Не удалось найти Python, Node.js или PHP."
echo ""
echo "Установите один из вариантов:"
echo "  Python 3 : https://python.org"
echo "  Node.js  : https://nodejs.org"
echo "  PHP      : https://php.net"
echo ""
echo "После установки запустите снова:"
echo "  bash start-server.sh"
exit 1
