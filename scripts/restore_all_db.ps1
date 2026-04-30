$env:PGPASSWORD = "1234"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$inputFile = "backup_completo.sql"

if (-not (Test-Path $inputFile)) {
    Write-Host "ERRO: Arquivo $inputFile não encontrado!" -ForegroundColor Red
    Write-Host "Certifique-se de que você descompactou o arquivo e o colocou na pasta raiz deste projeto." -ForegroundColor Yellow
    exit
}

Write-Host "Iniciando restauração COMPLETA do cluster PostgreSQL..." -ForegroundColor Cyan
Write-Host "Isso recriará todos os bancos de dados (beberibe, postgres, etc), papéis (roles) e tabelas." -ForegroundColor Yellow
Write-Host "Por favor, aguarde..." -ForegroundColor Yellow

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Executando psql para ler o arquivo SQL bruto
& "$psql" -U postgres -f "$inputFile"

$stopwatch.Stop()

if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1 -or $LASTEXITCODE -eq 3) {
    # psql pode retornar exit codes diferentes se houver "erros" de NOTICE ou objetos que já existem.
    Write-Host "`nRestauração finalizada em $($stopwatch.Elapsed.Minutes) minutos e $($stopwatch.Elapsed.Seconds) segundos!" -ForegroundColor Green
    Write-Host "O novo computador agora possui cópia idêntica do seu banco de dados." -ForegroundColor Cyan
} else {
    Write-Host "`nHouve um erro durante a restauração. Verifique o console." -ForegroundColor Red
}
