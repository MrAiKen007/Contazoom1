import { NextRequest, NextResponse } from "next/server";
import { assertSessionToken } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/financeiro/categorias
 * Lista todas as categorias do usuário
 */
export async function GET(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const categorias = await prisma.categoria.findMany({
            where: {
                userId: session.sub,
                ativo: true,
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
                        tipo: true,
                    },
                    where: {
                        ativo: true,
                    },
                },
                _count: {
                    select: {
                        contasPagar: true,
                        contasReceber: true,
                    },
                },
            },
            orderBy: [
                { tipo: 'asc' },
                { nome: 'asc' },
            ],
        });

        return NextResponse.json({
            ok: true,
            data: categorias,
        });
    } catch (error) {
        console.error("[API] Error fetching categorias:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao buscar categorias" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/financeiro/categorias
 * Cria uma nova categoria
 */
export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get("session")?.value;
        const session = await assertSessionToken(sessionCookie);

        const body = await req.json();
        const { nome, descricao, tipo, categoriaPaiId, blingId } = body;

        // Validações
        if (!nome || nome.trim().length === 0) {
            return NextResponse.json(
                { ok: false, error: "Nome é obrigatório" },
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

        // Criar categoria
        const categoria = await prisma.categoria.create({
            data: {
                userId: session.sub,
                nome: nome.trim(),
                descricao: descricao?.trim() || null,
                tipo: tipo || null,
                categoriaPaiId: categoriaPaiId || null,
                blingId: blingId || null,
                ativo: true,
            },
            include: {
                categoriaPai: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });

        return NextResponse.json({
            ok: true,
            data: categoria,
        }, { status: 201 });
    } catch (error) {
        console.error("[API] Error creating categoria:", error);
        return NextResponse.json(
            { ok: false, error: "Erro ao criar categoria" },
            { status: 500 }
        );
    }
}
