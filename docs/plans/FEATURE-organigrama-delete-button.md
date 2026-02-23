# PLAN — FEATURE-organigrama-delete-button

> Agregar botón para eliminar usuarios del organigrama

---

## 1. Resumen

**Problema:** No hay forma de eliminar un usuario de un área en el organigrama.

**Solución:** Agregar botón de eliminar en cada tarjeta de usuario.

---

## 2. Implementación Ya Realizada

El código ya fue implementado en la commit `4a377ff`:

### 2.1 [`organigrama-canvas.tsx`](src/app/commercial/tareas/components/organigrama/organigrama-canvas.tsx)

```typescript
// Imports agregados:
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { removeUserFromAreaAction } from '@/app/actions/organigrama';
import { useToast } from '@/hooks/use-toast';

// Estado:
const [isPending, startTransition] = useTransition();
const { toast } = useToast();

// Función:
const handleRemoveUser = async (userId: string, userName: string) => {
  if (!confirm(`¿Estás seguro de eliminar a ${userName} del área?`)) return;
  startTransition(async () => {
    const result = await removeUserFromAreaAction(userId);
    if (result.success) {
      toast({ title: "Usuario eliminado", description: `${userName} ha sido eliminado del área` });
      loadData();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  });
};

// Botón en tarjeta:
<button
  onClick={(e) => { e.stopPropagation(); handleRemoveUser(userPos.userId, getUserName(userPos.userId)); }}
  disabled={isPending}
  className="mt-2 p-1 rounded-full hover:bg-red-100 text-red-500"
  title="Eliminar del área"
>
  <Trash2 className="h-4 w-4" />
</button>
```

---

## 3. Testing

- ✅ Build pasa
- ✅ Componente renderiza correctamente
- ✅ Función de eliminación llamada correctamente

---

## 4. Acción Requqerida

**Revisión del Tech Lead**

