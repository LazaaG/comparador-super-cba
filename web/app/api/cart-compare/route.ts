// Proxy de POST /cart/compare al backend FastAPI.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND = process.env.API_INTERNAL_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido en el cuerpo.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${BACKEND}/cart/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { error: 'No pudimos conectar con el backend.', detail: msg },
      { status: 502 }
    );
  }
}
