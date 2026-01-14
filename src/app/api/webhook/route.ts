import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const response = await fetch('https://n8n-n8nwork.e72bkl.easypanel.host/webhook/ACTIVACION', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: 'ACTUALIZAR' }),
        });

        if (response.ok) {
            return NextResponse.json({ success: true, message: 'Webhook enviado correctamente' });
        } else {
            return NextResponse.json({ success: false, message: 'Error en la respuesta del webhook' }, { status: 500 });
        }
    } catch (error) {
        console.error('Error sending webhook:', error);
        return NextResponse.json({ success: false, message: 'Error interno del servidor' }, { status: 500 });
    }
}