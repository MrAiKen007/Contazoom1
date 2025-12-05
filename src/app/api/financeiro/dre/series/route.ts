import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/dre/series
 * Retorna dados completos para DRE (Demonstrativo de Resultados)
 * Integra dados de vendas ML/Shopee + contas financeiras
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { searchParams } = new URL(req.url);
        const mesesParam = searchParams.get("meses"); // "2025-01,2025-02,2025-03"
        const categoriasParam = searchParams.get("categorias"); // IDs separados por vírgula
        const tipo = searchParams.get("tipo") || "caixa"; // caixa | competencia

        if (!mesesParam) {
            return NextResponse.json(
                { ok: false, error: "Parâmetro 'meses' é obrigatório" },
                { status: 400 }
            );
        }

        // Parse meses
        const mesesKeys = mesesParam.split(",");
        const months = mesesKeys.map(key => {
            const [ano, mes] = key.split("-");
            return {
                key,
                label: `${mes}/${ano}`,
                ano: parseInt(ano),
                mes: parseInt(mes),
            };
        });

        // Parse categorias selecionadas
        const categoriaIds = categoriasParam ? categoriasParam.split(",") : [];

        // Buscar categorias de despesas
        const categorias = await prisma.categoria.findMany({
            where: {
                userId: session.sub,
                tipo: "DESPESA",
                ativo: true,
                ...(categoriaIds.length > 0 && { id: { in: categoriaIds } }),
            },
            select: {
                id: true,
                nome: true,
                descricao: true,
            },
        });

        // Inicializar estruturas de dados
        const receitaBrutaMeliPorMes: Record<string, number> = {};
        const receitaBrutaShopeePorMes: Record<string, number> = {};
        const deducoesMeliPorMes: Record<string, number> = {};
        const deducoesShopeePorMes: Record<string, number> = {};
        const taxasMeliPorMes: Record<string, number> = {};
        const taxasShopeePorMes: Record<string, number> = {};
        const freteMeliPorMes: Record<string, number> = {};
        const freteShopeePorMes: Record<string, number> = {};
        const cmvPorMes: Record<string, number> = {};
        const despesasPorMes: Record<string, number> = {};
        const valoresPorCategoriaMes: Record<string, Record<string, number>> = {};

        // Inicializar todos os meses com zero
        for (const m of months) {
            receitaBrutaMeliPorMes[m.key] = 0;
            receitaBrutaShopeePorMes[m.key] = 0;
            deducoesMeliPorMes[m.key] = 0;
            deducoesShopeePorMes[m.key] = 0;
            taxasMeliPorMes[m.key] = 0;
            taxasShopeePorMes[m.key] = 0;
            freteMeliPorMes[m.key] = 0;
            freteShopeePorMes[m.key] = 0;
            cmvPorMes[m.key] = 0;
            despesasPorMes[m.key] = 0;
        }

        // Inicializar categorias
        for (const cat of categorias) {
            valoresPorCategoriaMes[cat.id] = {};
            for (const m of months) {
                valoresPorCategoriaMes[cat.id][m.key] = 0;
            }
        }

        // Para cada mês, buscar dados
        for (const m of months) {
            const dataInicio = new Date(m.ano, m.mes - 1, 1);
            const dataFim = new Date(m.ano, m.mes, 0, 23, 59, 59);

            // Buscar vendas MercadoLivre
            const vendasMeli = await prisma.meliVenda.findMany({
                where: {
                    userId: session.sub,
                    dataVenda: { gte: dataInicio, lte: dataFim },
                },
            });

            // Buscar vendas Shopee
            const vendasShopee = await prisma.shopeeVenda.findMany({
                where: {
                    userId: session.sub,
                    dataVenda: { gte: dataInicio, lte: dataFim },
                },
            });

            // Processar vendas MercadoLivre
            for (const venda of vendasMeli) {
                const valorTotal = Number(venda.valorTotal || 0);
                const taxaML = Number(venda.taxaML || 0);
                const frete = Number(venda.frete || 0);
                const cmv = Number(venda.cmv || 0);

                receitaBrutaMeliPorMes[m.key] += valorTotal;
                taxasMeliPorMes[m.key] += taxaML;
                freteMeliPorMes[m.key] += frete;
                cmvPorMes[m.key] += cmv;

                // Deduções (vendas canceladas)
                if (venda.status === 'cancelled') {
                    deducoesMeliPorMes[m.key] += valorTotal;
                }
            }

            // Processar vendas Shopee
            for (const venda of vendasShopee) {
                const valorTotal = Number(venda.valorTotal || 0);
                const taxaShopee = Number(venda.taxaShopee || 0);
                const frete = Number(venda.frete || 0);
                const cmv = Number(venda.cmv || 0);

                receitaBrutaShopeePorMes[m.key] += valorTotal;
                taxasShopeePorMes[m.key] += taxaShopee;
                freteShopeePorMes[m.key] += frete;
                cmvPorMes[m.key] += cmv;

                // Deduções (vendas canceladas)
                if (venda.status === 'cancelled') {
                    deducoesShopeePorMes[m.key] += valorTotal;
                }
            }

            // Buscar despesas (contas a pagar) por categoria
            const contasPagar = await prisma.contaPagar.findMany({
                where: {
                    userId: session.sub,
                    ...(tipo === "caixa"
                        ? {
                            OR: [
                                { dataPagamento: { gte: dataInicio, lte: dataFim } },
                                { dataVencimento: { gte: dataInicio, lte: dataFim }, status: 'pendente' }
                            ]
                        }
                        : {
                            dataCompetencia: { gte: dataInicio, lte: dataFim }
                        }
                    ),
                    ...(categoriaIds.length > 0 && { categoriaId: { in: categoriaIds } }),
                },
                include: {
                    categoria: true,
                },
            });

            // Agrupar despesas por categoria
            for (const conta of contasPagar) {
                const valor = Number(conta.valor);
                despesasPorMes[m.key] += valor;

                if (conta.categoriaId && valoresPorCategoriaMes[conta.categoriaId]) {
                    valoresPorCategoriaMes[conta.categoriaId][m.key] += valor;
                }
            }
        }

        // Calcular totais
        const totals = {
            receitaBrutaMeli: Object.values(receitaBrutaMeliPorMes).reduce((a, b) => a + b, 0),
            receitaBrutaShopee: Object.values(receitaBrutaShopeePorMes).reduce((a, b) => a + b, 0),
            receitaBrutaTotal: 0,
            deducoesMeli: Object.values(deducoesMeliPorMes).reduce((a, b) => a + b, 0),
            deducoesShopee: Object.values(deducoesShopeePorMes).reduce((a, b) => a + b, 0),
            deducoesTotal: 0,
            taxasMeli: Object.values(taxasMeliPorMes).reduce((a, b) => a + b, 0),
            taxasShopee: Object.values(taxasShopeePorMes).reduce((a, b) => a + b, 0),
            taxasTotal: 0,
            freteMeli: Object.values(freteMeliPorMes).reduce((a, b) => a + b, 0),
            freteShopee: Object.values(freteShopeePorMes).reduce((a, b) => a + b, 0),
            freteTotal: 0,
            cmv: Object.values(cmvPorMes).reduce((a, b) => a + b, 0),
            despesas: Object.values(despesasPorMes).reduce((a, b) => a + b, 0),
        };

        totals.receitaBrutaTotal = totals.receitaBrutaMeli + totals.receitaBrutaShopee;
        totals.deducoesTotal = totals.deducoesMeli + totals.deducoesShopee;
        totals.taxasTotal = totals.taxasMeli + totals.taxasShopee;
        totals.freteTotal = totals.freteMeli + totals.freteShopee;

        return NextResponse.json({
            months,
            categorias,
            valoresPorCategoriaMes,
            receitaBrutaMeliPorMes,
            receitaBrutaShopeePorMes,
            deducoesMeliPorMes,
            deducoesShopeePorMes,
            taxasMeliPorMes,
            taxasShopeePorMes,
            freteMeliPorMes,
            freteShopeePorMes,
            despesasPorMes,
            cmvPorMes,
            totals,
        });
    } catch (error) {
        console.error("[API] Error fetching DRE series:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar séries do DRE" },
            { status: 500 }
        );
    }
}
