"use client";

import { useState, useEffect } from 'react';
import { getLeaderDashboard, generateMemberInviteCode } from '@/app/actions/communities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Award, 
  TrendingUp, 
  Plus, 
  Copy, 
  Loader2,
  UserPlus,
  DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LeaderDashboardData {
  leader: {
    id: string;
    displayName: string;
    email: string;
    verified: boolean;
    commissionRate: number;
    totalCommission: number;
  };
  community: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    totalSales: number;
    totalCommission: number;
  };
  recentMembers: Array<{
    id: string;
    displayName: string;
    email: string;
    createdAt: Date;
  }>;
  topPerformers: Array<{
    id: string;
    displayName: string;
    totalSales: number;
  }>;
}

// Mock user ID - in production, this would come from auth
const MOCK_LEADER_ID = "demo-leader-id";

export default function LeaderDashboardPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<LeaderDashboardData | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    const result = await getLeaderDashboard(MOCK_LEADER_ID);
    if (result.success && result.data) {
      setDashboardData(result.data);
    }
    setIsLoading(false);
  }

  async function handleGenerateMemberCode() {
    setGeneratingCode(true);
    const result = await generateMemberInviteCode(MOCK_LEADER_ID, 30);
    setGeneratingCode(false);

    if (result.success && result.inviteCode) {
      setNewCode(result.inviteCode);
      toast({
        title: 'Código generado',
        description: `Código: ${result.inviteCode}`,
      });
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive',
      });
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: 'Código copiado al portapapeles',
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acceso Restringido</CardTitle>
            <CardDescription>
              No tienes acceso al dashboard de líder de comunidad.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { leader, community } = dashboardData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{community.name}</h1>
          <p className="text-muted-foreground">Dashboard del Líder</p>
        </div>
        <div className="flex items-center gap-2">
          {leader.verified ? (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <Award className="h-4 w-4" /> Verificado
            </span>
          ) : (
            <span className="text-yellow-600 text-sm">Pendiente de verificación</span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Miembros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{community.memberCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${community.totalSales.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comisión Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${community.totalCommission.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tu Tasa</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leader.commissionRate}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Miembros</TabsTrigger>
          <TabsTrigger value="performance">Rendimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Gestión de Miembros</span>
                <Button 
                  onClick={handleGenerateMemberCode} 
                  disabled={generatingCode}
                >
                  {generatingCode ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Generar Código
                </Button>
              </CardTitle>
              <CardDescription>
                Invita nuevos miembros a tu comunidad
              </CardDescription>
            </CardHeader>
            <CardContent>
              {newCode && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Código de invitación:</p>
                  <div className="flex items-center gap-2">
                    <Input value={newCode} readOnly className="font-mono text-lg" />
                    <Button variant="outline" onClick={() => copyToClipboard(newCode)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Comparte este código con tus miembros
                  </p>
                </div>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.recentMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.displayName}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {dashboardData.recentMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No hay miembros registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>
                Los miembros con más ventas en tu comunidad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Ventas Totales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.topPerformers.map((performer, index) => (
                    <TableRow key={performer.id}>
                      <TableCell className="font-bold">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{performer.displayName}</TableCell>
                      <TableCell>${performer.totalSales.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {dashboardData.topPerformers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No hay datos de rendimiento
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
