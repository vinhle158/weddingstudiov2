@echo off
title Khoi chay Studio V2 Local
echo ==================================================
echo   KHOI CHAY / CAP NHAT STUDIO V2 LOCALLY VIA DOCKER
echo ==================================================
echo.
echo Dang build va khoi dong container Docker...
docker compose -f docker-compose.prod.yml up -d --build
echo.
echo ==================================================
echo   KHOI CHAY THANH CONG!
echo   Moi ban truy cap dia chi: http://localhost:3005
echo ==================================================
echo.
pause
