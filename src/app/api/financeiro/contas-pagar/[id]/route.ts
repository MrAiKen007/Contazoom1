import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PUT /api/financeiro/contas-pagar/[id]
 * Atualiza uma conta a pagar existente
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { id } = params;
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
        } = body;

        // Verificar se conta existe e pertence ao usuário
        const contaExistente = await prisma.contaPagar.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!contaExistente) {
            return NextResponse.json(
                { ok: false, error: "Conta a pagar não encontrada" },
                { status: 404 }
            );
        }

        // Validações
        if (descricao !== undefined && (!descricao || descricao.trim().length === 0)) {
            return NextResponse.json(
                { ok: false, error: "Descrição não pode ser vazia" },
                { status: 400 }
            );
        }

        if (valor !== undefined && Number(valor) <= 0) {
            return NextResponse.json(
                { ok: false, error: "Valor deve ser maior que zero" },
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

        // Atualizar conta a pagar
        const contaAtualizada = await prisma.contaPagar.update({
            where: { id },
            data: {
                ...(descricao !== undefined && { descricao: descricao.trim() }),
                ...(historico !== undefined && { historico: historico?.trim() || null }),
                ...(valor !== undefined && { valor: Number(valor) }),
                ...(dataVencimento !== undefined && { dataVencimento: new Date(dataVencimento) }),
                ...(dataPagamento !== undefined && { dataPagamento: dataPagamento ? new Date(dataPagamento) : null }),
                ...(dataCompetencia !== undefined && { dataCompetencia: dataCompetencia ? new Date(dataCompetencia) : null }),
                ...(categoriaId !== undefined && { categoriaId }),
                ...(formaPagamentoId !== undefined && { formaPagamentoId }),
                ...(status !== undefined && { status }),
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
            data: contaAtualizada,
        });
    } catch (error) {
        console.error("[API] Error updating conta pagar:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao atualizar conta a pagar" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/financeiro/contas-pagar/[id]
 * Deleta uma conta a pagar
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { id } = params;

        // Verificar se conta existe e pertence ao usuário
        const conta = await prisma.contaPagar.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!conta) {
            return NextResponse.json(
                { ok: false, error: "Conta a pagar não encontrada" },
                { status: 404 }
            );
        }

        // Deletar conta
        await prisma.contaPagar.delete({
            where: { id },
        });

        return NextResponse.json({
            ok: true,
            message: "Conta a pagar deletada com sucesso",
        });
    } catch (error) {
        console.error("[API] Error deleting conta pagar:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao deletar conta a pagar" },
            { status: 500 }
        );
    }
}
