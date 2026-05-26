// Proxy de GET /chains al backend FastAPI.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND = process.env.API_INTERNAL_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const upstream = await fetch(`${BACKEND}/chains`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // cache breve: las cadenas activas casi no cambian
      next: { revalidate: 300 }
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
