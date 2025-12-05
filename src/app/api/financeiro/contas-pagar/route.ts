import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/contas-pagar
 * Lista contas a pagar com filtros
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const categoriaId = searchParams.get("categoriaId");
        const formaPagamentoId = searchParams.get("formaPagamentoId");
        const dataInicio = searchParams.get("dataInicio");
        const dataFim = searchParams.get("dataFim");
        const tipoData = searchParams.get("tipoData") || "vencimento"; // vencimento | pagamento | competencia

        // Construir filtros
        const where: any = {
            userId: session.sub,
        };

        if (status) {
            where.status = status;
        }

        if (categoriaId) {
            where.categoriaId = categoriaId;
        }

        if (formaPagamentoId) {
            where.formaPagamentoId = formaPagamentoId;
        }

        // Filtro de data baseado no tipo
        if (dataInicio && dataFim) {
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);

            if (tipoData === "pagamento") {
                where.dataPagamento = {
                    gte: inicio,
                    lte: fim,
                };
            } else if (tipoData === "competencia") {
                where.dataCompetencia = {
                    gte: inicio,
                    lte: fim,
                };
            } else {
                // vencimento (padrão)
                where.dataVencimento = {
                    gte: inicio,
                    lte: fim,
                };
            }
        }

        const contasPagar = await prisma.contaPagar.findMany({
            where,
            include: {
                categoria: {
                    select: {
                        id: true,
                        nome: true,
                        tipo: true,
                    },
                },
                formaPagamento: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
            orderBy: {
                dataVencimento: 'asc',
            },
        });

        // Calcular totais
        const totais = {
            total: contasPagar.reduce((sum, c) => sum + Number(c.valor), 0),
            pendente: contasPagar
                .filter(c => c.status === 'pendente')
                .reduce((sum, c) => sum + Number(c.valor), 0),
            pago: contasPagar
                .filter(c => c.status === 'pago')
                .reduce((sum, c) => sum + Number(c.valor), 0),
            vencido: contasPagar
                .filter(c => c.status === 'pendente' && new Date(c.dataVencimento) < new Date())
                .reduce((sum, c) => sum + Number(c.valor), 0),
        };

        return NextResponse.json({
            ok: true,
            data: contasPagar,
            totais,
        });
    } catch (error) {
        console.error("[API] Error fetching contas pagar:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar contas a pagar" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/financeiro/contas-pagar
 * Cria uma nova conta a pagar
 */
export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const body = await req.json();
        const {
            descricao,
            historico,
            valor,
            dataVencimento,
            dataPagamento,
            dataCompetencia,
            categoriaId,
            formaPagamentoId,
            status,
            blingId,
        } = body;

        // Validações
        if (!descricao || descricao.trim().length === 0) {
            return NextResponse.json(
                { ok: false, error: "Descrição é obrigatória" },
                { status: 400 }
            );
        }

        if (!valor || Number(valor) <= 0) {
            return NextResponse.json(
                { ok: false, error: "Valor deve ser maior que zero" },
                { status: 400 }
            );
        }

        if (!dataVencimento) {
            return NextResponse.json(
                { ok: false, error: "Data de vencimento é obrigatória" },
                { status: 400 }
            );
        }

        // Verificar se categoria existe (se informada)
        if (categoriaId) {
            const categoria = await prisma.categoria.findFirst({
                where: {
                    id: categoriaId,
                    userId: session.sub,
                },
            });

            if (!categoria) {
                return NextResponse.json(
                    { ok: false, error: "Categoria não encontrada" },
                    { status: 404 }
                );
            }
        }

        // Verificar se forma de pagamento existe (se informada)
        if (formaPagamentoId) {
            const formaPagamento = await prisma.formaPagamento.findFirst({
                where: {
                    id: formaPagamentoId,
                    userId: session.sub,
                },
            });

            if (!formaPagamento) {
                return NextResponse.json(
                    { ok: false, error: "Forma de pagamento não encontrada" },
                    { status: 404 }
                );
            }
        }

        // Criar conta a pagar
        const contaPagar = await prisma.contaPagar.create({
            data: {
                userId: session.sub,
                descricao: descricao.trim(),
                historico: historico?.trim() || null,
                valor: Number(valor),
                dataVencimento: new Date(dataVencimento),
                dataPagamento: dataPagamento ? new Date(dataPagamento) : null,
                dataCompetencia: dataCompetencia ? new Date(dataCompetencia) : null,
                categoriaId: categoriaId || null,
                formaPagamentoId: formaPagamentoId || null,
                status: status || 'pendente',
                origem: 'MANUAL',
                blingId: blingId || null,
            },
            include: {
                categoria: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                formaPagamento: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });

        return NextResponse.json({
            ok: true,
            data: contaPagar,
        }, { status: 201 });
    } catch (error) {
        console.error("[API] Error creating conta pagar:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao criar conta a pagar" },
            { status: 500 }
        );
    }
}
