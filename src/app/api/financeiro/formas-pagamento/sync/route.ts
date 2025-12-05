import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * POST /api/financeiro/formas-pagamento/sync
 * Sincroniza formas de pagamento (stub)
 */
export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        await assertSessionToken(sessionCookie);

        // Retornar sucesso vazio (funcionalidade não implementada)
        return NextResponse.json({
            success: true,
            message: "Sincronização financeira não implementada",
            synced: 0
        });
    } catch (error) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
}
