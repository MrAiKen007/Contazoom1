import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/formas-pagamento
 * Lista todas as formas de pagamento do usuário
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const formasPagamento = await prisma.formaPagamento.findMany({
            where: {
                userId: session.sub,
                ativo: true,
            },
            include: {
                _count: {
                    select: {
                        contasPagar: true,
                        contasReceber: true,
                    },
                },
            },
            orderBy: {
                nome: 'asc',
            },
        });

        return NextResponse.json({
            ok: true,
            data: formasPagamento,
        });
    } catch (error) {
        console.error("[API] Error fetching formas pagamento:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar formas de pagamento" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/financeiro/formas-pagamento
 * Cria uma nova forma de pagamento
 */
export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const body = await req.json();
        const { nome, descricao, tipo, blingId } = body;

        // Validações
        if (!nome || nome.trim().length === 0) {
            return NextResponse.json(
                { ok: false, error: "Nome é obrigatório" },
                { status: 400 }
            );
        }

        // Verificar se já existe forma de pagamento com mesmo nome
        const existente = await prisma.formaPagamento.findFirst({
            where: {
                userId: session.sub,
                nome: nome.trim(),
                ativo: true,
            },
        });

        if (existente) {
            return NextResponse.json(
                { ok: false, error: "Já existe uma forma de pagamento com este nome" },
                { status: 409 }
            );
        }

        // Criar forma de pagamento
        const formaPagamento = await prisma.formaPagamento.create({
            data: {
                userId: session.sub,
                nome: nome.trim(),
                descricao: descricao?.trim() || null,
                tipo: tipo?.trim() || null,
                blingId: blingId || null,
                ativo: true,
            },
        });

        return NextResponse.json({
            ok: true,
            data: formaPagamento,
        }, { status: 201 });
    } catch (error) {
        console.error("[API] Error creating forma pagamento:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao criar forma de pagamento" },
            { status: 500 }
        );
    }
}
