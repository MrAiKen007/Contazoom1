# Guia de Configuração do Banco de Dados

## Problema: Connection Pool Timeout

Se você está vendo erros como:

```
Timed out fetching a new connection from the connection pool
Current connection pool timeout: 10
Connection limit: 9
```

## Solução

### Opção 1: Modificar DATABASE_URL (Recomendado para Produção)

No arquivo `.env`, adicione parâmetros de pool à sua URL de conexão:

```env
# Antes (exemplo):
DATABASE_URL="postgresql://user:pass@host:5432/contazoom?schema=public"

# Depois (adicionar parâmetros):
DATABASE_URL="postgresql://user:pass@host:5432/contazoom?schema=public&connection_limit=20&pool_timeout=20"
```

**Parâmetros**:

- `connection_limit=20` - Aumenta pool de 9 para 20 conexões
- `pool_timeout=20` - Aumenta timeout de 10s para 20s

### Opção 2: Usar Variáveis Separadas

Se preferir, pode configurar separadamente:

```env
DATABASE_URL="postgresql://user:pass@host:5432/contazoom?schema=public"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_POOL_TIMEOUT=20
```

## Configurações Recomendadas por Ambiente

### Desenvolvimento Local

```env
DATABASE_URL="postgresql://localhost:5432/contazoom?connection_limit=10&pool_timeout=15"
```

### Produção (Render/Vercel)

```env
DATABASE_URL="postgresql://host:5432/db?connection_limit=20&pool_timeout=20&connect_timeout=10"
```

### Produção com Alto Volume

```env
DATABASE_URL="postgresql://host:5432/db?connection_limit=50&pool_timeout=30&connect_timeout=15"
```

## Verificar Configuração Atual

Execute no terminal:

```bash
node -e "console.log(process.env.DATABASE_URL)"
```

## Troubleshooting

### Erro persiste após mudanças

1. Parar servidor: `Ctrl+C`
2. Limpar cache: `Remove-Item -Path ".next" -Recurse -Force`
3. Reiniciar: `npm run dev`

### Muitas conexões abertas

- Verificar se há loops infinitos
- Verificar se conexões estão sendo fechadas
- Reduzir concorrência na sincronização

### Banco de dados lento

- Adicionar índices nas tabelas
- Otimizar queries
- Aumentar recursos do servidor de banco

## Monitoramento

Para monitorar uso de conexões, adicione ao código:

```typescript
console.log('Pool status:', await prisma.$metrics.json());
```

## Mais Informações

- [Prisma Connection Pool](http://pris.ly/d/connection-pool)
- [PostgreSQL Connection Limits](https://www.postgresql.org/docs/current/runtime-config-connection.html)
