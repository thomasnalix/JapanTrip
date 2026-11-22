import { NextRequest, NextResponse } from 'next/server';
import {
  TripDataSchema,
  TripMutationSchema,
} from '@/lib/schemas';
import {
  applyTripMutation,
  readTripData,
  writeTripData,
} from '@/lib/storage';

export async function GET() {
  try {
    const result = await readTripData();
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erreur Upstash Redis.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TripMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await applyTripMutation(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erreur de sauvegarde Redis.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TripDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Schéma TripData invalide', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const status = await writeTripData(parsed.data);
    return NextResponse.json({ data: parsed.data, ...status });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Erreur de sauvegarde Redis.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
