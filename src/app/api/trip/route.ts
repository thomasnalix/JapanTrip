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
    console.error('GET /api/trip failed:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les données du voyage.' },
      { status: 500 }
    );
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
    console.error('PATCH /api/trip failed:', err);
    return NextResponse.json(
      { error: 'Impossible de sauvegarder la modification.' },
      { status: 500 }
    );
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
    const storageMode = await writeTripData(parsed.data);
    return NextResponse.json({ data: parsed.data, storageMode });
  } catch (err) {
    console.error('PUT /api/trip failed:', err);
    return NextResponse.json(
      { error: 'Impossible de remplacer les données.' },
      { status: 500 }
    );
  }
}
