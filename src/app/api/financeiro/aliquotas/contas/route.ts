import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/aliquotas/contas
 * Lista contas únicas com alíquotas cadastradas
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        // Buscar todas as alíquotas ativas
        const aliquotas = await prisma.aliquotaImposto.findMany({
            where: {
                userId: session.sub,
                ativo: true,
            },
            select: {
                conta: true,
            },
            distinct: ['conta'],
            orderBy: {
                conta: 'asc',
            },
        });

        // Extrair lista de contas únicas
        const contas = aliquotas.map(a => a.conta);

        return NextResponse.json({
            ok: true,
            data: contas,
        });
    } catch (error) {
        console.error("[API] Error fetching contas:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar contas" },
            { status: 500 }
        );
    }
}
