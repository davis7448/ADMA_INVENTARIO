"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Trash2, Plus, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ApiToken {
  token: string;
  clientName: string;
  clientId: string;
  createdBy: string;
  createdAt: any;
  isActive: boolean;
  rateLimitPerMinute: number;
  allowedOrigins: string[];
  lastUsedAt: any;
  totalRequests: number;
}

export function ApiTokenManager() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState('');
  const [rateLimit, setRateLimit] = useState('100');

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/api-tokens');
      const data = await response.json();
      if (data.success) {
        setTokens(data.tokens);
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tokens',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientId,
          allowedOrigins: allowedOrigins.split(',').map(o => o.trim()).filter(Boolean),
          rateLimitPerMinute: parseInt(rateLimit) || 100,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setNewToken(data.token);
        toast({
          title: 'Éxito',
          description: 'Token creado correctamente',
        });
        fetchTokens();
        // Reset form
        setClientName('');
        setClientId('');
        setAllowedOrigins('');
        setRateLimit('100');
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo crear el token',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating token:', error);
      toast({
        title: 'Error',
        description: 'Error al crear el token',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeToken = async (token: string) => {
    if (!confirm('¿Estás seguro de revocar este token? Las aplicaciones que lo usen dejarán de funcionar.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/api-tokens?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Éxito',
          description: 'Token revocado correctamente',
        });
        fetchTokens();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo revocar el token',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      toast({
        title: 'Error',
        description: 'Error al revocar el token',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: 'Token copiado al portapapeles',
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Nunca';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd/MM/yyyy HH:mm', { locale: es });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Gestión de API Tokens</CardTitle>
            <CardDescription>
              Administra tokens de acceso para aplicaciones externas
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchTokens} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setShowCreateForm(!showCreateForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Token
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* New Token Display */}
        {newToken && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">Token creado exitosamente</span>
            </div>
            <p className="text-sm text-green-700 mb-2">
              Copia este token ahora. No podrás verlo de nuevo.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-green-100 px-3 py-2 rounded text-sm font-mono break-all">
                {newToken}
              </code>
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(newToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              variant="ghost" 
              className="mt-2 text-green-700"
              onClick={() => setNewToken(null)}
            >
              Ocultar
            </Button>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateToken} className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Crear Nuevo Token</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Nombre del Cliente *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Sistema Auditoría"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="clientId">ID del Cliente *</Label>
                <Input
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Ej: sistema-auditoria"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedOrigins">Orígenes Permitidos (separados por coma)</Label>
              <Input
                id="allowedOrigins"
                value={allowedOrigins}
                onChange={(e) => setAllowedOrigins(e.target.value)}
                placeholder="https://app1.com, https://app2.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateLimit">Límite de Requests por Minuto</Label>
              <Input
                id="rateLimit"
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
                min="1"
                max="1000"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">Crear Token</Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Token List */}
        <div className="space-y-2">
          <h3 className="font-semibold">Tokens Activos ({tokens.length})</h3>
          
          {tokens.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay tokens activos. Crea uno nuevo para comenzar.
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div 
                  key={token.token} 
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{token.clientName}</span>
                        <Badge variant="outline">{token.clientId}</Badge>
                        <Badge variant="secondary">{token.rateLimitPerMinute} req/min</Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Token: <code className="bg-muted px-1 rounded">{token.token.substring(0, 20)}...</code></p>
                        <p>Creado: {formatDate(token.createdAt)} por {token.createdBy}</p>
                        {token.lastUsedAt && (
                          <p>Último uso: {formatDate(token.lastUsedAt)}</p>
                        )}
                        <p>Total requests: {token.totalRequests}</p>
                        {token.allowedOrigins.length > 0 && (
                          <p>Orígenes: {token.allowedOrigins.join(', ')}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(token.token)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRevokeToken(token.token)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}