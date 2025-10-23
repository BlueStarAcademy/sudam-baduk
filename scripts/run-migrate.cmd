@echo off
setlocal

REM Load environment variables from .env file
for /f "tokens=*" %%a in ('.env') do (
    for /f "tokens=1* delims==" %%b in ("%%a") do (
        set "%%b=%%c"
    )
)

REM Execute the migration script with tsx
node --experimental-specifier-resolution=node --import tsx scripts/migrate-sqlite-to-postgres.ts
