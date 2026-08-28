@echo off
cd /d c:\Users\Q\Desktop\ai-cv-cover-letter-builder
call npx.cmd cap sync android
echo CAP_EXIT=%ERRORLEVEL%
if not exist android\app\src\main\assets\public\index.html (
  echo ANDROID_PUBLIC_MISSING
  exit /b 1
)
echo ANDROID_PUBLIC_OK
call node scripts/verify-internal-ai-reset-assets.mjs --dir android/app/src/main/assets/public --expect enabled
echo VERIFY_EXIT=%ERRORLEVEL%
exit /b %ERRORLEVEL%
