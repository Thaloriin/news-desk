@echo off
chcp 65001 >nul
cd /d E:\news-platform
echo ============================================
echo  全球新闻台
echo  启动后浏览器打开 http://localhost:8787
echo  关闭这个窗口即停止服务
echo ============================================
node server.js
pause
