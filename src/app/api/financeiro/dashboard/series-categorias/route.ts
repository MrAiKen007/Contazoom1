import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/dashboard/series-categorias
 * Retorna séries temporais de categorias financeiras
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { searchParams } = new URL(req.url);
        const dataInicio = searchParams.get("dataInicio");
        const dataFim = searchParams.get("dataFim");
        const tipo = searchParams.get("tipo") || "despesas"; // despesas | receitas
        const tipoData = searchParams.get("tipoData") || "caixa"; // caixa | competencia

        // Definir período padrão (mês atual)
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

        const inicio = dataInicio ? new Date(dataInicio) : inicioMes;
        const fim = dataFim ? new Date(dataFim) : fimMes;

        // Buscar contas baseado no tipo
        let contas: any[] = [];

        if (tipo === "despesas") {
            contas = await prisma.contaPagar.findMany({
                where: {
                    userId: session.sub,
                    ...(tipoData === "caixa"
                        ? {
                            OR: [
                                { dataPagamento: { gte: inicio, lte: fim } },
                                { dataVencimento: { gte: inicio, lte: fim }, status: 'pendente' }
                            ]
                        }
                        : {
                            dataCompetencia: { gte: inicio, lte: fim }
                        }
                    ),
                },
                include: {
                    categoria: {
                        select: {
                            id: true,
                            nome: true,
                        },
                    },
                },
            });
        } else {
            contas = await prisma.contaReceber.findMany({
                where: {
                    userId: session.sub,
                    ...(tipoData === "caixa"
                        ? {
                            OR: [
                                { dataRecebimento: { gte: inicio, lte: fim } },
                                { dataVencimento: { gte: inicio, lte: fim }, status: 'pendente' }
                            ]
                        }
                        : {
                            dataVencimento: { gte: inicio, lte: fim }
                        }
                    ),
                },
                include: {
                    categoria: {
                        select: {
                            id: true,
                            nome: true,
                        },
                    },
                },
            });
        }

        // Agrupar por categoria
        const categoriaMap = new Map<string, number>();
        const categorias: string[] = [];

        contas.forEach(conta => {
            const categoriaNome = conta.categoria?.nome || "Sem Categoria";
            const valor = Number(conta.valor);

            if (!categoriaMap.has(categoriaNome)) {
                categoriaMap.set(categoriaNome, 0);
                categorias.push(categoriaNome);
            }

            categoriaMap.set(categoriaNome, categoriaMap.get(categoriaNome)! + valor);
        });

        // Construir dados para o gráfico
        const data = categorias.map(categoria => ({
            date: inicio.toISOString().split('T')[0],
            [categoria]: categoriaMap.get(categoria) || 0,
        }));

        // Calcular totais
        const totais = {
            receitas: tipo === "receitas" ? Array.from(categoriaMap.values()).reduce((sum, v) => sum + v, 0) : 0,
            despesas: tipo === "despesas" ? Array.from(categoriaMap.values()).reduce((sum, v) => sum + v, 0) : 0,
            saldo: 0,
        };

        totais.saldo = totais.receitas - totais.despesas;

        return NextResponse.json({
            ok: true,
            series: [],
            categories: categorias,
            data: data,
            totais,
        });
    } catch (error) {
        console.error("[API] Error fetching series categorias:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar séries de categorias" },
            { status: 500 }
        );
    }
}
