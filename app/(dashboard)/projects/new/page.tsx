'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeftIcon, ArrowRightIcon, UploadIcon, FileIcon, XIcon } from 'lucide-react';

interface Template {
  _id: string;
  name: string;
  institution: string;
  description: string;
}

interface Document {
  _id: string;
  originalName: string;
  size: number;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    institution: '',
    templateId: '',
    metadata: {
      budget: '',
      duration: '',
      keywords: '',
    },
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };

    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents');
        if (response.ok) {
          const data = await response.json();
          setDocuments(data);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
      }
    };

    fetchTemplates();
    fetchDocuments();
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.title || !formData.description || !formData.institution || !formData.templateId) {
        toast.error('Lütfen tüm alanları doldurun');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          institution: formData.institution,
          templateId: formData.templateId,
          sourceDocuments: selectedDocuments,
          metadata: {
            budget: formData.metadata.budget ? parseFloat(formData.metadata.budget) : undefined,
            duration: formData.metadata.duration ? parseInt(formData.metadata.duration) : undefined,
            keywords: formData.metadata.keywords
              ? formData.metadata.keywords.split(',').map((k) => k.trim())
              : undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Proje oluşturulamadı');
      }

      toast.success('Proje başarıyla oluşturuldu');
      router.push(`/projects/${data._id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDocument = (docId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
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
      <div>
        <h1 className="text-3xl font-bold">Yeni Proje Oluştur</h1>
        <p className="text-gray-600">Adım adım projenizi oluşturun</p>
      </div>

      <div className="space-y-4">
        <Progress value={(step / 3) * 100} className="h-2" />
        <div className="flex justify-between text-sm text-gray-600">
          <span className={step >= 1 ? 'font-medium text-primary' : ''}>1. Bilgi Toplama</span>
          <span className={step >= 2 ? 'font-medium text-primary' : ''}>2. Doküman Seçimi</span>
          <span className={step >= 3 ? 'font-medium text-primary' : ''}>3. Özet</span>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Proje Bilgileri</CardTitle>
            <CardDescription>Projenizin temel bilgilerini girin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Proje Başlığı</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Proje başlığını girin"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Proje Açıklaması</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Projenizi kısaca açıklayın"
                rows={4}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="institution">Hedef Kurum</Label>
                <Select
                  value={formData.institution}
                  onValueChange={(value) => setFormData({ ...formData, institution: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kurum seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tubitak">TÜBİTAK</SelectItem>
                    <SelectItem value="kosgeb">KOSGEB</SelectItem>
                    <SelectItem value="ufuk-avrupa">Ufuk Avrupa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateId">Şablon</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                  disabled={!formData.institution}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Şablon seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter((t) => t.institution === formData.institution)
                      .map((template) => (
                        <SelectItem key={template._id} value={template._id}>
                          {template.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Bütçe (TL)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.metadata.budget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      metadata: { ...formData.metadata, budget: e.target.value },
                    })
                  }
                  placeholder="Opsiyonel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Süre (Ay)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.metadata.duration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      metadata: { ...formData.metadata, duration: e.target.value },
                    })
                  }
                  placeholder="Opsiyonel"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Anahtar Kelimeler (virgülle ayırın)</Label>
              <Input
                id="keywords"
                value={formData.metadata.keywords}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    metadata: { ...formData.metadata, keywords: e.target.value },
                  })
                }
                placeholder="örnek: AI, makine öğrenmesi, veri analizi"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Document Selection */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Kaynak Dokümanlar</CardTitle>
            <CardDescription>Proje fikrinizi içeren dokümanları seçin (Opsiyonel)</CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Henüz doküman yüklenmemiş.</p>
                <Link href="/documents/upload" className="mt-4 inline-block">
                  <Button variant="outline">
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Doküman Yükle
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc._id}
                    className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedDocuments.includes(doc._id)
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleDocument(doc._id)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc._id)}
                        onChange={() => toggleDocument(doc._id)}
                        className="h-4 w-4"
                      />
                      <FileIcon className="h-6 w-6 text-gray-400" />
                      <div>
                        <p className="font-medium">{doc.originalName}</p>
                        <p className="text-sm text-gray-500">
                          {(doc.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Summary */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Özet</CardTitle>
            <CardDescription>Proje bilgilerinizi kontrol edin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Proje Başlığı</Label>
              <p className="mt-1">{formData.title}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Açıklama</Label>
              <p className="mt-1">{formData.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm font-medium text-gray-600">Hedef Kurum</Label>
                <p className="mt-1">{getInstitutionName(formData.institution)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Şablon</Label>
                <p className="mt-1">
                  {templates.find((t) => t._id === formData.templateId)?.name || '-'}
                </p>
              </div>
            </div>
            {selectedDocuments.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Seçilen Dokümanlar</Label>
                <ul className="mt-1 list-disc list-inside">
                  {selectedDocuments.map((docId) => {
                    const doc = documents.find((d) => d._id === docId);
                    return <li key={docId}>{doc?.originalName || docId}</li>;
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || isLoading}
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Geri
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={handleNext} disabled={isLoading}>
            İleri
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Oluşturuluyor...' : 'Projeyi Oluştur'}
          </Button>
        )}
      </div>
    </div>
  );
}

