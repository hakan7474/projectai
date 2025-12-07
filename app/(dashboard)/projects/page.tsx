import { getAuthSession } from '@/lib/auth-helper';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Project from '@/models/Project';
import Template from '@/models/Template'; // Import Template to register the model
import ProjectRuleValidation from '@/models/ProjectRuleValidation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlusIcon, SearchIcon, FolderKanban, ArrowRight, Calendar, Building2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;
  const search = params.search || '';
  const status = params.status || '';

  await connectDB();
  await ensureModelsRegistered();

  const query: any = { ownerId: session.user.id };
  if (status) {
    query.status = status;
  }
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const projects = await Project.find(query)
    .populate('templateId', 'name institution')
    .sort({ updatedAt: -1 })
    .lean();

  // Get latest validation results for each project
  let validations: any[] = [];
  try {
    const projectIds = projects.map((p: any) => p._id);
    if (projectIds.length > 0) {
      validations = await ProjectRuleValidation.find({
        projectId: { $in: projectIds },
      })
        .sort({ validatedAt: -1 })
        .lean();
      console.log(`Projects page: Found ${validations.length} validation records for ${projectIds.length} projects`);
    }
  } catch (validationError) {
    console.error('Projects page: Error fetching validations:', validationError);
    // Continue without validations if there's an error
  }

  // Create a map of projectId -> latest validation
  const validationMap = new Map();
  validations.forEach((val: any) => {
    const projectId = val.projectId.toString();
    if (!validationMap.has(projectId)) {
      validationMap.set(projectId, val);
    }
  });

  // Attach validation to projects
  const projectsWithValidation = projects.map((project: any) => ({
    ...project,
    latestValidation: validationMap.get(project._id.toString()) || null,
  }));

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Tamamlandı';
      case 'in-progress':
        return 'Devam Ediyor';
      case 'submitted':
        return 'Başvuruldu';
      default:
        return 'Taslak';
    }
  };

  const getInstitutionName = (institution: string) => {
    const names: Record<string, string> = {
      tubitak: 'TÜBİTAK',
      kosgeb: 'KOSGEB',
      'ufuk-avrupa': 'Ufuk Avrupa',
    };
    return names[institution] || institution;
  };

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Projelerim
            </h1>
          </div>
          <p className="text-muted-foreground">Tüm projelerinizi görüntüleyin ve yönetin</p>
        </div>
        <Link href="/projects/new">
          <Button size="lg" className="gradient-primary text-primary-foreground shadow-modern-lg hover:shadow-modern-lg hover:scale-105 transition-transform">
            <PlusIcon className="mr-2 h-5 w-5" />
            Yeni Proje
          </Button>
        </Link>
      </div>

      {/* Modern Filters */}
      <Card className="border-2 shadow-modern">
        <CardContent className="pt-6">
          <form method="get" className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="search"
                  placeholder="Proje ara..."
                  defaultValue={search}
                  className="pl-10 h-11 border-2 focus:border-primary"
                />
              </div>
            </div>
            <select
              name="status"
              defaultValue={status}
              className="h-11 rounded-lg border-2 border-input bg-background px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Tüm Durumlar</option>
              <option value="draft">Taslak</option>
              <option value="in-progress">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="submitted">Başvuruldu</option>
            </select>
            <Button type="submit" size="lg" className="gradient-primary text-primary-foreground">
              Filtrele
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Projects List - Modern Grid */}
      {projects.length === 0 ? (
        <Card className="border-2 shadow-modern-lg">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FolderKanban className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">Henüz proje oluşturmadınız</p>
            <p className="text-sm text-muted-foreground mb-6">İlk projenizi oluşturarak başlayın</p>
            <Link href="/projects/new">
              <Button size="lg" className="gradient-primary text-primary-foreground">
                <PlusIcon className="mr-2 h-5 w-5" />
                İlk Projenizi Oluşturun
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projectsWithValidation.map((project: any) => (
            <Card 
              key={project._id.toString()} 
              className="group border-2 hover:border-primary/50 transition-all duration-300 shadow-modern hover:shadow-modern-lg overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary"></div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {project.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm">
                      {project.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Durum</span>
                  <Badge variant={getStatusBadgeVariant(project.status)} className="font-medium">
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
                {project.templateId && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Kurum:</span>
                    <Badge variant="outline" className="font-medium">
                      {getInstitutionName(project.templateId.institution)}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {new Date(project.updatedAt).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                {project.latestValidation && (
                  <div className="flex items-center gap-2 p-2 rounded-lg border-2 bg-muted/30">
                    {project.latestValidation.passed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-green-700">Kural Kontrolü: Geçti</div>
                          <div className="text-xs text-muted-foreground">
                            {project.latestValidation.rulesChecked} kural kontrol edildi
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-orange-700">
                            {project.latestValidation.violationsCount} İhlal Tespit Edildi
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {project.latestValidation.rulesChecked} kural kontrol edildi
                          </div>
                        </div>
                      </>
                    )}
                    <div className="text-xs text-muted-foreground shrink-0">
                      {new Date(project.latestValidation.validatedAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </div>
                  </div>
                )}
                {!project.latestValidation && (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed bg-muted/20">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="text-xs text-muted-foreground">
                      Henüz kural kontrolü yapılmadı
                    </div>
                  </div>
                )}
                <Link href={`/projects/${project._id}/edit`}>
                  <Button variant="outline" className="w-full group-hover:border-primary group-hover:text-primary transition-colors">
                    Düzenle
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

