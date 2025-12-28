@echo off
echo 🚀 Starting Task Management System with Keycloak...
echo.

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down

REM Remove old volumes to ensure fresh start
echo 🗑️  Cleaning up old data...
docker volume rm task-management-app_mysql_data 2>nul

REM Start all services
echo 🔄 Starting all services...
docker-compose up -d

echo.
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

echo.
echo 🎉 Services started! Access points:
echo 📱 Frontend: http://localhost:8080
echo 🔐 Keycloak Admin: http://localhost:8081 (admin/admin123)
echo 🔧 Backend API: http://localhost:8080/api
echo.
echo 📋 User Management:
echo    - Create users through Keycloak admin console (localhost:8081)
echo    - Or use the Admin Panel user creation feature
echo    - Users will be automatically synced between Keycloak and database
echo.
echo 🔍 Check container status:
echo    docker-compose ps
echo.
echo 📜 View logs:
echo    docker-compose logs -f [service-name]
echo.
echo 🛑 Stop all services:
echo    docker-compose down

pause