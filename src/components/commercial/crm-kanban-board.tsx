"use client";

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommercialClient } from '@/types/commercial';
import { getStatusLabel } from '@/lib/crm-metrics';
import { daysSinceLastContact, getClientVolume } from '@/lib/client-volume';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const columns: { id: string; label: string }[] = [
    { id: 'finding_winner', label: getStatusLabel('finding_winner') },
    { id: 'testing', label: getStatusLabel('testing') },
    { id: 'selling', label: getStatusLabel('selling') },
    { id: 'scaling', label: getStatusLabel('scaling') },
];

type CrmKanbanBoardProps = {
    clients: CommercialClient[];
    onDragEnd: (result: DropResult) => void;
};

export default function CrmKanbanBoard({ clients, onDragEnd }: CrmKanbanBoardProps) {
    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-320px)] overflow-x-auto">
                {columns.map(col => {
                    const colClients = clients.filter(c => c.status === col.id);
                    return (
                        <Droppable key={col.id} droppableId={col.id}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex flex-col gap-4 bg-muted/40 p-4 rounded-xl min-w-[280px] ${snapshot.isDraggingOver ? 'bg-muted/60' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-sm uppercase text-muted-foreground">{col.label}</h3>
                                        <Badge variant="secondary" className="rounded-full">{colClients.length}</Badge>
                                    </div>

                                    <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                                        {colClients.map((client, index) => (
                                            <Draggable key={client.id} draggableId={client.id!} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <Link href={`/commercial/crm/client/${client.id}`}>
                                                            <Card className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary/50 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''}`}>
                                                                <CardContent className="p-4">
                                                                    <div className="font-bold text-base truncate">{client.name}</div>
                                                                    <div className="text-xs text-muted-foreground mb-2 truncate">{client.email}</div>

                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        <Badge variant="outline" className="text-[10px] h-5">{client.category}</Badge>
                                                                        <Badge variant="outline" className="text-[10px] h-5">{client.type}</Badge>
                                                                        {(() => {
                                                                            const volume = getClientVolume(client);
                                                                            const days = daysSinceLastContact(client);
                                                                            return (
                                                                                <>
                                                                                    {volume.tier !== 'Nuevo' && (
                                                                                        <Badge variant={volume.tier === 'A' ? 'default' : 'secondary'} className="text-[10px] h-5">Vol. {volume.tier}</Badge>
                                                                                    )}
                                                                                    {days !== null && days >= 15 && (
                                                                                        <Badge variant="destructive" className="text-[10px] h-5">{days}d sin contacto</Badge>
                                                                                    )}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>

                                                                    {client.assigned_commercial_name && (
                                                                        <div className="mt-2 pt-2 border-t border-border/50">
                                                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                                <span className="font-medium">Comercial:</span>
                                                                                <span className="truncate">{client.assigned_commercial_name}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        </Link>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                        {colClients.length === 0 && (
                                            <div className="text-center text-xs text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                                                Sin clientes
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Droppable>
                    );
                })}
            </div>
        </DragDropContext>
    );
}
