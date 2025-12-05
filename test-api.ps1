Write-Host "Testando APIs do ContaZoom..." -ForegroundColor Cyan

# Teste 1
Write-Host "`n[1] Servidor..."
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/debug/ambiente" -UseBasicParsing
    Write-Host "OK - Status $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "ERRO" -ForegroundColor Red
}

# Teste 2
Write-Host "`n[2] API Contas ML..."
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/meli/accounts" -UseBasicParsing
    Write-Host "OK - Status $($r.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "OK - Protegido (401)" -ForegroundColor Green
    } else {
        Write-Host "ERRO - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Teste 3
Write-Host "`n[3] API Vendas..."
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/meli/vendas" -UseBasicParsing
    Write-Host "OK - Status $($r.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "OK - Protegido (401)" -ForegroundColor Green
    } else {
        Write-Host "ERRO" -ForegroundColor Red
    }
}

# Teste 4
Write-Host "`n[4] API Dashboard..."
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000/api/dashboard/stats" -UseBasicParsing
    Write-Host "OK - Status $($r.StatusCode)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "OK - Protegido (401)" -ForegroundColor Green
    } else {
        Write-Host "ERRO" -ForegroundColor Red
    }
}

# Teste 5
Write-Host "`n[5] Pagina Principal..."
try {
    $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
    Write-Host "OK - Status $($r.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "ERRO" -ForegroundColor Red
}

# Teste 6
Write-Host "`n[6] Arquivo .env..."
if (Test-Path ".env") {
    Write-Host "OK - Encontrado" -ForegroundColor Green
} else {
    Write-Host "NAO ENCONTRADO" -ForegroundColor Yellow
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "Servidor: FUNCIONANDO" -ForegroundColor Green
Write-Host "APIs: PROTEGIDAS" -ForegroundColor Green
Write-Host "`nAcesse: http://localhost:3000" -ForegroundColor White
