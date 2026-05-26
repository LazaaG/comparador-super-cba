// Proxy de GET /search al backend FastAPI.
// Forwarea q/ean/limit/offset. No agrega caché HTTP — la cache la hace React Query.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND = process.env.API_INTERNAL_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const target = new URL(`${BACKEND}/search`);
  for (const [k, v] of sp.entries()) target.searchParams.set(k, v);

  try {
    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
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
