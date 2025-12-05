import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PUT /api/financeiro/categorias/[id]
 * Atualiza uma categoria existente
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
        const { nome, descricao, tipo, categoriaPaiId, ativo } = body;

        // Verificar se categoria existe e pertence ao usuário
        const categoriaExistente = await prisma.categoria.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!categoriaExistente) {
            return NextResponse.json(
                { ok: false, error: "Categoria não encontrada" },
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

        if (tipo && !['receita', 'despesa'].includes(tipo)) {
            return NextResponse.json(
                { ok: false, error: "Tipo deve ser 'receita' ou 'despesa'" },
                { status: 400 }
            );
        }

        // Verificar se categoria pai existe (se informada)
        if (categoriaPaiId) {
            // Não pode ser pai de si mesma
            if (categoriaPaiId === id) {
                return NextResponse.json(
                    { ok: false, error: "Categoria não pode ser pai de si mesma" },
                    { status: 400 }
                );
            }

            const categoriaPai = await prisma.categoria.findFirst({
                where: {
                    id: categoriaPaiId,
                    userId: session.sub,
                },
            });

            if (!categoriaPai) {
                return NextResponse.json(
                    { ok: false, error: "Categoria pai não encontrada" },
                    { status: 404 }
                );
            }
        }

        // Atualizar categoria
        const categoriaAtualizada = await prisma.categoria.update({
            where: { id },
            data: {
                ...(nome !== undefined && { nome: nome.trim() }),
                ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
                ...(tipo !== undefined && { tipo }),
                ...(categoriaPaiId !== undefined && { categoriaPaiId }),
                ...(ativo !== undefined && { ativo }),
            },
            include: {
                categoriaPai: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
                subCategorias: {
                    select: {
                        id: true,
                        nome: true,
                    },
                    where: {
                        ativo: true,
                    },
                },
            },
        });

        return NextResponse.json({
            ok: true,
            data: categoriaAtualizada,
        });
    } catch (error) {
        console.error("[API] Error updating categoria:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao atualizar categoria" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/financeiro/categorias/[id]
 * Deleta uma categoria (soft delete - marca como inativa)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { id } = params;

        // Verificar se categoria existe e pertence ao usuário
        const categoria = await prisma.categoria.findFirst({
            where: {
                id,
                userId: session.sub,
            },
            include: {
                _count: {
                    select: {
                        contasPagar: true,
                        contasReceber: true,
                        subCategorias: true,
                    },
                },
            },
        });

        if (!categoria) {
            return NextResponse.json(
                { ok: false, error: "Categoria não encontrada" },
                { status: 404 }
            );
        }

        // Verificar se tem contas associadas
        const temContas = categoria._count.contasPagar > 0 || categoria._count.contasReceber > 0;

        if (temContas) {
            // Soft delete - apenas marca como inativa
            await prisma.categoria.update({
                where: { id },
                data: { ativo: false },
            });

            return NextResponse.json({
                ok: true,
                message: "Categoria desativada (possui contas associadas)",
            });
        }

        // Se não tem contas, pode deletar permanentemente
        await prisma.categoria.delete({
            where: { id },
        });

        return NextResponse.json({
            ok: true,
            message: "Categoria deletada com sucesso",
        });
    } catch (error) {
        console.error("[API] Error deleting categoria:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao deletar categoria" },
            { status: 500 }
        );
    }
}
