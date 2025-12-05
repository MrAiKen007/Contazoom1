import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/aliquotas
 * Lista todas as alíquotas de impostos do usuário
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const aliquotas = await prisma.aliquotaImposto.findMany({
            where: {
                userId: session.sub,
                ativo: true,
            },
            orderBy: [
                { conta: 'asc' },
                { dataInicio: 'desc' },
            ],
        });

        return NextResponse.json({
            ok: true,
            data: aliquotas,
        });
    } catch (error) {
        console.error("[API] Error fetching aliquotas:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar alíquotas" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/financeiro/aliquotas
 * Cria uma nova alíquota de imposto
 */
export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const body = await req.json();
        const { conta, aliquota, dataInicio, dataFim, descricao } = body;

        // Validações
        if (!conta || conta.trim().length === 0) {
            return NextResponse.json(
                { ok: false, error: "Conta é obrigatória" },
                { status: 400 }
            );
        }

        if (!aliquota || Number(aliquota) < 0 || Number(aliquota) > 100) {
            return NextResponse.json(
                { ok: false, error: "Alíquota deve estar entre 0 e 100" },
                { status: 400 }
            );
        }

        if (!dataInicio || !dataFim) {
            return NextResponse.json(
                { ok: false, error: "Data de início e fim são obrigatórias" },
                { status: 400 }
            );
        }

        // Criar alíquota
        const aliquotaImposto = await prisma.aliquotaImposto.create({
            data: {
                userId: session.sub,
                conta: conta.trim(),
                aliquota: Number(aliquota),
                dataInicio: new Date(dataInicio),
                dataFim: new Date(dataFim),
                descricao: descricao?.trim() || null,
                ativo: true,
            },
        });

        return NextResponse.json({
            ok: true,
            data: aliquotaImposto,
        }, { status: 201 });
    } catch (error) {
        console.error("[API] Error creating aliquota:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao criar alíquota" },
            { status: 500 }
        );
    }
}
