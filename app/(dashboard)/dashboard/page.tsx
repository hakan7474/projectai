import { getAuthSession } from '@/lib/auth-helper';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import Template from '@/models/Template'; // Import Template to register the model
import mongoose from 'mongoose';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, TrendingUp, CheckCircle2, Clock, FileText, ArrowRight } from 'lucide-react';

export default async function DashboardPage() {
  try {
    const session = await getAuthSession();

    if (!session || !session.user) {
      redirect('/login');
    }

    await connectDB();

    // Ensure Template model is registered before populate
    // Access Template to ensure the model file is executed
    const _templateCheck = Template;
    
    // Double check Template is registered in mongoose.models
    // If not, force registration using the exported schema
    if (!mongoose.models.Template) {
      console.error('Template model not registered, forcing registration...');
      // Force registration by importing schema and registering manually
      const TemplateModule = await import('@/models/Template');
      if (TemplateModule.TemplateSchema) {
        mongoose.model('Template', TemplateModule.TemplateSchema);
      } else {
        // Fallback: re-import and access default export
        const _ = TemplateModule.default;
        if (!mongoose.models.Template) {
          throw new Error('Template model failed to register after all attempts');
        }
      }
    }

    const projects = await Project.find({ ownerId: session.user.id })
      .populate('templateId', 'name institution')
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const projectStats = {
      total: await Project.countDocuments({ ownerId: session.user.id }),
      completed: await Project.countDocuments({ ownerId: session.user.id, status: 'completed' }),
      inProgress: await Project.countDocuments({ ownerId: session.user.id, status: 'in-progress' }),
      draft: await Project.countDocuments({ ownerId: session.user.id, status: 'draft' }),
    };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'in-progress':
        return 'secondary';
      case 'submitted':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-8">
      {/* Modern Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-8 text-primary-foreground shadow-modern-lg">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,transparent)]"></div>
        <div className="relative">
          <h1 className="text-4xl font-bold mb-2">Hoş geldiniz, {session.user.name} 👋</h1>
          <p className="text-primary-foreground/90 text-lg">Projelerinizi yönetin ve yeni başarılar elde edin</p>
        </div>
      </div>

      {/* Modern Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 hover:border-primary/50 transition-all duration-300 shadow-modern hover:shadow-modern-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Proje</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{projectStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Tüm projeleriniz</p>
          </CardContent>
        </Card>
        <Card className="border-2 hover:border-green-500/50 transition-all duration-300 shadow-modern hover:shadow-modern-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tamamlanan</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{projectStats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">Başarıyla tamamlandı</p>
          </CardContent>
        </Card>
        <Card className="border-2 hover:border-blue-500/50 transition-all duration-300 shadow-modern hover:shadow-modern-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Devam Eden</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{projectStats.inProgress}</div>
            <p className="text-xs text-muted-foreground mt-1">Aktif çalışmalar</p>
          </CardContent>
        </Card>
        <Card className="border-2 hover:border-orange-500/50 transition-all duration-300 shadow-modern hover:shadow-modern-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taslak</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{projectStats.draft}</div>
            <p className="text-xs text-muted-foreground mt-1">Henüz başlamadı</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action */}
      <div className="flex justify-end">
        <Link href="/projects/new">
          <Button size="lg" className="gradient-primary text-primary-foreground shadow-modern-lg hover:shadow-modern-lg hover:scale-105 transition-transform">
            <PlusIcon className="mr-2 h-5 w-5" />
            Yeni Proje Oluştur
          </Button>
        </Link>
      </div>

      {/* Recent Projects - Modern Design */}
      <Card className="shadow-modern-lg border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Son Projeler</CardTitle>
              <CardDescription className="mt-1">En son çalıştığınız projeler</CardDescription>
            </div>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Tümünü Gör
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">Henüz proje oluşturmadınız</p>
              <p className="text-sm text-muted-foreground mb-6">İlk projenizi oluşturarak başlayın</p>
              <Link href="/projects/new">
                <Button size="lg" className="gradient-primary text-primary-foreground">
                  <PlusIcon className="mr-2 h-5 w-5" />
                  İlk Projenizi Oluşturun
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project: any) => (
                <Link
                  key={project._id.toString()}
                  href={`/projects/${project._id}/edit`}
                  className="group block rounded-xl border-2 p-5 transition-all duration-300 hover:border-primary/50 hover:shadow-modern bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant={getStatusBadgeVariant(project.status)}
                          className="font-medium"
                        >
                          {project.status === 'in-progress'
                            ? 'Devam Ediyor'
                            : project.status === 'completed'
                              ? 'Tamamlandı'
                              : project.status === 'submitted'
                                ? 'Başvuruldu'
                                : 'Taslak'}
                        </Badge>
                        {project.templateId && (
                          <Badge variant="outline" className="text-xs">
                            {project.templateId.institution.toUpperCase()}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.updatedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all ml-4 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
  } catch (error) {
    console.error('Dashboard error:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Bir hata oluştu</h1>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu'}
          </p>
          <Link href="/dashboard">
            <Button>Tekrar Dene</Button>
          </Link>
        </div>
      </div>
    );
  }
}

