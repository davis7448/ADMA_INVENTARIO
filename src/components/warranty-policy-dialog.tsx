
"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
  } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function WarrantyPolicyDialog() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Ver Política</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-headline">Política de Garantías</DialogTitle>
            <DialogDescription>
              Nuestra política para gestionar las garantías de los clientes.
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              Aceptamos garantías dentro de los 30 días posteriores a la entrega. Para ser elegible para una garantía, el artículo debe estar en las mismas condiciones en que lo recibió, sin usar, con las etiquetas y en su embalaje original. También necesitará el recibo o comprobante de compra.
            </p>
            <h4>Daños y problemas</h4>
            <p>
              Por favor, inspeccione su pedido al recibirlo y contáctenos de inmediato si el artículo está defectuoso, dañado o si recibe el artículo incorrecto, para que podamos evaluar el problema y corregirlo.
            </p>
            <h4>Excepciones / artículos no cubiertos por la garantía</h4>
            <p>
              Ciertos tipos de artículos no pueden ser devueltos, como productos perecederos (alimentos, flores o plantas), productos personalizados (como pedidos especiales o artículos personalizados) y artículos de cuidado personal (como productos de belleza). Póngase en contacto si tiene preguntas o inquietudes sobre su artículo específico.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => (document.querySelector('[data-radix-dialog-close]') as HTMLElement)?.click()}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
