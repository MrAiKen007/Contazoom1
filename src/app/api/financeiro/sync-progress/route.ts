import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/financeiro/sync-progress
 * SSE endpoint para progresso de sincronização financeira (stub)
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        await assertSessionToken(sessionCookie);

        // Retornar stream vazio (funcionalidade não implementada)
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                // Enviar mensagem inicial
                const data = JSON.stringify({
                    type: "info",
                    message: "Sincronização financeira não implementada"
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));

                // Fechar stream
                controller.close();
            }
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
}
