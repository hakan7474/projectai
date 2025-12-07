import { getAuthSession } from '@/lib/auth-helper';
import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Template from '@/models/Template';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusIcon, FileIcon, FileText, ArrowRight, Layers, CheckSquare2, Building2 } from 'lucide-react';

export default async function TemplatesPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  await connectDB();
  await ensureModelsRegistered();

  const templates = await Template.find()
    .populate('createdBy', 'name email')
    .populate('sourceDocument', 'originalName storagePath mimeType')
    .sort({ createdAt: -1 })
    .lean();

  const getInstitutionBadge = (institution: string) => {
    const badges: Record<string, string> = {
      tubitak: 'TÜBİTAK',
      kosgeb: 'KOSGEB',
      'ufuk-avrupa': 'Ufuk Avrupa',
    };
    return badges[institution] || institution;
  };

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Şablon Yönetimi
            </h1>
          </div>
          <p className="text-muted-foreground">Kurum şablonlarını yönetin</p>
        </div>
        <Link href="/templates/new">
          <Button size="lg" className="gradient-primary text-primary-foreground shadow-modern-lg hover:shadow-modern-lg hover:scale-105 transition-transform">
            <PlusIcon className="mr-2 h-5 w-5" />
            Yeni Şablon
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card className="border-2 shadow-modern-lg">
          <CardContent className="py-16 text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground mb-2">Henüz şablon oluşturulmamış</p>
            <p className="text-sm text-muted-foreground mb-6">İlk şablonu oluşturarak başlayın</p>
            <Link href="/templates/new">
              <Button size="lg" className="gradient-primary text-primary-foreground">
                <PlusIcon className="mr-2 h-5 w-5" />
                İlk Şablonu Oluşturun
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: any) => (
            <Card 
              key={template._id.toString()}
              className="group border-2 hover:border-primary/50 transition-all duration-300 shadow-modern hover:shadow-modern-lg overflow-hidden"
            >
              <div className={`h-2 ${template.isActive ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-gray-400 to-gray-500'}`}></div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-bold mb-1 group-hover:text-primary transition-colors line-clamp-1">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm">
                      {template.description}
                    </CardDescription>
                  </div>
                  <Badge variant={template.isActive ? 'default' : 'secondary'} className="shrink-0">
                    {template.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Kurum:</span>
                  <Badge variant="outline" className="font-medium">
                    {getInstitutionBadge(template.institution)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Layers className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">Bölümler</div>
                      <div className="text-sm font-bold">{template.sections?.length || 0}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <CheckSquare2 className="h-4 w-4 text-accent" />
                    <div>
                      <div className="text-xs text-muted-foreground">Kriterler</div>
                      <div className="text-sm font-bold">{template.criteria?.length || 0}</div>
                    </div>
                  </div>
                </div>
                {template.sourceDocument && (
                  <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <FileIcon className="h-4 w-4 text-primary shrink-0" />
                    <Link
                      href={template.sourceDocument.storagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline truncate"
                    >
                      {template.sourceDocument.originalName}
                    </Link>
                  </div>
                )}
                <Link href={`/templates/${template._id}/edit`}>
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

