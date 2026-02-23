"use client";

import { useState, useEffect } from 'react';
import { getMemberDashboard, getMemberChallenges } from '@/app/actions/communities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Target, 
  Loader2,
  Award,
  Clock,
  CheckCircle2
} from 'lucide-react';

// Mock user ID - in production, this would come from auth
const MOCK_MEMBER_ID = "demo-member-id";

interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  reward: number;
  status: 'active' | 'completed' | 'expired';
  endsAt: Date;
}

export default function MemberChallengesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [communityName, setCommunityName] = useState<string>('');

  useEffect(() => {
    loadChallenges();
  }, []);

  async function loadChallenges() {
    setIsLoading(true);
    
    // First get dashboard to know community
    const dashboardResult = await getMemberDashboard(MOCK_MEMBER_ID);
    if (dashboardResult.success && dashboardResult.data) {
      setCommunityName(dashboardResult.data.community.name);
    }
    
    // Then get challenges
    const result = await getMemberChallenges(MOCK_MEMBER_ID);
    if (result.success && result.data) {
      setChallenges(result.data);
    }
    
    setIsLoading(false);
  }

  function getProgressPercentage(challenge: Challenge): number {
    if (challenge.target === 0) return 0;
    return Math.min(100, (challenge.progress / challenge.target) * 100);
  }

  function getDaysRemaining(endsAt: Date): number {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const expiredChallenges = challenges.filter(c => c.status === 'expired');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Retos</h1>
          <p className="text-muted-foreground">Comunidad: {communityName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeChallenges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedChallenges.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premio Disponible</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${activeChallenges.reduce((sum, c) => sum + c.reward, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Activos ({activeChallenges.length})</TabsTrigger>
          <TabsTrigger value="completed">Completados ({completedChallenges.length})</TabsTrigger>
          <TabsTrigger value="expired">Expirados ({expiredChallenges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeChallenges.map((challenge) => (
            <Card key={challenge.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      {challenge.title}
                    </CardTitle>
                    <CardDescription>{challenge.description}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">${challenge.reward}</p>
                    <p className="text-xs text-muted-foreground">Premio</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progreso</span>
                    <span>{challenge.progress} / {challenge.target}</span>
                  </div>
                  <Progress value={getProgressPercentage(challenge)} className="h-2" />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {getDaysRemaining(challenge.endsAt)} días restantes
                  </div>
                  <span>{getProgressPercentage(challenge).toFixed(0)}% completado</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {activeChallenges.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay retos activos en este momento
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedChallenges.map((challenge) => (
            <Card key={challenge.id} className="opacity-75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  {challenge.title}
                </CardTitle>
                <CardDescription>{challenge.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Objetivo: {challenge.target}</span>
                  <span className="text-sm font-bold text-green-600">${challenge.reward} ganado</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {completedChallenges.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No has completado ningún reto todavía
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          {expiredChallenges.map((challenge) => (
            <Card key={challenge.id} className="opacity-50">
              <CardHeader>
                <CardTitle>{challenge.title}</CardTitle>
                <CardDescription>{challenge.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Este reto ha expirado</p>
              </CardContent>
            </Card>
          ))}
          {expiredChallenges.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay retos expirados
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
