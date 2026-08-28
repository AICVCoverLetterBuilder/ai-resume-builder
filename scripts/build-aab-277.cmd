@echo off
cd /d c:\Users\Q\Desktop\ai-cv-cover-letter-builder
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo JAVA_HOME=%JAVA_HOME%
"%JAVA_HOME%\bin\java.exe" -version
call android\gradlew.bat -p android clean :app:bundleRelease
echo GRADLE_EXIT=%ERRORLEVEL%
exit /b %ERRORLEVEL%
