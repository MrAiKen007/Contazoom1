import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PUT /api/financeiro/aliquotas/[id]
 * Atualiza uma alíquota de imposto existente
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
        const { conta, aliquota, dataInicio, dataFim, descricao, ativo } = body;

        // Verificar se alíquota existe e pertence ao usuário
        const aliquotaExistente = await prisma.aliquotaImposto.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!aliquotaExistente) {
            return NextResponse.json(
                { ok: false, error: "Alíquota não encontrada" },
                { status: 404 }
            );
        }

        // Validações
        if (aliquota !== undefined && (Number(aliquota) < 0 || Number(aliquota) > 100)) {
            return NextResponse.json(
                { ok: false, error: "Alíquota deve estar entre 0 e 100" },
                { status: 400 }
            );
        }

        // Atualizar alíquota
        const aliquotaAtualizada = await prisma.aliquotaImposto.update({
            where: { id },
            data: {
                ...(conta !== undefined && { conta: conta.trim() }),
                ...(aliquota !== undefined && { aliquota: Number(aliquota) }),
                ...(dataInicio !== undefined && { dataInicio: new Date(dataInicio) }),
                ...(dataFim !== undefined && { dataFim: new Date(dataFim) }),
                ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
                ...(ativo !== undefined && { ativo }),
            },
        });

        return NextResponse.json({
            ok: true,
            data: aliquotaAtualizada,
        });
    } catch (error) {
        console.error("[API] Error updating aliquota:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao atualizar alíquota" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/financeiro/aliquotas/[id]
 * Deleta uma alíquota de imposto
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { id } = params;

        // Verificar se alíquota existe e pertence ao usuário
        const aliquota = await prisma.aliquotaImposto.findFirst({
            where: {
                id,
                userId: session.sub,
            },
        });

        if (!aliquota) {
            return NextResponse.json(
                { ok: false, error: "Alíquota não encontrada" },
                { status: 404 }
            );
        }

        // Deletar alíquota
        await prisma.aliquotaImposto.delete({
            where: { id },
        });

        return NextResponse.json({
            ok: true,
            message: "Alíquota deletada com sucesso",
        });
    } catch (error) {
        console.error("[API] Error deleting aliquota:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao deletar alíquota" },
            { status: 500 }
        );
    }
}
