@echo off
chcp 65001 >nul
cd /d E:\news-platform
echo [%date% %time%] 开始抓取 >> collect.log
node -e "require('./src/collect').run().then(r=>{console.log(JSON.stringify(r));process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})" >> collect.log 2>&1
echo [%date% %time%] 完成 >> collect.log
