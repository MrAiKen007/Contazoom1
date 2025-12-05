import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * PATCH /api/financeiro/contas-receber/[id]/receber
 * Marca uma conta como recebida
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
        const { dataRecebimento } = body;

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

        // Marcar como recebida
        const contaAtualizada = await prisma.contaReceber.update({
            where: { id },
            data: {
                status: 'recebido',
                dataRecebimento: dataRecebimento ? new Date(dataRecebimento) : new Date(),
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
            message: "Conta marcada como recebida",
        });
    } catch (error) {
        console.error("[API] Error marking conta as received:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao marcar conta como recebida" },
            { status: 500 }
        );
    }
}
