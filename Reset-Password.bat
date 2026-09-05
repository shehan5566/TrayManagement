@echo off
title Reset Nelna System Password
echo =======================================================
echo         NELNA TRAY SYSTEM - PASSWORD RESET
echo =======================================================
echo.
echo Resetting the admin password...
echo.

node reset_admin.js

echo.
echo =======================================================
echo If you saw "Connected to MongoDB" and "Admin password reset",
echo then your password has been successfully reset to: admin123
echo =======================================================
echo.
pause
