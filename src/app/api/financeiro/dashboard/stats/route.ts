import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/dashboard/stats
 * Retorna estatísticas financeiras agregadas
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { searchParams } = new URL(req.url);
        const dataInicio = searchParams.get("dataInicio");
        const dataFim = searchParams.get("dataFim");
        const tipo = searchParams.get("tipo") || "caixa"; // caixa | competencia

        // Definir período padrão (mês atual)
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

        const inicio = dataInicio ? new Date(dataInicio) : inicioMes;
        const fim = dataFim ? new Date(dataFim) : fimMes;

        // Buscar contas a pagar
        const contasPagar = await prisma.contaPagar.findMany({
            where: {
                userId: session.sub,
                ...(tipo === "caixa"
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
        });

        // Buscar contas a receber
        const contasReceber = await prisma.contaReceber.findMany({
            where: {
                userId: session.sub,
                ...(tipo === "caixa"
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
        });

        // Calcular totais de receitas
        const receitasPagas = contasReceber
            .filter(c => c.status === 'recebido')
            .reduce((sum, c) => sum + Number(c.valor), 0);

        const receitasPendentes = contasReceber
            .filter(c => c.status === 'pendente')
            .reduce((sum, c) => sum + Number(c.valor), 0);

        const totalReceitas = receitasPagas + receitasPendentes;

        // Calcular totais de despesas
        const despesasPagas = contasPagar
            .filter(c => c.status === 'pago')
            .reduce((sum, c) => sum + Number(c.valor), 0);

        const despesasPendentes = contasPagar
            .filter(c => c.status === 'pendente')
            .reduce((sum, c) => sum + Number(c.valor), 0);

        const totalDespesas = despesasPagas + despesasPendentes;

        // Calcular saldo
        const saldo = totalReceitas - totalDespesas;

        // Contas vencidas
        const contasPagarVencidas = contasPagar.filter(
            c => c.status === 'pendente' && new Date(c.dataVencimento) < hoje
        );

        const contasReceberVencidas = contasReceber.filter(
            c => c.status === 'pendente' && new Date(c.dataVencimento) < hoje
        );

        return NextResponse.json({
            ok: true,
            data: {
                totalReceitas,
                totalDespesas,
                saldo,
                receitasPagas,
                receitasPendentes,
                despesasPagas,
                despesasPendentes,
                contasPagar: contasPagar.map(c => ({
                    id: c.id,
                    descricao: c.descricao,
                    valor: Number(c.valor),
                    dataVencimento: c.dataVencimento,
                    status: c.status,
                })),
                contasReceber: contasReceber.map(c => ({
                    id: c.id,
                    descricao: c.descricao,
                    valor: Number(c.valor),
                    dataVencimento: c.dataVencimento,
                    status: c.status,
                })),
                vencidas: {
                    pagar: contasPagarVencidas.length,
                    receber: contasReceberVencidas.length,
                    valorPagar: contasPagarVencidas.reduce((sum, c) => sum + Number(c.valor), 0),
                    valorReceber: contasReceberVencidas.reduce((sum, c) => sum + Number(c.valor), 0),
                },
            },
        });
    } catch (error) {
        console.error("[API] Error fetching financial stats:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar estatísticas financeiras" },
            { status: 500 }
        );
    }
}
