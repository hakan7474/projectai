'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles, LogIn } from 'lucide-react';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
        callbackUrl: callbackUrl,
      });

      console.log('SignIn result:', result);

      if (result?.error) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }

      // Check if sign in was successful
      if (result?.ok) {
        toast.success('Giriş başarılı! Yönlendiriliyorsunuz...');
        
        // Verify session is set before redirecting
        try {
          const sessionResponse = await fetch('/api/auth/session');
          const session = await sessionResponse.json();
          console.log('Session after login:', session);
          
          if (session?.user) {
            // Session is set, redirect
            window.location.href = callbackUrl;
          } else {
            // Session not set yet, wait a bit and try again
            setTimeout(() => {
              window.location.href = callbackUrl;
            }, 500);
          }
        } catch (sessionError) {
          console.error('Session check error:', sessionError);
          // Redirect anyway after a delay
          setTimeout(() => {
            window.location.href = callbackUrl;
          }, 500);
        }
      } else {
        toast.error('Giriş başarısız. Lütfen tekrar deneyin.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Bir hata oluştu. Lütfen tekrar deneyin.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent"></div>
      <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,white,transparent)]"></div>
      
      <Card className="w-full max-w-md relative border-2 shadow-modern-lg">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-xl blur-lg opacity-50"></div>
              <div className="relative bg-gradient-to-r from-primary to-accent p-3 rounded-xl">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Giriş Yap
          </CardTitle>
          <CardDescription className="text-base">
            Hesabınıza giriş yapmak için bilgilerinizi girin
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                autoComplete="email"
                required
                disabled={isLoading}
                className="h-11 border-2 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="current-password"
                required
                disabled={isLoading}
                className="h-11 border-2 focus:border-primary"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full gradient-primary text-primary-foreground shadow-modern-lg hover:shadow-modern-lg h-11 text-base font-medium" 
              disabled={isLoading}
            >
              {isLoading ? (
                'Giriş yapılıyor...'
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Giriş Yap
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Hesabınız yok mu?{' '}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Kayıt ol
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
