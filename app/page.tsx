import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth-helper';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Brain, FileText, Users, ArrowRight, CheckCircle2 } from 'lucide-react';

export default async function Home() {
  const session = await getAuthSession();

  if (session) {
    redirect('/dashboard');
  }

  const features = [
    {
      icon: Brain,
      title: 'AI Destekli Yazım',
      description: 'Gemini AI ile proje dokümanlarınızı otomatik oluşturun ve iyileştirin',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: FileText,
      title: 'Kurum Şablonları',
      description: 'TÜBİTAK, KOSGEB ve Ufuk Avrupa için hazır şablonlar',
      color: 'from-primary to-accent',
    },
    {
      icon: Users,
      title: 'İşbirliği',
      description: 'Ekip üyelerinizle birlikte projeler üzerinde çalışın',
      color: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <div className="relative flex-1 flex items-center justify-center px-4 py-20 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent"></div>
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,white,transparent)]"></div>
        
        <div className="relative w-full max-w-6xl space-y-12 text-center">
          {/* Logo/Brand */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-2xl blur-2xl opacity-50"></div>
              <div className="relative bg-gradient-to-r from-primary to-accent p-4 rounded-2xl">
                <Sparkles className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
          </div>

          {/* Heading */}
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
                ARGE Proje Yazım
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Platformu
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-xl sm:text-2xl text-muted-foreground leading-relaxed">
              TÜBİTAK, KOSGEB ve Ufuk Avrupa için profesyonel proje dokümanları oluşturun.
              <br />
              <span className="font-medium text-foreground">Yapay zeka destekli proje yazımı</span> ile başvurularınızı kolaylaştırın.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-modern-lg hover:shadow-modern-lg hover:scale-105 transition-transform text-lg px-8 py-6">
                Başlayın
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-2 text-lg px-8 py-6 hover:bg-accent hover:border-primary transition-colors">
                Giriş Yap
              </Button>
            </Link>
          </div>

          {/* Features Grid */}
          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border-2 shadow-modern hover:shadow-modern-lg transition-all duration-300 hover:border-primary/50 group">
                  <CardContent className="p-6">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 pt-12 border-t">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Güvenli ve Şifrelenmiş</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Teknokent Uyumlu</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>AI Destekli</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
