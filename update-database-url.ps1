# Script para atualizar DATABASE_URL com parâmetros de pool
# Execute: .\update-database-url.ps1

$envFile = ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "Arquivo .env não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "Atualizando DATABASE_URL..." -ForegroundColor Cyan

# Fazer backup
$backupFile = ".env.backup"
Copy-Item $envFile $backupFile -Force
Write-Host "Backup criado: $backupFile" -ForegroundColor Green

# Ler conteúdo
$content = Get-Content $envFile

# Processar linhas
$newContent = @()
foreach ($line in $content) {
    if ($line -match '^DATABASE_URL=') {
        # Extrair URL (remover aspas se existirem)
        $url = $line -replace '^DATABASE_URL=', '' -replace '"', '' -replace "'", ''
        
        # Remover parâmetros antigos
        $url = $url -split '\?' | Select-Object -First 1
        
        # Adicionar novos parâmetros
        $url = $url + "?connection_limit=20&pool_timeout=20&connect_timeout=10"
        
        # Adicionar linha atualizada
        $newContent += "DATABASE_URL=`"$url`""
        
        Write-Host "DATABASE_URL atualizada!" -ForegroundColor Green
    } else {
        $newContent += $line
    }
}

# Salvar
$newContent | Set-Content $envFile -Encoding UTF8

Write-Host ""
Write-Host "Concluído! Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Pare o servidor (Ctrl+C)"
Write-Host "2. Execute: npm run dev"
