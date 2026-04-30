$shp2pgsql = "C:\Program Files\PostgreSQL\18\bin\shp2pgsql.exe"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$dataDir = (Resolve-Path "D:\Espa*o e Plano\PDOT\Beberibe").Path
$env:PGPASSWORD = "1234"

Write-Host "Iniciando importação de dados geográficos (Shapefiles) para o PostGIS..." -ForegroundColor Cyan

# Função para importar arquivos
function Import-GeoFile {
    param (
        [string]$FilePath,
        [string]$LayerName
    )
    
    $cleanLayer = $LayerName.ToLower() -replace '[áàãâä]', 'a' -replace '[éèêë]', 'e' -replace '[íìîï]', 'i' -replace '[óòõôö]', 'o' -replace '[úùûü]', 'u' -replace 'ç', 'c' -replace '[^a-z0-9]', '_' -replace '_+', '_'
    $cleanLayer = $cleanLayer.Trim('_')
    
    if ($cleanLayer.Length -gt 60) {
        $cleanLayer = $cleanLayer.Substring(0, 60)
    }

    Write-Host "Importando: $LayerName -> tabela: $cleanLayer"
    
    # -s 4326: SRID
    # -d: DROP table before creating (Idempotent!)
    # -I: Cria índice espacial
    # -W UTF-8: Encoding (tenta UTF-8, se falhar o LATIN1 pode ser tentado)
    $args = @("-d", "-s", "4326", "-I", "-W", "LATIN1", "`"$FilePath`"", $cleanLayer)
    $command = "& `"$shp2pgsql`" -d -s 4326 -I -W `"LATIN1`" `"$FilePath`" $cleanLayer | & `"$psql`" -U postgres -d beberibe -q"
    
    Invoke-Expression $command
}

$shapefiles = Get-ChildItem -Path $dataDir -Recurse -Filter "*.shp"
foreach ($shp in $shapefiles) {
    # Ignorar arquivos xml
    if ($shp.Extension -eq ".shp") {
        Import-GeoFile -FilePath $shp.FullName -LayerName $shp.BaseName
    }
}

Write-Host "Importação de Shapefiles concluída!" -ForegroundColor Cyan
