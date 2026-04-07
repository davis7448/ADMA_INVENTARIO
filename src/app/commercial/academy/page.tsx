"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, FileText, Headphones, ExternalLink } from 'lucide-react';
import { getAcademyResources } from '@/lib/commercial-api';
import { AcademyResource } from '@/types/commercial';
import { Button } from '@/components/ui/button';

export default function AcademyPage() {
    const [resources, setResources] = useState<AcademyResource[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                // In a real scenario, fetch from DB. 
                // For now, if DB is empty, we show some static suggested content as "Featured".
                const dbResources = await getAcademyResources();
                setResources(dbResources);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Static examples if the DB is empty, for the user to see how it looks
    const fallbackResources: AcademyResource[] = [
        {
            id: '1',
            title: 'Técnicas de Cierre Efectivas',
            type: 'video',
            url: 'https://youtube.com',
            description: 'Aprende los secretos para aumentar tu tasa de conversión en un 20%.',
            created_at: new Date()
        },
        {
            id: '2',
            title: 'El Arte de Vender por WhatsApp',
            type: 'article',
            url: '#',
            description: 'Guía completa de scripts y respuestas rápidas.',
            created_at: new Date()
        },
        {
            id: '3',
            title: 'Mindset del Vendedor Top',
            type: 'podcast',
            url: '#',
            description: 'Entrevista con el mejor vendedor de Latam 2024.',
            created_at: new Date()
        }
    ];

    const displayList = resources.length > 0 ? resources : fallbackResources;

    const getIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video className="h-5 w-5 text-red-500" />;
            case 'article': return <FileText className="h-5 w-5 text-blue-500" />;
            case 'podcast': return <Headphones className="h-5 w-5 text-purple-500" />;
            default: return <FileText className="h-5 w-5" />;
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Academia Comercial</h1>
                <p className="text-muted-foreground">Recursos educativos para potenciar tus habilidades y resultados.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {displayList.map((res) => (
                    <Card key={res.id} className="group hover:scale-105 transition-transform duration-200 hover:shadow-xl border-t-4 border-t-primary/20">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="flex items-center gap-1 uppercase text-xs">
                                    {getIcon(res.type)}
                                    {res.type}
                                </Badge>
                            </div>
                            <CardTitle className="leading-tight mt-2 text-xl group-hover:text-primary transition-colors">
                                {res.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CardDescription className="line-clamp-3">
                                {res.description}
                            </CardDescription>
                        </CardContent>
                        <CardFooter>
                            <Button variant="secondary" className="w-full" asChild>
                                <a href={res.url} target="_blank" rel="noopener noreferrer">
                                    Ver Recurso <ExternalLink className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
