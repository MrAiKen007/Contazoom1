import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PUT /api/financeiro/formas-pagamento/[id]
 * Atualiza uma forma de pagamento existente
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
        const { nome, descricao, tipo, ativo } = body;

        // Verificar se forma de pagamento existe e pertence ao usuário
        const formaPagamentoExistente = await prisma.formaPagamento.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!formaPagamentoExistente) {
            return NextResponse.json(
                { ok: false, error: "Forma de pagamento não encontrada" },
                { status: 404 }
            );
        }

        // Validações
        if (nome !== undefined && (!nome || nome.trim().length === 0)) {
            return NextResponse.json(
                { ok: false, error: "Nome não pode ser vazio" },
                { status: 400 }
            );
        }

        // Verificar duplicação de nome (se estiver mudando o nome)
        if (nome && nome.trim() !== formaPagamentoExistente.nome) {
            const duplicada = await prisma.formaPagamento.findFirst({
                where: {
                    userId: session.sub,
                    nome: nome.trim(),
                    ativo: true,
                    id: { not: id },
                },
            });

            if (duplicada) {
                return NextResponse.json(
                    { ok: false, error: "Já existe uma forma de pagamento com este nome" },
                    { status: 409 }
                );
            }
        }

        // Atualizar forma de pagamento
        const formaPagamentoAtualizada = await prisma.formaPagamento.update({
            where: { id },
            data: {
                ...(nome !== undefined && { nome: nome.trim() }),
                ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
                ...(tipo !== undefined && { tipo: tipo?.trim() || null }),
                ...(ativo !== undefined && { ativo }),
            },
        });

        return NextResponse.json({
            ok: true,
            data: formaPagamentoAtualizada,
        });
    } catch (error) {
        console.error("[API] Error updating forma pagamento:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao atualizar forma de pagamento" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/financeiro/formas-pagamento/[id]
 * Deleta uma forma de pagamento (soft delete - marca como inativa)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { id } = params;

        // Verificar se forma de pagamento existe e pertence ao usuário
        const formaPagamento = await prisma.formaPagamento.findFirst({
            where: {
                id,
                userId: session.sub,
            },
            include: {
                _count: {
                    select: {
                        contasPagar: true,
                        contasReceber: true,
                    },
                },
            },
        });

        if (!formaPagamento) {
            return NextResponse.json(
                { ok: false, error: "Forma de pagamento não encontrada" },
                { status: 404 }
            );
        }

        // Verificar se tem contas associadas
        const temContas = formaPagamento._count.contasPagar > 0 || formaPagamento._count.contasReceber > 0;

        if (temContas) {
            // Soft delete - apenas marca como inativa
            await prisma.formaPagamento.update({
                where: { id },
                data: { ativo: false },
            });

            return NextResponse.json({
                ok: true,
                message: "Forma de pagamento desativada (possui contas associadas)",
            });
        }

        // Se não tem contas, pode deletar permanentemente
        await prisma.formaPagamento.delete({
            where: { id },
        });

        return NextResponse.json({
            ok: true,
            message: "Forma de pagamento deletada com sucesso",
        });
    } catch (error) {
        console.error("[API] Error deleting forma pagamento:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao deletar forma de pagamento" },
            { status: 500 }
        );
    }
}
