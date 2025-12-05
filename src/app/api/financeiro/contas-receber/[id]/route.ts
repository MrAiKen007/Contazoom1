import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PUT /api/financeiro/contas-receber/[id]
 * Atualiza uma conta a receber existente
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
            valor,
            dataVencimento,
            dataRecebimento,
            categoriaId,
            formaPagamentoId,
            status,
        } = body;

        // Verificar se conta existe e pertence ao usuário
        const contaExistente = await prisma.contaReceber.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!contaExistente) {
            return NextResponse.json(
                { ok: false, error: "Conta a receber não encontrada" },
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

        // Atualizar conta a receber
        const contaAtualizada = await prisma.contaReceber.update({
            where: { id },
            data: {
                ...(descricao !== undefined && { descricao: descricao.trim() }),
                ...(valor !== undefined && { valor: Number(valor) }),
                ...(dataVencimento !== undefined && { dataVencimento: new Date(dataVencimento) }),
                ...(dataRecebimento !== undefined && { dataRecebimento: dataRecebimento ? new Date(dataRecebimento) : null }),
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
        console.error("[API] Error updating conta receber:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao atualizar conta a receber" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/financeiro/contas-receber/[id]
 * Deleta uma conta a receber
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
        const conta = await prisma.contaReceber.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!conta) {
            return NextResponse.json(
                { ok: false, error: "Conta a receber não encontrada" },
                { status: 404 }
            );
        }

        // Deletar conta
        await prisma.contaReceber.delete({
            where: { id },
        });

        return NextResponse.json({
            ok: true,
            message: "Conta a receber deletada com sucesso",
        });
    } catch (error) {
        console.error("[API] Error deleting conta receber:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao deletar conta a receber" },
            { status: 500 }
        );
    }
}
