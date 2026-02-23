"use client";

import { useState, useEffect } from 'react';
import { getCommunitiesDashboard, generateLeaderInviteCode, getCommunityRanking } from '@/app/actions/admin/communities';
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
  Trophy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DashboardData {
  totalCommunities: number;
  totalLeaders: number;
  totalMembers: number;
  communities: Array<{
    id: string;
    name: string;
    leaderName: string;
    memberCount: number;
    totalSales: number;
    totalCommission: number;
    createdAt: Date;
  }>;
}

interface RankingData {
  rank: number;
  communityId: string;
  communityName: string;
  leaderName: string;
  memberCount: number;
  totalCommission: number;
}

export default function AdminCommunitiesPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [rankingData, setRankingData] = useState<RankingData[]>([]);
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<{ communityId: string; url: string } | null>(null);

  useEffect(() => {
    loadDashboard();
    loadRanking();
  }, []);

  async function loadDashboard() {
    setIsLoading(true);
    const result = await getCommunitiesDashboard();
    if (result.success && result.data) {
      setDashboardData(result.data);
    }
    setIsLoading(false);
  }

  async function loadRanking() {
    const result = await getCommunityRanking();
    if (result.success && result.data) {
      setRankingData(result.data);
    }
  }

  async function handleGenerateCode(communityId: string) {
    setGeneratingCode(communityId);
    const result = await generateLeaderInviteCode(communityId, 1, 30);
    setGeneratingCode(null);

    if (result.success && result.inviteUrl) {
      setNewCode({ communityId, url: result.inviteUrl });
      toast({
        title: 'Código generado',
        description: result.inviteUrl,
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
      description: 'Enlace copiado al portapapeles',
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Comunidades</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Comunidades
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalCommunities || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Líderes
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalLeaders || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Miembros
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalMembers || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="communities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="communities">Comunidades</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="communities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Comunidades</CardTitle>
              <CardDescription>
                Gestiona las comunidades y genera códigos de invitación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Líder</TableHead>
                    <TableHead>Miembros</TableHead>
                    <TableHead>Ventas</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData?.communities.map((community) => (
                    <TableRow key={community.id}>
                      <TableCell className="font-medium">{community.name}</TableCell>
                      <TableCell>{community.leaderName}</TableCell>
                      <TableCell>{community.memberCount}</TableCell>
                      <TableCell>${community.totalSales.toLocaleString()}</TableCell>
                      <TableCell>${community.totalCommission.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateCode(community.id)}
                          disabled={generatingCode === community.id}
                        >
                          {generatingCode === community.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Generar Código
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dashboardData?.communities || dashboardData.communities.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No hay comunidades registradas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Comunidades
              </CardTitle>
              <CardDescription>
                Las comunidades con más comisiones generadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Comunidad</TableHead>
                    <TableHead>Líder</TableHead>
                    <TableHead>Miembros</TableHead>
                    <TableHead>Comisión Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingData.map((item) => (
                    <TableRow key={item.communityId}>
                      <TableCell className="font-bold">
                        {item.rank === 1 && '🥇'}
                        {item.rank === 2 && '🥈'}
                        {item.rank === 3 && '🥉'}
                        {item.rank > 3 && item.rank}
                      </TableCell>
                      <TableCell className="font-medium">{item.communityName}</TableCell>
                      <TableCell>{item.leaderName}</TableCell>
                      <TableCell>{item.memberCount}</TableCell>
                      <TableCell>${item.totalCommission.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {rankingData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay datos de ranking
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Code Dialog */}
      {newCode && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Nuevo Código Generado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={newCode.url} readOnly />
              <Button variant="outline" onClick={() => copyToClipboard(newCode.url)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="secondary" onClick={() => setNewCode(null)}>
              Cerrar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
