import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/financeiro/contas-pagar/[id]/pagar
 * Marca uma conta como paga
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const { id } = params;
        const body = await req.json();
        const { dataPagamento } = body;

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

        // Marcar como paga
        const contaAtualizada = await prisma.contaPagar.update({
            where: { id },
            data: {
                status: 'pago',
                dataPagamento: dataPagamento ? new Date(dataPagamento) : new Date(),
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
            message: "Conta marcada como paga",
        });
    } catch (error) {
        console.error("[API] Error marking conta as paid:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao marcar conta como paga" },
            { status: 500 }
        );
    }
}
