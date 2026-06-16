@echo off
rem 強制設定為 UTF-8 顯示
chcp 65001 >nul
title 🛠️ 水電工程管理系統 - 啟動面板

echo ==========================================================
echo    🛠️ 家庭水電維修工程管理系統 (本地與雲端同步版)
echo ==========================================================
echo.
echo [步驟 1/3] 正在確認您的電腦是否已安裝 Node.js 執行環境...
echo.

node -v >nul 2>&1
if errorlevel 1 goto NO_NODE
goto HAS_NODE

:NO_NODE
echo ==========================================================
echo ❌ 警告：偵測到您的電腦尚未安裝 Node.js 執行環境！
echo ==========================================================
echo.
echo 請跟著以下簡單的步驟完成安裝，即可正常啟動系統：
echo.
echo 1. 請開啟您的瀏覽器，進入官方網址：https://nodejs.org
echo 2. 點擊下載推薦的「LTS 版本」(長期支援穩定版，如 v20 或 v22)
echo 3. 下載完成後點擊安裝檔，一直按 [下一步/Next] 直到安裝完成。
echo 4. 安裝完成後，請 [關閉當前這個黑色視窗]，再次重新按兩下執行 [啟動系統(Windows).bat]。
echo.
echo ==========================================================
pause
exit

:HAS_NODE
echo [環境檢測] 偵測到 Node.js 環境已就緒！
echo [系統安裝] 正在檢查並自動下載必要的套件依賴 (第一次下載約需 1~2 分鐘)...
echo.

call npm install
if errorlevel 1 goto TRY_LEGACY
goto CHECK_NODE_MODULES

:TRY_LEGACY
echo.
echo 下載套件失敗。請確認您的網路連線是否正常。
echo 正在嘗試備用下載方案...
call npm install --legacy-peer-deps
goto CHECK_NODE_MODULES

:CHECK_NODE_MODULES
if not exist node_modules goto NO_MODULES
goto BUILD_SYSTEM

:NO_MODULES
echo ==========================================================
echo ❌ 錯誤：無法建立 node_modules 資料夾，請確認本資料夾無寫入限制。
echo ==========================================================
pause
exit

:BUILD_SYSTEM
echo.
echo [步驟 2/3] 正在為您優化編譯系統網頁...
echo.

call npm run build
if errorlevel 1 goto DEV_MODE
goto PREVIEW_MODE

:PREVIEW_MODE
echo.
echo [步驟 3/3] 正在建立本地高速網頁伺服器...
echo 🚀 系統已準備就緒，正在為您在瀏覽器中開啟本系統首頁！
echo 🔗 首頁網址：http://localhost:4173
echo.
echo ==========================================================
echo               提示：系統執行期間請「不要」關閉此黑色視窗
echo               若不需要使用系統時，直接關閉此視窗即可安全結束運行。
echo ==========================================================
echo.

timeout /t 3 >nul 2>&1
start http://localhost:4173

call npm run preview -- --port 4173 --host 0.0.0.0
pause
exit

:DEV_MODE
echo.
echo ⚠️ 警告：系統直接編譯失敗，將嘗試使用萬用「開發者模式」啟動。
echo 正在啟動本地開發者服務伺服器...
echo 🔗 首頁網址：http://localhost:3000
echo ==========================================================
echo.
timeout /t 3 >nul 2>&1
start http://localhost:3000
call npm run dev
pause
exit
