$env:PGPASSWORD = "1234"
$pg_dumpall = "C:\Program Files\PostgreSQL\18\bin\pg_dumpall.exe"
$outputFile = "backup_completo.sql"

Write-Host "Iniciando exportação COMPLETA do cluster PostgreSQL..." -ForegroundColor Cyan
Write-Host "Este processo pode demorar muito devido ao tamanho da base de dados (estimativa: 13+ GB)." -ForegroundColor Yellow
Write-Host "Por favor, aguarde até a mensagem de conclusão aparecer..." -ForegroundColor Yellow

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Executando pg_dumpall diretamente para o arquivo para preservar o encoding UTF-8
& "$pg_dumpall" -U postgres -f "$outputFile"

$stopwatch.Stop()

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nExportação finalizada com sucesso em $($stopwatch.Elapsed.Minutes) minutos e $($stopwatch.Elapsed.Seconds) segundos!" -ForegroundColor Green
    
    $fileInfo = Get-Item $outputFile
    $sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    $sizeGB = [math]::Round($fileInfo.Length / 1GB, 2)
    
    Write-Host "Arquivo gerado: $outputFile" -ForegroundColor Cyan
    Write-Host "Tamanho do arquivo: $sizeGB GB ($sizeMB MB)" -ForegroundColor Magenta
    Write-Host "`nInstruções finais:" -ForegroundColor Yellow
    Write-Host "1. Clique com o botão direito no arquivo 'backup_completo.sql' e compacte (Adicionar para .zip ou .rar) para que ele fique muito menor."
    Write-Host "2. Suba o arquivo compactado para o seu Google Drive ou coloque em um Pendrive de grande capacidade."
} else {
    Write-Host "`nHouve um erro durante a exportação." -ForegroundColor Red
}
