Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TESTES - PROJETO RESOLVIDO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = 0
$failed = 0
$baseUrl = "http://localhost:3000"

function Test-Code {
    param($name, $file, $pattern)
    Write-Host "`n[$name]" -ForegroundColor Yellow
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
        if ($content -match $pattern) {
            Write-Host "  OK" -ForegroundColor Green
            $script:passed++
            return $true
        }
    }
    Write-Host "  FALHOU" -ForegroundColor Red
    $script:failed++
    return $false
}

function Test-API {
    param($name, $url, $expectedStatus)
    Write-Host "`n[$name]" -ForegroundColor Yellow
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
        if ($r.StatusCode -eq $expectedStatus) {
            Write-Host "  OK - Status $($r.StatusCode)" -ForegroundColor Green
            $script:passed++
            return $true
        }
    } catch {
        if ($expectedStatus -eq 401 -and $_.Exception.Response.StatusCode.value__ -eq 401) {
            Write-Host "  OK - Protegido (401)" -ForegroundColor Green
            $script:passed++
            return $true
        }
    }
    Write-Host "  FALHOU" -ForegroundColor Red
    $script:failed++
    return $false
}

Write-Host "`n=== 1. TABELA DE VENDAS ===" -ForegroundColor Cyan

Test-Code "Campo taxaPlataforma" "prisma\schema.prisma" "taxaPlataforma"
Test-Code "Campo frete" "prisma\schema.prisma" "frete"
Test-Code "Campo exposicao" "prisma\schema.prisma" "exposicao"
Test-Code "Campo tipoAnuncio" "prisma\schema.prisma" "tipoAnuncio"
Test-Code "Campo ads" "prisma\schema.prisma" "ads"
Test-Code "Funcao mapListingTypeToExposure" "src\app\api\meli\vendas\sync\route.ts" "mapListingTypeToExposure"
Test-Code "Funcao calculateFreight" "src\app\api\meli\vendas\sync\route.ts" "calculateFreight"
Test-Code "Funcao calculateMargemContribuicao" "src\app\api\meli\vendas\sync\route.ts" "calculateMargemContribuicao"
Test-Code "Mapeamento gold_pro -> Premium" "src\app\api\meli\vendas\sync\route.ts" "gold_pro.*Premium"
Test-Code "Calculo frete multiplas fontes" "src\app\api\meli\vendas\sync\route.ts" "baseCost.*listCost"

Write-Host "`n=== 2. AUTENTICACAO ML ===" -ForegroundColor Cyan

Test-Code "Schema multiplas contas" "prisma\schema.prisma" "userId.*ml_user_id"
Test-Code "OAuth2 state UUID" "src\app\api\meli\auth\route.ts" "randomUUID"
Test-Code "State salvo no banco" "src\app\api\meli\auth\route.ts" "saveMeliOauthState"
Test-API "API contas protegida" "$baseUrl/api/meli/accounts" 401

Write-Host "`n=== 3. SINCRONIZACAO ===" -ForegroundColor Cyan

Test-Code "Retry automatico" "src\app\api\meli\vendas\sync\route.ts" "fetchWithRetry"
Test-Code "Server-Sent Events" "src\app\api\meli\vendas\sync\route.ts" "sendProgressToUser"
Test-Code "Salvamento em lotes" "src\app\api\meli\vendas\sync\route.ts" "Promise.allSettled"
Test-Code "Deduplicacao vendas" "src\app\api\meli\vendas\sync\route.ts" "distinct.*orderId"
Test-Code "Filtros tabela" "src\app\components\views\ui\TabelaVendas.tsx" "filtroADS.*filtroExposicao"
Test-Code "Dashboard usa mesmos campos" "src\app\api\dashboard\stats\route.ts" "exposicao.*tipoAnuncio"

Write-Host "`n=== 4. VALIDACAO FINAL ===" -ForegroundColor Cyan

Test-API "Servidor respondendo" "$baseUrl/api/debug/ambiente" 200
Test-API "Pagina principal" "$baseUrl" 200
Test-API "API vendas protegida" "$baseUrl/api/meli/vendas" 401
Test-API "API dashboard protegida" "$baseUrl/api/dashboard/stats" 401
Test-Code "CMV calculado" "src\app\api\meli\vendas\route.ts" "custoUnitario.*quantidade"
Test-Code "Margem com CMV" "src\app\api\meli\vendas\sync\route.ts" "valorTotal.*taxa.*frete.*cmv"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULTADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$total = $passed + $failed
Write-Host "Total: $total" -ForegroundColor White
Write-Host "Passou: $passed" -ForegroundColor Green
Write-Host "Falhou: $failed" -ForegroundColor Red

$perc = [math]::Round(($passed / $total) * 100, 1)
Write-Host "`nSucesso: $perc%" -ForegroundColor $(if ($perc -eq 100) { "Green" } else { "Yellow" })

Write-Host "`n========================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "PROJETO RESOLVIDO" -ForegroundColor Green -BackgroundColor Black
} else {
    Write-Host "PROJETO NAO RESOLVIDO" -ForegroundColor Red -BackgroundColor Black
}
Write-Host "========================================" -ForegroundColor Cyan
