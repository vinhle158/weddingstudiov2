@echo off
title Push Studio V2 to Docker Hub
echo ==================================================
echo   DONG GOI VA DAY IMAGE STUDIO V2 LEN DOCKER HUB
echo ==================================================
echo.
echo 1. Dang thuc hien build ung dung...
docker compose -f docker-compose.prod.yml build
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Qua trinh build that bai!
    goto end
)

echo.
echo 2. Dang gan the (tag) image cho tai khoan vinhle158...
docker tag studiov2-app:latest vinhle158/studiov2-app:latest
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Gan the image that bai!
    goto end
)

echo.
echo 3. Dang day (push) Image len Docker Hub...
docker push vinhle158/studiov2-app:latest
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Day image len Docker Hub that bai!
    echo Vui long kiem tra ban da dang nhap Docker Desktop chua.
    goto end
)

echo.
echo ==================================================
echo   DAY IMAGE LEN DOCKER HUB THANH CONG!
echo   Repository: vinhle158/studiov2-app:latest
echo ==================================================
echo.

:end
pause
