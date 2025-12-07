'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PlusIcon, TrashIcon, FileIcon, DownloadIcon, Globe, Loader2, EditIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Section, Criteria, TemplateRule } from '@/types';

interface SourceDocument {
  _id: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
}

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceDocument, setSourceDocument] = useState<SourceDocument | null>(null);
  const [formData, setFormData] = useState({
    institution: '',
    name: '',
    description: '',
    isActive: true,
  });
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [rules, setRules] = useState<TemplateRule[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [isExtractingRules, setIsExtractingRules] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<TemplateRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: '',
    isRequired: false,
  });
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [availableDocuments, setAvailableDocuments] = useState<any[]>([]);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`/api/templates/${templateId}`);
        if (!response.ok) {
          throw new Error('Şablon yüklenemedi');
        }
        const data = await response.json();
        setFormData({
          institution: data.institution,
          name: data.name,
          description: data.description,
          isActive: data.isActive,
        });
        setSections(data.sections || []);
        setCriteria(data.criteria || []);
        if (data.sourceDocument) {
          setSourceDocument(data.sourceDocument);
        }
      } catch (error) {
        toast.error('Şablon yüklenemedi');
        router.push('/templates');
      } finally {
        setIsLoading(false);
      }
    };

    if (templateId) {
      fetchTemplate();
      fetchRules();
      fetchDocuments();
    }
  }, [templateId, router]);

  const fetchRules = async () => {
    try {
      setIsLoadingRules(true);
      const response = await fetch(`/api/templates/${templateId}/rules`);
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    } finally {
      setIsLoadingRules(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const docs = await response.json();
        setAvailableDocuments(docs.filter((doc: any) => 
          doc.mimeType === 'application/pdf' || 
          doc.mimeType.includes('word') || 
          doc.mimeType.includes('msword')
        ));
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const addSection = () => {
    setSections([
      ...sections,
      {
        id: `section-${Date.now()}`,
        title: '',
        required: false,
        format: 'text',
      },
    ]);
  };

  const removeSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, field: keyof Section, value: unknown) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

  const addCriterion = () => {
    setCriteria([
      ...criteria,
      {
        title: '',
        description: '',
      },
    ]);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, field: keyof Criteria, value: unknown) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [field]: value };
    setCriteria(updated);
  };

  const handleCreateRule = async () => {
    if (!ruleForm.title || !ruleForm.description) {
      toast.error('Başlık ve açıklama gereklidir');
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ruleForm.title,
          description: ruleForm.description,
          category: ruleForm.category || undefined,
          priority: ruleForm.priority ? parseInt(ruleForm.priority) : undefined,
          isRequired: ruleForm.isRequired,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kural oluşturulamadı');
      }

      toast.success('Kural başarıyla eklendi');
      setShowRuleDialog(false);
      setRuleForm({ title: '', description: '', category: '', priority: '', isRequired: false });
      fetchRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    }
  };

  const handleUpdateRule = async (ruleId: string) => {
    if (!ruleForm.title || !ruleForm.description) {
      toast.error('Başlık ve açıklama gereklidir');
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ruleForm.title,
          description: ruleForm.description,
          category: ruleForm.category || undefined,
          priority: ruleForm.priority ? parseInt(ruleForm.priority) : undefined,
          isRequired: ruleForm.isRequired,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kural güncellenemedi');
      }

      toast.success('Kural başarıyla güncellendi');
      setShowRuleDialog(false);
      setEditingRule(null);
      setRuleForm({ title: '', description: '', category: '', priority: '', isRequired: false });
      fetchRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Bu kuralı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateId}/rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kural silinemedi');
      }

      toast.success('Kural başarıyla silindi');
      fetchRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    }
  };

  const handleExtractFromDocument = async () => {
    if (!selectedDocumentId) {
      toast.error('Lütfen bir doküman seçin');
      return;
    }

    setIsExtractingRules(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/rules/from-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: selectedDocumentId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kurallar çıkarılamadı');
      }

      const data = await response.json();
      toast.success(`${data.count} kural başarıyla eklendi`);
      setSelectedDocumentId('');
      fetchRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsExtractingRules(false);
    }
  };

  const handleExtractFromWebsite = async () => {
    if (!websiteUrl) {
      toast.error('Lütfen bir URL girin');
      return;
    }

    setIsExtractingRules(true);
    try {
      const response = await fetch(`/api/templates/${templateId}/rules/from-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kurallar çıkarılamadı');
      }

      const data = await response.json();
      toast.success(`${data.count} kural başarıyla eklendi`);
      setWebsiteUrl('');
      fetchRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsExtractingRules(false);
    }
  };

  const openEditDialog = (rule: TemplateRule | any) => {
    setEditingRule(rule);
    setRuleForm({
      title: rule.title || '',
      description: rule.description || '',
      category: rule.category || '',
      priority: rule.priority?.toString() || '',
      isRequired: rule.isRequired || false,
    });
    setShowRuleDialog(true);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    setRuleForm({ title: '', description: '', category: '', priority: '', isRequired: false });
    setShowRuleDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.institution || !formData.name || !formData.description) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          sections,
          criteria,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Şablon güncellenemedi');
      }

      toast.success('Şablon başarıyla güncellendi');
      router.push('/templates');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Şablon Düzenle</h1>
        <p className="text-gray-600">Şablon bilgilerini güncelleyin</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">Genel</TabsTrigger>
          <TabsTrigger value="sections">Bölümler</TabsTrigger>
          <TabsTrigger value="criteria">Kriterler</TabsTrigger>
          <TabsTrigger value="rules">Kurallar</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source Document Display */}
        {sourceDocument && (
          <Card>
            <CardHeader>
              <CardTitle>Kaynak Doküman</CardTitle>
              <CardDescription>Bu şablonun kaynak dokümanı</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileIcon className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{sourceDocument.originalName}</p>
                    <p className="text-sm text-gray-500">
                      {sourceDocument.mimeType === 'application/pdf' ? 'PDF' : 'Word'} Doküman
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {sourceDocument.mimeType === 'application/pdf' ? (
                    <a
                      href={sourceDocument.storagePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      <FileIcon className="mr-2 h-4 w-4" />
                      PDF'i Görüntüle
                    </a>
                  ) : (
                    <a
                      href={sourceDocument.storagePath}
                      download={sourceDocument.originalName}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      İndir
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Temel Bilgiler</CardTitle>
            <CardDescription>Şablonun temel bilgilerini güncelleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="institution">Kurum</Label>
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
              <Label htmlFor="name">Şablon Adı</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">Aktif</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bölümler</CardTitle>
                <CardDescription>Proje dokümanının bölümlerini tanımlayın</CardDescription>
              </div>
              <Button type="button" onClick={addSection} variant="outline" size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Bölüm Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sections.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Henüz bölüm eklenmedi</p>
            ) : (
              sections.map((section, index) => (
                <Card key={section.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Bölüm {index + 1}</h4>
                        <Button
                          type="button"
                          onClick={() => removeSection(index)}
                          variant="ghost"
                          size="sm"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Başlık</Label>
                          <Input
                            value={section.title}
                            onChange={(e) => updateSection(index, 'title', e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Format</Label>
                          <Select
                            value={section.format || 'text'}
                            onValueChange={(value) =>
                              updateSection(index, 'format', value as Section['format'])
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Metin</SelectItem>
                              <SelectItem value="rich-text">Zengin Metin</SelectItem>
                              <SelectItem value="table">Tablo</SelectItem>
                              <SelectItem value="budget">Bütçe</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Maksimum Uzunluk</Label>
                          <Input
                            type="number"
                            value={section.maxLength || ''}
                            onChange={(e) =>
                              updateSection(index, 'maxLength', parseInt(e.target.value) || undefined)
                            }
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`required-${index}`}
                            checked={section.required}
                            onChange={(e) => updateSection(index, 'required', e.target.checked)}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`required-${index}`}>Zorunlu</Label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Talimatlar (Opsiyonel)</Label>
                        <Textarea
                          value={section.instructions || ''}
                          onChange={(e) => updateSection(index, 'instructions', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Değerlendirme Kriterleri</CardTitle>
                <CardDescription>Proje değerlendirme kriterlerini tanımlayın</CardDescription>
              </div>
              <Button type="button" onClick={addCriterion} variant="outline" size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Kriter Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {criteria.length === 0 ? (
              <p className="text-center text-sm text-gray-500">Henüz kriter eklenmedi</p>
            ) : (
              criteria.map((criterion, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Kriter {index + 1}</h4>
                        <Button
                          type="button"
                          onClick={() => removeCriterion(index)}
                          variant="ghost"
                          size="sm"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label>Başlık</Label>
                        <Input
                          value={criterion.title}
                          onChange={(e) => updateCriterion(index, 'title', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Açıklama</Label>
                        <Textarea
                          value={criterion.description}
                          onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                          required
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ağırlık (Opsiyonel)</Label>
                        <Input
                          type="number"
                          value={criterion.weight || ''}
                          onChange={(e) =>
                            updateCriterion(index, 'weight', parseFloat(e.target.value) || undefined)
                          }
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                İptal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="sections">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bölümler</CardTitle>
                    <CardDescription>Proje dokümanının bölümlerini tanımlayın</CardDescription>
                  </div>
                  <Button type="button" onClick={addSection} variant="outline" size="sm">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Bölüm Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {sections.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">Henüz bölüm eklenmedi</p>
                ) : (
                  sections.map((section, index) => (
                    <Card key={section.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Bölüm {index + 1}</h4>
                            <Button
                              type="button"
                              onClick={() => removeSection(index)}
                              variant="ghost"
                              size="sm"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Başlık</Label>
                              <Input
                                value={section.title}
                                onChange={(e) => updateSection(index, 'title', e.target.value)}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Format</Label>
                              <Select
                                value={section.format || 'text'}
                                onValueChange={(value) =>
                                  updateSection(index, 'format', value as Section['format'])
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">Metin</SelectItem>
                                  <SelectItem value="rich-text">Zengin Metin</SelectItem>
                                  <SelectItem value="table">Tablo</SelectItem>
                                  <SelectItem value="budget">Bütçe</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Maksimum Uzunluk</Label>
                              <Input
                                type="number"
                                value={section.maxLength || ''}
                                onChange={(e) =>
                                  updateSection(index, 'maxLength', parseInt(e.target.value) || undefined)
                                }
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`required-${index}`}
                                checked={section.required}
                                onChange={(e) => updateSection(index, 'required', e.target.checked)}
                                className="h-4 w-4"
                              />
                              <Label htmlFor={`required-${index}`}>Zorunlu</Label>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Talimatlar (Opsiyonel)</Label>
                            <Textarea
                              value={section.instructions || ''}
                              onChange={(e) => updateSection(index, 'instructions', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                İptal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="criteria">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Değerlendirme Kriterleri</CardTitle>
                    <CardDescription>Proje değerlendirme kriterlerini tanımlayın</CardDescription>
                  </div>
                  <Button type="button" onClick={addCriterion} variant="outline" size="sm">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Kriter Ekle
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {criteria.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">Henüz kriter eklenmedi</p>
                ) : (
                  criteria.map((criterion, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Kriter {index + 1}</h4>
                            <Button
                              type="button"
                              onClick={() => removeCriterion(index)}
                              variant="ghost"
                              size="sm"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label>Başlık</Label>
                            <Input
                              value={criterion.title}
                              onChange={(e) => updateCriterion(index, 'title', e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Açıklama</Label>
                            <Textarea
                              value={criterion.description}
                              onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                              required
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Ağırlık (Opsiyonel)</Label>
                            <Input
                              type="number"
                              value={criterion.weight || ''}
                              onChange={(e) =>
                                updateCriterion(index, 'weight', parseFloat(e.target.value) || undefined)
                              }
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                İptal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Kurallar</CardTitle>
                  <CardDescription>Şablon için ek kriterler ve kurallar</CardDescription>
                </div>
                <Button onClick={openCreateDialog} variant="outline" size="sm">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Manuel Kural Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Extract from Document */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dokümandan Kural Çıkar</CardTitle>
                  <CardDescription>Yüklenmiş bir dokümandan AI ile kuralları otomatik çıkar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Doküman Seç</Label>
                    <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Doküman seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDocuments.map((doc) => (
                          <SelectItem key={doc._id} value={doc._id}>
                            {doc.originalName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleExtractFromDocument} 
                    disabled={!selectedDocumentId || isExtractingRules}
                    variant="outline"
                  >
                    {isExtractingRules ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Çıkarılıyor...
                      </>
                    ) : (
                      <>
                        <FileIcon className="mr-2 h-4 w-4" />
                        Dokümandan Çıkar
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Extract from Website */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Web Sitesinden Kural Çıkar</CardTitle>
                  <CardDescription>Web sitesi URL'i vererek AI ile kuralları otomatik çıkar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Web Sitesi URL</Label>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleExtractFromWebsite} 
                    disabled={!websiteUrl || isExtractingRules}
                    variant="outline"
                  >
                    {isExtractingRules ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Çıkarılıyor...
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Web Sitesinden Çıkar
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Rules List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Mevcut Kurallar ({rules.length})</h3>
                {isLoadingRules ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : rules.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-8">Henüz kural eklenmedi</p>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule: any) => {
                      const ruleId = rule._id?.toString() || rule.id?.toString() || '';
                      return (
                        <Card key={ruleId}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold">{rule.title}</h4>
                                  {rule.isRequired && (
                                    <Badge variant="destructive">Zorunlu</Badge>
                                  )}
                                  {rule.category && (
                                    <Badge variant="outline">{rule.category}</Badge>
                                  )}
                                  {rule.priority && (
                                    <Badge variant="secondary">Öncelik: {rule.priority}</Badge>
                                  )}
                                  {rule.sourceType === 'document' && (
                                    <Badge variant="outline">Doküman</Badge>
                                  )}
                                  {rule.sourceType === 'website' && (
                                    <Badge variant="outline">Web</Badge>
                                  )}
                                  {rule.sourceType === 'manual' && (
                                    <Badge variant="outline">Manuel</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">{rule.description}</p>
                                {rule.sourceUrl && (
                                  <p className="text-xs text-gray-500">
                                    Kaynak: <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{rule.sourceUrl}</a>
                                  </p>
                                )}
                                {rule.sourceDocument && typeof rule.sourceDocument === 'object' && rule.sourceDocument.originalName && (
                                  <p className="text-xs text-gray-500">
                                    Kaynak Doküman: {rule.sourceDocument.originalName}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(rule)}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRule(ruleId)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Kural Düzenle' : 'Yeni Kural Ekle'}</DialogTitle>
            <DialogDescription>
              {editingRule ? 'Kural bilgilerini güncelleyin' : 'Yeni bir kural ekleyin'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Başlık *</Label>
              <Input
                value={ruleForm.title}
                onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Açıklama *</Label>
              <Textarea
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                required
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  value={ruleForm.category}
                  onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                  placeholder="şartname, değerlendirme, teknik..."
                />
              </div>
              <div className="space-y-2">
                <Label>Öncelik (1-10)</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isRequired"
                checked={ruleForm.isRequired}
                onChange={(e) => setRuleForm({ ...ruleForm, isRequired: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isRequired">Zorunlu Kural</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
                İptal
              </Button>
              <Button
                onClick={() => {
                  if (editingRule) {
                    const ruleId = (editingRule as any)._id?.toString() || (editingRule as any).id?.toString() || '';
                    handleUpdateRule(ruleId);
                  } else {
                    handleCreateRule();
                  }
                }}
              >
                {editingRule ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

