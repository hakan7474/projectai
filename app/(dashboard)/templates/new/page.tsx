'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PlusIcon, TrashIcon, UploadIcon, Sparkles, FileIcon, XIcon, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import type { Section, Criteria } from '@/types';
import dynamic from 'next/dynamic';

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

// Import MDEditor CSS
import '@uiw/react-md-editor/markdown-editor.css';

interface UploadedDocument {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType?: string;
}

interface ExistingDocument {
  _id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConvertingToMarkdown, setIsConvertingToMarkdown] = useState(false);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [showMarkdownEditor, setShowMarkdownEditor] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<UploadedDocument | null>(null);
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentSource, setDocumentSource] = useState<'upload' | 'existing'>('upload');
  const [analysisResult, setAnalysisResult] = useState<{
    success: boolean;
    sectionsCount: number;
    criteriaCount: number;
    name?: string;
    description?: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    institution: '',
    name: '',
    description: '',
    isActive: true,
  });
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);

  // Load existing documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoadingDocuments(true);
      try {
        const response = await fetch('/api/documents');
        if (response.ok) {
          const docs = await response.json();
          // Filter only PDF and Word documents
          const filteredDocs = docs.filter((doc: ExistingDocument) => 
            doc.mimeType === 'application/pdf' || 
            doc.mimeType.includes('word') || 
            doc.mimeType.includes('msword')
          );
          setExistingDocuments(filteredDocs);
        }
      } catch (error) {
        console.error('Error loading documents:', error);
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    loadDocuments();
  }, []);

  const handleSelectExistingDocument = (documentId: string) => {
    const doc = existingDocuments.find(d => d._id === documentId);
    if (doc) {
      setUploadedDocument({
        id: doc._id,
        filename: doc.filename,
        originalName: doc.originalName,
        size: doc.size,
        mimeType: doc.mimeType,
      });
      setAnalysisResult(null);
      setMarkdownContent('');
      setShowMarkdownEditor(false);
      toast.success('Doküman seçildi');
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Sadece PDF veya Word dokümanları yükleyebilirsiniz');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Dosya boyutu 10MB\'dan büyük olamaz');
      return;
    }

    setIsLoading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const uploadResponse = await fetch('/api/documents/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || uploadData.details || 'Dosya yüklenemedi');
      }

      setUploadedDocument({
        id: uploadData.document.id,
        filename: uploadData.document.filename,
        originalName: uploadData.document.originalName,
        size: uploadData.document.size,
        mimeType: uploadData.document.mimeType,
      });

      // Show warning if processing failed but file was saved
      if (uploadData.warning) {
        toast.warning(uploadData.warning, { duration: 7000 });
      } else {
        toast.success('Doküman başarıyla yüklendi');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dosya yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeDocument = async () => {
    if (!uploadedDocument) {
      toast.error('Lütfen önce bir doküman yükleyin');
      return;
    }

    if (!formData.institution) {
      toast.error('Lütfen önce kurum seçin');
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/templates/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: uploadedDocument.id,
          institution: formData.institution,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Doküman analiz edilemedi');
      }

      if (data.success && data.template) {
        // Fill form with AI-generated data
        const sectionsCount = data.template.sections?.length || 0;
        const criteriaCount = data.template.criteria?.length || 0;
        
        setFormData({
          ...formData,
          name: data.template.name || formData.name,
          description: data.template.description || formData.description,
        });

        setSections(data.template.sections || []);
        setCriteria(data.template.criteria || []);

        // Store analysis result for display
        setAnalysisResult({
          success: true,
          sectionsCount,
          criteriaCount,
          name: data.template.name,
          description: data.template.description,
        });

        toast.success(
          `Doküman başarıyla analiz edildi! ${sectionsCount} bölüm ve ${criteriaCount} kriter bulundu. Form otomatik olarak dolduruldu.`,
          { duration: 5000 }
        );
      } else {
        throw new Error('Geçersiz analiz sonucu');
      }
    } catch (error) {
      console.error('Analyze error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Doküman analiz edilemedi';
      
      // Check if it's a warning about missing text
      if (errorMessage.includes('metin çıkarılamadı') || errorMessage.includes('extracted text')) {
        toast.error(
          'Dokümandan metin çıkarılamadı. PDF parse işlemi başarısız olmuş olabilir. Lütfen dokümanı kontrol edin veya Word formatında deneyin.',
          { duration: 7000 }
        );
      } else {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeUploadedDocument = () => {
    setUploadedDocument(null);
    setAnalysisResult(null);
    setMarkdownContent('');
    setShowMarkdownEditor(false);
    setDocumentSource('upload'); // Reset to upload mode
  };

  const handleConvertToMarkdown = async (createTemplate: boolean = false) => {
    if (!uploadedDocument) {
      toast.error('Lütfen önce bir doküman yükleyin');
      return;
    }

    if (createTemplate && !formData.institution) {
      toast.error('Şablon oluşturmak için önce kurum seçin');
      return;
    }

    setIsConvertingToMarkdown(true);
    setAnalysisResult(null); // Clear previous analysis results

    try {
      const response = await fetch('/api/documents/convert-to-markdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: uploadedDocument.id,
          institution: createTemplate ? formData.institution : undefined,
          createTemplate: createTemplate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'PDF Markdown formatına dönüştürülemedi');
      }

      if (data.success && data.markdown) {
        setMarkdownContent(data.markdown);
        setShowMarkdownEditor(true);
        
        // If template was created, populate form fields
        if (createTemplate && data.template) {
          const sectionsCount = data.template.sections?.length || 0;
          const criteriaCount = data.template.criteria?.length || 0;
          
          setFormData({
            ...formData,
            name: data.template.name || formData.name,
            description: data.template.description || formData.description,
          });

          setSections(data.template.sections || []);
          setCriteria(data.template.criteria || []);

          setAnalysisResult({
            success: true,
            sectionsCount,
            criteriaCount,
            name: data.template.name,
            description: data.template.description,
          });

          toast.success(
            `PDF Markdown'a dönüştürüldü ve şablon oluşturuldu! ${sectionsCount} bölüm ve ${criteriaCount} kriter bulundu. Form otomatik olarak dolduruldu.`,
            { duration: 6000 }
          );
        } else {
          toast.success('PDF başarıyla Markdown formatına dönüştürüldü');
        }
      } else {
        throw new Error('Geçersiz dönüştürme sonucu');
      }
    } catch (error) {
      console.error('Convert to Markdown error:', error);
      toast.error(error instanceof Error ? error.message : 'PDF dönüştürülemedi');
    } finally {
      setIsConvertingToMarkdown(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.institution || !formData.name || !formData.description) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          sections,
          criteria,
          sourceDocument: uploadedDocument?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Şablon oluşturulamadı');
      }

      toast.success('Şablon başarıyla oluşturuldu');
      // Redirect to edit page so user can add rules
      if (data._id) {
        router.push(`/templates/${data._id}/edit`);
      } else {
        router.push('/templates');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Yeni Şablon Oluştur</h1>
        <p className="text-gray-600">Kurum için yeni bir şablon oluşturun</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Şablon Dokümanı (Opsiyonel)</CardTitle>
            <CardDescription>
              PDF veya Word dokümanını yükleyin veya mevcut dokümanlardan seçin ve AI ile otomatik şablon yapısı oluşturun
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Document Source Selection */}
            {!uploadedDocument && (
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={documentSource === 'upload' ? 'default' : 'outline'}
                  onClick={() => setDocumentSource('upload')}
                  size="sm"
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Yeni Dosya Yükle
                </Button>
                <Button
                  type="button"
                  variant={documentSource === 'existing' ? 'default' : 'outline'}
                  onClick={() => setDocumentSource('existing')}
                  size="sm"
                  disabled={isLoadingDocuments || existingDocuments.length === 0}
                >
                  <FileIcon className="mr-2 h-4 w-4" />
                  Mevcut Doküman Seç {existingDocuments.length > 0 && `(${existingDocuments.length})`}
                </Button>
              </div>
            )}

            {!uploadedDocument && documentSource === 'existing' && (
              <div className="space-y-2">
                <Label>Mevcut Dokümanlardan Seçin</Label>
                {isLoadingDocuments ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-600">Dokümanlar yükleniyor...</span>
                  </div>
                ) : existingDocuments.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Henüz yüklenmiş doküman bulunmuyor.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setDocumentSource('upload')}
                    >
                      Yeni Dosya Yükle
                    </Button>
                  </div>
                ) : (
                  <Select
                    onValueChange={handleSelectExistingDocument}
                    value=""
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bir doküman seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingDocuments.map((doc) => (
                        <SelectItem key={doc._id} value={doc._id}>
                          <div className="flex items-center justify-between w-full">
                            <span className="flex items-center">
                              <FileIcon className="mr-2 h-4 w-4" />
                              {doc.originalName}
                            </span>
                            <span className="ml-4 text-xs text-gray-500">
                              {(doc.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {!uploadedDocument && documentSource === 'upload' && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="document-upload"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
                <label
                  htmlFor="document-upload"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <UploadIcon className="h-12 w-12 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    PDF veya Word dokümanını seçin
                  </span>
                  <span className="text-xs text-gray-500">
                    Maksimum 10MB
                  </span>
                </label>
              </div>
            )}

            {uploadedDocument && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileIcon className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{uploadedDocument.originalName}</p>
                      <p className="text-sm text-gray-500">
                        {(uploadedDocument.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadedDocument && uploadedDocument.mimeType === 'application/pdf' && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => handleConvertToMarkdown(false)}
                          disabled={isConvertingToMarkdown}
                          variant="outline"
                          size="sm"
                        >
                          {isConvertingToMarkdown ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Dönüştürülüyor...
                            </>
                          ) : (
                            <>
                              <FileText className="mr-2 h-4 w-4" />
                              PDF'yi Markdown'a Dönüştür
                            </>
                          )}
                        </Button>
                        {formData.institution && (
                          <Button
                            type="button"
                            onClick={() => handleConvertToMarkdown(true)}
                            disabled={isConvertingToMarkdown}
                            variant="default"
                            size="sm"
                          >
                            {isConvertingToMarkdown ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                İşleniyor...
                              </>
                            ) : (
                              <>
                                <FileText className="mr-2 h-4 w-4" />
                                Markdown'a Dönüştür ve Şablon Oluştur
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={removeUploadedDocument}
                      variant="ghost"
                      size="sm"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Kurum Seçimi ve AI Analiz Butonu */}
                <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="institution-for-analysis" className="text-sm font-semibold">
                        Kurum Seçin (AI Analiz için gerekli)
                      </Label>
                      <Select
                        value={formData.institution}
                        onValueChange={(value) => setFormData({ ...formData, institution: value })}
                      >
                        <SelectTrigger id="institution-for-analysis">
                          <SelectValue placeholder="Kurum seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tubitak">TÜBİTAK</SelectItem>
                          <SelectItem value="kosgeb">KOSGEB</SelectItem>
                          <SelectItem value="ufuk-avrupa">Ufuk Avrupa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      onClick={handleAnalyzeDocument}
                      disabled={isAnalyzing || !formData.institution}
                      className="w-full"
                      size="lg"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          AI Analiz Ediyor... Lütfen bekleyin
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          AI ile Dokümanı Analiz Et
                        </>
                      )}
                    </Button>

                    {!formData.institution && (
                      <p className="text-xs text-gray-600 text-center">
                        AI analizini başlatmak için önce kurum seçin
                      </p>
                    )}
                  </div>
                </div>

                {/* Analiz Sonuçları */}
                {analysisResult && (
                  <div className={`p-4 rounded-lg border-2 ${
                    analysisResult.success 
                      ? 'bg-green-50 border-green-300' 
                      : 'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {analysisResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2">
                          {analysisResult.success ? 'Analiz Başarılı!' : 'Analiz Başarısız'}
                        </h4>
                        {analysisResult.success && (
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700">Bulunan Bölüm Sayısı:</span>
                              <span className="font-bold text-green-700">
                                {analysisResult.sectionsCount}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700">Bulunan Kriter Sayısı:</span>
                              <span className="font-bold text-green-700">
                                {analysisResult.criteriaCount}
                              </span>
                            </div>
                            {analysisResult.name && (
                              <div className="pt-2 border-t border-green-200">
                                <p className="text-gray-700">
                                  <span className="font-semibold">Önerilen Şablon Adı:</span>{' '}
                                  {analysisResult.name}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-gray-600 pt-2">
                              Form otomatik olarak dolduruldu. Aşağıdaki bölümleri ve kriterleri kontrol edip düzenleyebilirsiniz.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Markdown Editor */}
                {showMarkdownEditor && markdownContent && (
                  <Card className="mt-4">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Markdown Editör</CardTitle>
                          <CardDescription>
                            PDF içeriği Markdown formatında. Düzenleyebilir ve formatlayabilirsiniz.
                          </CardDescription>
                        </div>
                        <Button
                          type="button"
                          onClick={() => setShowMarkdownEditor(false)}
                          variant="ghost"
                          size="sm"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div data-color-mode="light">
                        <MDEditor
                          value={markdownContent}
                          onChange={(value) => setMarkdownContent(value || '')}
                          height={500}
                          preview="edit"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Temel Bilgiler</CardTitle>
            <CardDescription>Şablonun temel bilgilerini girin</CardDescription>
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
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Oluşturuluyor...' : 'Şablonu Oluştur'}
          </Button>
        </div>
      </form>
    </div>
  );
}

