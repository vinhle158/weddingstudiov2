@echo off
chcp 65001 >nul
title Khởi chạy Studio V2 trên máy local

echo ==================================================
echo   KHỞI CHẠY STUDIO V2 TRÊN MÁY LOCAL
echo ==================================================
echo.

if not exist .env (
    echo [LỖI] Chưa có file .env.
    echo Hãy sao chép .env.example thành .env và điền cấu hình local.
    goto ket_thuc
)

echo [1/4] Khởi động PostgreSQL local...
docker compose -f docker-compose.yml up -d postgres
if %errorlevel% neq 0 goto loi

echo [2/4] Cài đặt dependency theo package-lock.json...
call npm ci
if %errorlevel% neq 0 goto loi

echo [3/4] Áp dụng Prisma migration...
call npx prisma migrate deploy
if %errorlevel% neq 0 goto loi

echo [4/4] Khởi động ứng dụng ở chế độ phát triển...
call npm run dev
goto ket_thuc

:loi
echo.
echo [LỖI] Không thể khởi chạy Studio V2. Hãy đọc thông báo phía trên.

:ket_thuc
echo.
pause
