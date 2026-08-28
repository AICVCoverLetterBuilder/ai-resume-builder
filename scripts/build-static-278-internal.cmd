@echo off
cd /d c:\Users\Q\Desktop\ai-cv-cover-letter-builder
set "NEXT_PUBLIC_BUILD_CHANNEL=internal"
set "NEXT_PUBLIC_ENABLE_AI_TEST_RESET=true"
set "NEXT_PUBLIC_STATIC_EXPORT=true"
echo CHANNEL=%NEXT_PUBLIC_BUILD_CHANNEL% RESET=%NEXT_PUBLIC_ENABLE_AI_TEST_RESET%
if exist .next rmdir /s /q .next
if exist out rmdir /s /q out
if exist android\app\src\main\assets\public rmdir /s /q android\app\src\main\assets\public
if exist android\app\build\outputs\bundle\release\app-release.aab del /f /q android\app\build\outputs\bundle\release\app-release.aab
call npm.cmd run build:static
echo EXIT=%ERRORLEVEL%
exit /b %ERRORLEVEL%
