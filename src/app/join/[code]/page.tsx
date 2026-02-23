"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { validateLeaderInviteCode, registerLeaderWithInvite } from '@/app/actions/public/join';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

function JoinContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [step, setStep] = useState<'validating' | 'register' | 'success' | 'error'>('validating');
  const [validationError, setValidationError] = useState('');
  const [communityId, setCommunityId] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    phone: '',
    communityName: '',
    communityDescription: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (code) {
      validateCode();
    }
  }, [code]);

  async function validateCode() {
    if (!code) return;

    const result = await validateLeaderInviteCode(code);
    
    if (result.valid) {
      setCommunityId(result.communityId || '');
      setStep('register');
    } else {
      setValidationError(result.message);
      setStep('error');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setSubmitError('');

    const result = await registerLeaderWithInvite({
      code: code!,
      ...formData,
    });

    setIsLoading(false);

    if (result.success) {
      setStep('success');
    } else {
      setSubmitError(result.message);
    }
  }

  if (step === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Validando código de invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Código Inválido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{validationError}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Por favor contacta al administrador para obtener un código válido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <CardTitle>¡Registro Exitoso!</CardTitle>
            </div>
            <CardDescription>
              Tu cuenta ha sido creada correctamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Has sido registrado como líder de comunidad. 
              Te hemos enviado un correo electrónico con instrucciones para establecer tu contraseña.
            </p>
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/login'}
            >
              Ir a Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Únete como Líder de Comunidad</CardTitle>
          <CardDescription>
            Completa el formulario para registrarte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre completo</Label>
              <Input
                id="displayName"
                placeholder="Juan Pérez"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="juan@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+57 300 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communityName">Nombre de tu comunidad</Label>
              <Input
                id="communityName"
                placeholder="Comunidad Bogotá Sur"
                value={formData.communityName}
                onChange={(e) => setFormData({ ...formData, communityName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="communityDescription">Descripción (opcional)</Label>
              <Input
                id="communityDescription"
                placeholder="Una breve descripción de tu comunidad"
                value={formData.communityDescription}
                onChange={(e) => setFormData({ ...formData, communityDescription: e.target.value })}
              />
            </div>

            {submitError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Registrarse'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
