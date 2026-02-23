"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Trophy, 
  Gift, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  UserPlus,
  TrendingUp,
  Building2
} from "lucide-react";
import { 
  registerCommunityLeader, 
  generateInviteCode, 
  getCommunityRanking 
} from "@/app/actions/communities";
import { getUserById } from "@/lib/api";

export default function CommunitiesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [isLeader, setIsLeader] = useState(false);
  const [leaderVerified, setLeaderVerified] = useState(false);
  const [ranking, setRanking] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Form states
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    phone: "",
    communityName: "",
    communityDescription: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Load ranking
      const result = await getCommunityRanking();
      if (result.success && result.ranking) {
        setRanking(result.ranking);
      }
      
      // Check if user is a leader (would come from user.role or community_leaders collection)
      // For demo, allow registration
      setIsLeader(false);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/register?code=${inviteCode}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast({
      title: "Código copiado",
      description: "Comparte este código con quienes quieras invitar a tu comunidad",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCode = async () => {
    if (!user?.id) return;
    
    const result = await generateInviteCode(user.id);
    if (result.success && result.code) {
      setInviteCode(result.code);
      toast({
        title: "Código generado",
        description: "Nuevo código de invitación creado",
      });
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    setSubmitting(true);
    const result = await registerCommunityLeader({
      ...formData,
      email: user.email,
    });
    setSubmitting(false);

    if (result.success) {
      toast({
        title: "Solicitud enviada",
        description: "Espera aprobación del administrador para gestionar tu comunidad",
      });
      setIsRegistering(false);
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comunidades</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu comunidad y verifica tu progreso
          </p>
        </div>
        {!isLeader && (
          <Button onClick={() => setIsRegistering(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Registrarme como Líder
          </Button>
        )}
      </div>

      {/* Registration Form Modal */}
      {isRegistering && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Registro como Líder de Comunidad</CardTitle>
            <CardDescription>
              Completa los datos de tu comunidad. Necesitas aprobación del administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nombre completo</Label>
                  <Input
                    id="displayName"
                    placeholder="Tu nombre"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono (opcional)</Label>
                  <Input
                    id="phone"
                    placeholder="+57 300 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="communityName">Nombre de la comunidad</Label>
                <Input
                  id="communityName"
                  placeholder="Ej: Comunidad Bogotá Sur"
                  value={formData.communityName}
                  onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="communityDescription">Descripción (opcional)</Label>
                <Textarea
                  id="communityDescription"
                  placeholder="Describe tu comunidad..."
                  value={formData.communityDescription}
                  onChange={(e) => setFormData({ ...formData, communityDescription: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsRegistering(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar Solicitud"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mi Posición
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{ranking.findIndex(r => r.leaderId === user?.id) + 1 || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              en el ranking general
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mi Comunidad
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLeader ? "Activa" : "Sin comunidad"}</div>
            <p className="text-xs text-muted-foreground">
              {leaderVerified ? "Verificada" : isLeader ? "Pendiente de verificación" : "Únete a una comunidad"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Miembros
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              en tu comunidad
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Comisiones
            </CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-muted-foreground">
              acumulados este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invite Code Section (for leaders) */}
      {isLeader && leaderVerified && (
        <Card>
          <CardHeader>
            <CardTitle>Invitar Miembros</CardTitle>
            <CardDescription>
              Comparte este código con quienes quieras invitar a tu comunidad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                readOnly
                placeholder="Genera un código..."
                className="font-mono"
              />
              <Button onClick={handleGenerateCode} variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                Generar
              </Button>
              <Button onClick={handleCopyInvite} disabled={!inviteCode}>
                {copied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Ranking de Comunidades
          </CardTitle>
          <CardDescription>
            Las comunidades mejor rankeadas por comisiones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {ranking.map((item, index) => (
                <div
                  key={item.leaderId}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    item.leaderId === user?.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? "bg-yellow-500 text-white" :
                      index === 1 ? "bg-gray-400 text-white" :
                      index === 2 ? "bg-amber-600 text-white" :
                      "bg-muted"
                    }`}>
                      {index + 1}
                    </div>
                    <Avatar>
                      <AvatarFallback>{item.leaderName?.charAt(0) || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{item.leaderName}</p>
                      <p className="text-sm text-muted-foreground">{item.communityName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${item.totalCommission?.toLocaleString() || 0}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.memberCount || 0} miembros
                    </p>
                  </div>
                </div>
              ))}
              {ranking.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay comunidades rankeadas aún</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
