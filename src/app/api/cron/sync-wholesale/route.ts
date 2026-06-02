import { NextRequest, NextResponse } from 'next/server';
import { syncWholesaleMarginsAction } from '@/app/actions/products';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const secret = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncWholesaleMarginsAction();

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
