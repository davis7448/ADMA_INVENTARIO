import { NextRequest, NextResponse } from 'next/server';

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

async function createModificacion(data: any) {
  const response = await fetch(`${BASE_URL}/modificaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: formatFields(data) }),
  });
  return response.json();
}

async function updateModificacion(id: string, data: any) {
  const response = await fetch(`${BASE_URL}/modificaciones/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: formatFields(data) }),
  });
  return response.json();
}

async function deleteModificacion(id: string) {
  await fetch(`${BASE_URL}/modificaciones/${id}`, { method: 'DELETE' });
}

function formatFields(data: any) {
  const fields: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const doc = await createModificacion(body);
    return NextResponse.json(parseFields(doc));
  } catch (error) {
    console.error('Error creating modificacion:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const doc = await updateModificacion(id, body);
    return NextResponse.json(parseFields(doc));
  } catch (error) {
    console.error('Error updating modificacion:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await deleteModificacion(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting modificacion:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
