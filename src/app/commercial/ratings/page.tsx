"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarRating } from '@/components/commercial/star-rating';
import { useAuth } from '@/hooks/use-auth';
import { getUsers } from '@/lib/api'; // Generalized user fetch
import { addRating } from '@/lib/commercial-api';
import { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function RatingsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<(User & { starCount: number, angryCount: number })[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const allUsers = await getUsers();
                // Filter valid roles mostly
                const targetRoles = ['commercial', 'commercial_director', 'logistics', 'admin'];
                const filtered = allUsers.filter(u => targetRoles.includes(u.role));

                // For demo/MVP, we might not fetch ALL ratings for ALL users in one go as it's expensive.
                setUsers(filtered.map(u => ({ ...u, starCount: 0, angryCount: 0 })));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleRate = async (targetUserId: string, type: 'star' | 'angry') => {
        if (!user) return;
        try {
            await addRating({
                from_user_id: user.id, // Fixed: user.id
                to_user_id: targetUserId,
                type,
                created_at: new Date()
            });
            toast({
                title: type === 'star' ? "¡Estrella enviada!" : "Calificación enviada.",
                description: `Has calificado a este usuario.`,
            });

            // Optimistic update (fake for now as we don't reload all)
            setUsers(prev => prev.map(u => {
                if (u.id === targetUserId) {
                    return {
                        ...u,
                        starCount: type === 'star' ? u.starCount + 1 : u.starCount,
                        angryCount: type === 'angry' ? u.angryCount + 1 : u.angryCount
                    }
                }
                return u;
            }));

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error",
                description: error.message || "Error al calificar",
                variant: 'destructive'
            });
        }
    };

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Calificaciones</h1>
                <p className="text-muted-foreground">Reconoce el buen trabajo de tus compañeros. Solo 1 voto diario (estrellas o no).</p>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar compañero..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredUsers.map(targetUser => (
                    <Card key={targetUser.id} className="hover:shadow-lg transition-all">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <Avatar className="h-16 w-16 border-2 border-primary/20">
                                <AvatarImage src={targetUser.avatarUrl} />
                                <AvatarFallback className="text-lg">{targetUser.name.charAt(0)}</AvatarFallback>
                            </Avatar>

                            <div>
                                <h3 className="font-bold text-lg">{targetUser.name}</h3>
                                <p className="text-xs text-muted-foreground uppercase">{targetUser.role}</p>
                            </div>

                            <StarRating
                                rating={targetUser.starCount}
                                angryCount={targetUser.angryCount}
                                onRate={(type) => handleRate(targetUser.id, type)}
                            />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
