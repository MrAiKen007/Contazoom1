import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/contas-receber
 * Lista contas a receber com filtros
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
        const tipoData = searchParams.get("tipoData") || "vencimento"; // vencimento | recebimento

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

        // Filtro de data
        if (dataInicio && dataFim) {
            const inicio = new Date(dataInicio);
            const fim = new Date(dataFim);

            if (tipoData === "recebimento") {
                where.dataRecebimento = {
                    gte: inicio,
                    lte: fim,
                };
            } else {
                where.dataVencimento = {
                    gte: inicio,
                    lte: fim,
                };
            }
        }

        const contasReceber = await prisma.contaReceber.findMany({
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
            total: contasReceber.reduce((sum, c) => sum + Number(c.valor), 0),
            pendente: contasReceber
                .filter(c => c.status === 'pendente')
                .reduce((sum, c) => sum + Number(c.valor), 0),
            recebido: contasReceber
                .filter(c => c.status === 'recebido')
                .reduce((sum, c) => sum + Number(c.valor), 0),
            vencido: contasReceber
                .filter(c => c.status === 'pendente' && new Date(c.dataVencimento) < new Date())
                .reduce((sum, c) => sum + Number(c.valor), 0),
        };

        return NextResponse.json({
            ok: true,
            data: contasReceber,
            totais,
        });
    } catch (error) {
        console.error("[API] Error fetching contas receber:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar contas a receber" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/financeiro/contas-receber
 * Cria uma nova conta a receber
 */
export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const body = await req.json();
        const {
            descricao,
            valor,
            dataVencimento,
            dataRecebimento,
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

        // Criar conta a receber
        const contaReceber = await prisma.contaReceber.create({
            data: {
                userId: session.sub,
                descricao: descricao.trim(),
                valor: Number(valor),
                dataVencimento: new Date(dataVencimento),
                dataRecebimento: dataRecebimento ? new Date(dataRecebimento) : null,
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
            data: contaReceber,
        }, { status: 201 });
    } catch (error) {
        console.error("[API] Error creating conta receber:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao criar conta a receber" },
            { status: 500 }
        );
    }
}
