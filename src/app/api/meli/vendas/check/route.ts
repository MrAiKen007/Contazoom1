import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/meli/vendas/check
 * Verifica quantas vendas novas existem (últimas 7 dias)
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        // Calcular data de 7 dias atrás
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Contar vendas novas (últimos 7 dias)
        const newSalesCount = await prisma.meliVenda.count({
            where: {
                userId: session.sub,
                dataVenda: {
                    gte: sevenDaysAgo
                }
            }
        });

        // Contar total de vendas
        const totalSalesCount = await prisma.meliVenda.count({
            where: {
                userId: session.sub
            }
        });

        return NextResponse.json({
            totals: {
                new: newSalesCount,
                total: totalSalesCount
            },
            period: {
                from: sevenDaysAgo.toISOString(),
                to: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("[API] Error checking sales:", error);
        return new NextResponse("Unauthorized", { status: 401 });
    }
}
