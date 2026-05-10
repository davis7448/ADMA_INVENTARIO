import { NextRequest, NextResponse } from 'next/server';

// Esta route es legacy. Las operaciones de escritura se hacen vía client SDK
// en src/app/actions/modificaciones.ts. Solo se mantiene GET para uso externo.

const API_URL = process.env.FIRESTORE_EMULATOR_HOST
  ? 'http://localhost:8080'
  : 'https://firestore.googleapis.com/v1';

const PROJECT_ID = 'studio-9748962172-82b35';
const BASE_URL = `${API_URL}/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getModificaciones() {
  const response = await fetch(`${BASE_URL}/modificaciones`);
  const data = await response.json();
  return data.documents || [];
}

async function getModificacionById(id: string) {
  const response = await fetch(`${BASE_URL}/modificaciones/${id}`);
  if (!response.ok) return null;
  return response.json();
}

function parseFields(doc: any) {
  if (!doc || !doc.fields) return { id: doc.name?.split('/').pop() };
  const fields: any = { id: doc.name?.split('/').pop() };
  for (const [key, value] of Object.entries(doc.fields) as [string, any][]) {
    if (value.stringValue !== undefined) fields[key] = value.stringValue;
    else if (value.integerValue !== undefined) fields[key] = Number(value.integerValue);
    else if (value.booleanValue !== undefined) fields[key] = value.booleanValue;
    else if (value.timestampValue !== undefined) fields[key] = value.timestampValue;
    else if (value.mapValue !== undefined) fields[key] = value.mapValue;
    else fields[key] = null;
  }
  return fields;
}

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role');
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = await getModificacionById(id);
      if (!doc) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(parseFields(doc));
    }

    const docs = await getModificaciones();
    const modificaciones = docs.map(parseFields);
    return NextResponse.json({ modificaciones });
  } catch (error) {
    console.error('Error fetching modificaciones:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
