'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Save, Loader2, CheckCircle2, XCircle, Eye, FileText, ShieldCheck, Download, FileDown, Code, Table2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import dynamic from 'next/dynamic';

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

// Import MDEditor CSS
import '@uiw/react-md-editor/markdown-editor.css';

// Mermaid will be initialized in the MDEditor preview via useEffect

interface ProjectData {
  _id: string;
  title: string;
  description: string;
  templateId: {
    _id: string;
    name: string;
    institution: string;
    sections: Array<{
      id: string;
      title: string;
      required: boolean;
      maxLength?: number;
      format: string;
      instructions?: string;
    }>;
  };
  content: Record<string, { text: string; aiGenerated: boolean; version: number }>;
  status: string;
}

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, string>>({});
  const [generationProgress, setGenerationProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    currentSection?: string;
    currentSectionTitle?: string;
    message: string;
    completedSections: string[];
    errorSections: string[];
    sectionContents: Record<string, string>; // Store section contents for preview
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    message: '',
    completedSections: [],
    errorSections: [],
    sectionContents: {},
  });
  const [showConsistencyPreview, setShowConsistencyPreview] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    passed: boolean;
    violations: Array<{
      ruleId: string;
      title: string;
      description: string;
      severity: string;
      rule?: {
        category?: string;
        priority?: number;
        isRequired?: boolean;
      };
    }>;
    rulesChecked: number;
    violationsCount: number;
  } | null>(null);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [mermaidInitialized, setMermaidInitialized] = useState(false);

  // Initialize Mermaid when component mounts
  useEffect(() => {
    if (typeof window === 'undefined' || mermaidInitialized) return;

    const initMermaid = async () => {
      try {
        // Dynamic import with error handling
        let mermaid;
        try {
          const mermaidModule = await import('mermaid');
          mermaid = mermaidModule.default || mermaidModule;
          
          // Check if mermaid is actually available
          if (!mermaid || (typeof mermaid !== 'object' && typeof mermaid !== 'function')) {
            throw new Error('Mermaid module is not valid');
          }
        } catch (importError: any) {
          // Silently fail if mermaid is not installed - it's optional
          console.warn('Mermaid not available. Gantt charts will not render. Install with: npm install mermaid', importError?.message || importError);
          return;
        }
        
        if (!mermaid || typeof mermaid.initialize !== 'function') {
          console.warn('Mermaid module not available or invalid');
          return;
        }
        
        mermaid.initialize({
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose',
          gantt: {
            axisFormat: '%Y-%m-%d',
            leftPadding: 75,
            gridLineStartPadding: 35,
            fontSize: 11,
            numberSectionStyles: 4,
            topPadding: 25,
          },
        });

        setMermaidInitialized(true);

        // Render existing mermaid blocks
        const renderMermaidBlocks = () => {
          const mermaidBlocks = document.querySelectorAll('code.language-mermaid:not(.mermaid-rendered)');
          mermaidBlocks.forEach((block, index) => {
            const id = `mermaid-${index}-${Date.now()}`;
            const graphDefinition = block.textContent || '';
            
            if (graphDefinition.trim()) {
              const mermaidDiv = document.createElement('div');
              mermaidDiv.className = 'mermaid mermaid-rendered';
              mermaidDiv.id = id;
              mermaidDiv.textContent = graphDefinition;
              
              // Detect diagram type for styling
              if (graphDefinition.toLowerCase().includes('gantt')) {
                mermaidDiv.setAttribute('data-diagram-type', 'gantt');
              } else if (graphDefinition.toLowerCase().includes('graph') || graphDefinition.toLowerCase().includes('flowchart')) {
                mermaidDiv.setAttribute('data-diagram-type', 'flowchart');
              }
              
              const preElement = block.parentElement;
              if (preElement && !preElement.classList.contains('mermaid-rendered')) {
                preElement.replaceWith(mermaidDiv);
                
                // Mermaid v10+ uses run() method
                if (mermaid.run && typeof mermaid.run === 'function') {
                  mermaid.run({
                    nodes: [mermaidDiv],
                  }).catch((error) => {
                    console.error('Mermaid rendering error:', error);
                  });
                } else if (mermaid.contentLoaded) {
                  // Fallback for older versions
                  mermaid.contentLoaded();
                }
              }
            }
          });
        };

        // Initial render with delay to ensure MDEditor is ready
        setTimeout(renderMermaidBlocks, 1000);

        // Watch for new mermaid blocks (when MDEditor preview updates)
        let renderTimeout: NodeJS.Timeout;
        const debouncedRender = () => {
          clearTimeout(renderTimeout);
          renderTimeout = setTimeout(renderMermaidBlocks, 300);
        };

        const observer = new MutationObserver(debouncedRender);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        // Also listen for MDEditor preview updates
        const mdEditorObserver = new MutationObserver(debouncedRender);
        const mdEditorContainers = document.querySelectorAll('.w-md-editor-preview');
        mdEditorContainers.forEach((container) => {
          mdEditorObserver.observe(container, {
            childList: true,
            subtree: true,
          });
        });

        return () => {
          observer.disconnect();
          mdEditorObserver.disconnect();
          clearTimeout(renderTimeout);
        };
      } catch (error) {
        console.error('Failed to initialize Mermaid:', error);
      }
    };

    initMermaid();
  }, [mermaidInitialized]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error('Proje yüklenemedi');
        }
        const data = await response.json();
        setProject(data);
        
        const initialContent: Record<string, string> = {};
        if (data.content) {
          const contentObj = data.content instanceof Map 
            ? Object.fromEntries(data.content) 
            : data.content;
          
          Object.keys(contentObj).forEach((sectionId) => {
            const sectionContent = contentObj[sectionId];
            initialContent[sectionId] = sectionContent?.text || '';
          });
        }
        setContent(initialContent);
      } catch (error) {
        toast.error('Proje yüklenemedi');
        router.push('/projects');
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId, router]);

  const handleContentChange = (sectionId: string, value: string) => {
    setContent({ ...content, [sectionId]: value });
  };

  const handleGenerateSection = async (sectionId: string) => {
    setIsGenerating(sectionId);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          sectionId,
          prompt: `${project?.templateId.sections.find((s) => s.id === sectionId)?.title} bölümünü yaz`,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        throw new Error('Sunucudan geçersiz yanıt alındı');
      }

      if (!response.ok) {
        const errorMessage = data?.details || data?.error || `Sunucu hatası: ${response.status}`;
        console.error('AI Generate Error:', {
          status: response.status,
          statusText: response.statusText,
          error: data?.error,
          details: data?.details,
          fullResponse: data,
        });
        throw new Error(errorMessage);
      }

      if (!data.text) {
        throw new Error('AI yanıtında metin bulunamadı');
      }

      handleContentChange(sectionId, data.text);
      toast.success('Bölüm başarıyla oluşturuldu');
    } catch (error) {
      console.error('Generate section error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
      toast.error(`AI ile metin üretilemedi: ${errorMessage}`);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleGenerateAll = async () => {
    setIsGenerating('all');
    
    // Initialize progress dialog
    setGenerationProgress({
      isOpen: true,
      current: 0,
      total: project?.templateId.sections.length || 0,
      message: 'İçerik oluşturma başlatılıyor...',
      completedSections: [],
      errorSections: [],
      sectionContents: {},
    });

    try {
      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error('Sunucu hatası');
      }

      if (!response.body) {
        throw new Error('Yanıt gövdesi bulunamadı');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const results: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              switch (data.type) {
                case 'start':
                  setGenerationProgress(prev => ({
                    ...prev,
                    total: data.total,
                    current: 0,
                    message: data.message,
                  }));
                  break;
                  
                case 'progress':
                  setGenerationProgress(prev => ({
                    ...prev,
                    current: data.current,
                    total: data.total,
                    currentSection: data.sectionId,
                    currentSectionTitle: data.sectionTitle,
                    message: data.message,
                  }));
                  break;
                  
                case 'section-complete':
                  if (data.sectionId && data.sectionId !== '') {
                    // Get the section content from event data, results, or current content
                    const sectionContent = data.sectionContent || results[data.sectionId] || content[data.sectionId] || '';
                    if (sectionContent) {
                      results[data.sectionId] = sectionContent;
                    }
                    setGenerationProgress(prev => ({
                      ...prev,
                      current: data.current,
                      total: data.total,
                      message: data.message,
                      completedSections: [...prev.completedSections, data.sectionId],
                      sectionContents: {
                        ...prev.sectionContents,
                        [data.sectionId]: sectionContent,
                      },
                    }));
                  }
                  break;
                  
                case 'section-error':
                  setGenerationProgress(prev => ({
                    ...prev,
                    current: data.current,
                    total: data.total,
                    message: data.message,
                    errorSections: [...prev.errorSections, data.sectionId],
                  }));
                  toast.error(`"${data.sectionTitle}" bölümü oluşturulurken hata: ${data.error}`);
                  break;
                  
                case 'complete':
                  if (data.results) {
                    Object.assign(results, data.results);
                    
                    // Update content in state
                    const updatedContent = { ...content };
                    Object.keys(results).forEach((sectionId) => {
                      if (results[sectionId]) {
                        updatedContent[sectionId] = results[sectionId];
                      }
                    });
                    setContent(updatedContent);
                    
                    // Update section contents in progress state
                    setGenerationProgress(prev => ({
                      ...prev,
                      current: data.total,
                      total: data.total,
                      message: data.message,
                      sectionContents: {
                        ...prev.sectionContents,
                        ...results,
                      },
                    }));
                  } else {
                    setGenerationProgress(prev => ({
                      ...prev,
                      current: data.total,
                      total: data.total,
                      message: data.message,
                    }));
                  }
                  
                  // Reload project to get the latest content from database
                  try {
                    const projectResponse = await fetch(`/api/projects/${projectId}`);
                    if (projectResponse.ok) {
                      const projectData = await projectResponse.json();
                      setProject(projectData);
                      
                      if (projectData.content) {
                        const contentObj = projectData.content instanceof Map 
                          ? Object.fromEntries(projectData.content) 
                          : projectData.content;
                        
                        const dbContent: Record<string, string> = {};
                        Object.keys(contentObj).forEach((sectionId) => {
                          const sectionContent = contentObj[sectionId];
                          dbContent[sectionId] = sectionContent?.text || '';
                        });
                        setContent(dbContent);
                      }
                    }
                  } catch (reloadError) {
                    console.error('Error reloading project:', reloadError);
                  }
                  
                  setTimeout(() => {
                    setGenerationProgress(prev => ({ ...prev, isOpen: false }));
                    toast.success('Tüm bölümler başarıyla oluşturuldu ve veritabanına kaydedildi');
                  }, 1500);
                  break;
                  
                case 'error':
                  throw new Error(data.error || data.message || 'Bilinmeyen hata');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError, line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Generate all error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
      toast.error(`AI ile içerik üretilemedi: ${errorMessage}`);
      setGenerationProgress(prev => ({
        ...prev,
        isOpen: false,
      }));
    } finally {
      setIsGenerating(null);
    }
  };

  const handleValidateRules = async () => {
    setIsValidating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/validate-rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Get response text first to handle both JSON and non-JSON responses
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError) {
        console.error('Validation API error - Failed to read response text:', textError);
        throw new Error(`Sunucu yanıtı okunamadı: ${response.status} ${response.statusText || 'Bilinmeyen hata'}`);
      }
      
      if (!response.ok) {
        let errorMessage = 'Kural kontrolü yapılamadı';
        
        // Log basic info first
        console.error('Validation API error - Status:', response.status);
        console.error('Validation API error - StatusText:', response.statusText);
        console.error('Validation API error - ResponseText length:', responseText?.length || 0);
        
        if (!responseText || responseText.trim().length === 0) {
          // Empty response - server-side exception likely
          console.error('Validation API error - Empty response received (likely server-side exception)');
          errorMessage = `Sunucu hatası (${response.status}): Lütfen server console loglarını kontrol edin. Muhtemelen AI API hatası veya veritabanı hatası.`;
        } else {
          try {
            console.error('Validation API error - ResponseText preview:', responseText.substring(0, 200));
            const errorData = JSON.parse(responseText);
            console.error('Validation API error - Parsed error data:', errorData);
            errorMessage = errorData.message || errorData.error || errorData.details || errorMessage;
          } catch (parseError) {
            // If JSON parse fails, use the raw text or status
            console.error('Validation API error - JSON parse failed:', parseError);
            console.error('Validation API error - Raw response:', responseText);
            errorMessage = responseText || `HTTP ${response.status}: ${response.statusText || 'Sunucu hatası'}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      // Parse successful response
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response JSON:', {
          responseText: responseText.substring(0, 500),
          error: parseError,
        });
        throw new Error('Sunucudan geçersiz yanıt alındı');
      }
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Geçersiz yanıt formatı');
      }

      // Ensure required fields exist
      const validationResults = {
        passed: data.passed ?? false,
        violations: Array.isArray(data.violations) ? data.violations : [],
        rulesChecked: data.rulesChecked ?? 0,
        violationsCount: data.violationsCount ?? (Array.isArray(data.violations) ? data.violations.length : 0),
      };

      setValidationResults(validationResults);
      setShowValidationDialog(true);
      
      if (validationResults.passed) {
        toast.success('Tüm kurallar başarıyla geçti!');
      } else {
        toast.warning(`${validationResults.violationsCount} kural ihlali tespit edildi`);
      }
    } catch (error) {
      console.error('Validation error:', {
        error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Kural kontrolü yapılamadı';
      toast.error(errorMessage);
      
      // Show error in dialog if possible
      setValidationResults({
        passed: false,
        violations: [],
        rulesChecked: 0,
        violationsCount: 0,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    try {
      toast.info(`${format.toUpperCase()} formatında indiriliyor...`);
      
      const response = await fetch(`/api/projects/${projectId}/export?format=${format}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Dışa aktarma başarısız oldu' }));
        throw new Error(errorData.error || 'Dışa aktarma başarısız oldu');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.title || 'proje'}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${format.toUpperCase()} formatında başarıyla indirildi`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Dışa aktarma başarısız oldu');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const contentToSave: Record<string, any> = {};
      Object.keys(content).forEach((sectionId) => {
        const existing = project?.content?.[sectionId];
        contentToSave[sectionId] = {
          text: content[sectionId] || '',
          aiGenerated: existing?.aiGenerated || false,
        };
      });

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: contentToSave,
        }),
      });

      let data: any;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Sunucudan boş yanıt alındı');
        }
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse JSON response:', parseError);
          console.error('Response text:', responseText);
          throw new Error(`Sunucudan geçersiz yanıt alındı: ${responseText.substring(0, 100)}`);
        }
      } catch (jsonError) {
        console.error('Failed to get response:', jsonError);
        throw new Error('Sunucudan yanıt alınamadı');
      }

      if (!response.ok) {
        // Handle different error formats
        let errorMessage = `Sunucu hatası: ${response.status}`;
        
        if (data) {
          if (typeof data === 'string') {
            errorMessage = data;
          } else if (data.error) {
            errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
          } else if (data.details) {
            errorMessage = typeof data.details === 'string' ? data.details : JSON.stringify(data.details);
          } else if (data.message) {
            errorMessage = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
          }
        }
        
        console.error('Save Error:', {
          status: response.status,
          statusText: response.statusText,
          error: data?.error,
          details: data?.details,
          message: data?.message,
          fullResponse: data,
        });
        throw new Error(errorMessage);
      }

      if (data.content) {
        const updatedContent: Record<string, string> = {};
        const contentObj = data.content instanceof Map 
          ? Object.fromEntries(data.content) 
          : data.content;
        
        Object.keys(contentObj).forEach((sectionId) => {
          const sectionContent = contentObj[sectionId];
          updatedContent[sectionId] = sectionContent?.text || '';
        });
        setContent(updatedContent);
        setProject(data);
      }

      toast.success('Proje başarıyla kaydedildi');
    } catch (error) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bir hata oluştu';
      toast.error(`Proje kaydedilemedi: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const sections = project.templateId?.sections || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.title}</h1>
          <p className="text-gray-600">{project.description}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleValidateRules} disabled={isValidating} variant="outline">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {isValidating ? 'Kontrol Ediliyor...' : 'Kural Kontrolü'}
          </Button>
          <Button onClick={handleGenerateAll} disabled={isGenerating === 'all'} variant="outline">
            <Sparkles className="mr-2 h-4 w-4" />
            {isGenerating === 'all' ? 'Oluşturuluyor...' : 'Tümünü AI ile Oluştur'}
          </Button>
          <Button 
            onClick={() => handleExport('pdf')} 
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <FileDown className="mr-2 h-4 w-4" />
            PDF İndir
          </Button>
          <Button 
            onClick={() => handleExport('docx')} 
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <FileText className="mr-2 h-4 w-4" />
            Word İndir
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gradient-primary text-primary-foreground">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{section.title}</CardTitle>
                  {section.instructions && (
                    <CardDescription className="mt-2">{section.instructions}</CardDescription>
                  )}
                </div>
                <div className="flex gap-2">
                  {section.required && <Badge variant="destructive">Zorunlu</Badge>}
                  {section.maxLength && (
                    <Badge variant="outline">Maks: {section.maxLength} karakter</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateSection(section.id)}
                    disabled={isGenerating === section.id}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {isGenerating === section.id ? 'Oluşturuluyor...' : 'AI ile Oluştur'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div data-color-mode="light" className="w-full">
                  <MDEditor
                    value={content[section.id] || ''}
                    onChange={(value) => handleContentChange(section.id, value || '')}
                    height={600}
                    preview="edit"
                    data-color-mode="light"
                    previewOptions={{
                      rehypePlugins: [],
                    }}
                    hideToolbar={false}
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500 border-t pt-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    {section.maxLength && (
                      <span className="font-medium">
                        {content[section.id]?.length || 0} / {section.maxLength} karakter
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-2 text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700"
                      onClick={() => {
                        const tableExample = `| Özellik | Açıklama | Durum |
|---------|-----------|--------|
| Özellik 1 | Detaylı açıklama | ✅ Tamamlandı |
| Özellik 2 | Başka bir açıklama | 🚧 Devam Ediyor |
| Özellik 3 | Son açıklama | ⏳ Beklemede |`;
                        const currentContent = content[section.id] || '';
                        handleContentChange(section.id, currentContent + (currentContent ? '\n\n' : '') + tableExample);
                        toast.info('Tablo örneği eklendi! Preview\'da renkli tablo olarak görünecek.');
                      }}
                    >
                      <Table2 className="h-4 w-4 mr-1.5" />
                      <span className="font-medium">Tablo Örneği Ekle</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-2 text-xs bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700"
                      onClick={() => {
                        const ganttExample = `\`\`\`mermaid
gantt
    title Proje Zaman Çizelgesi
    dateFormat  YYYY-MM-DD
    section Planlama
    Analiz ve Tasarım           :a1, 2024-01-01, 30d
    Dokümantasyon               :a2, after a1, 20d
    section Geliştirme
    Backend Geliştirme          :b1, 2024-02-01, 45d
    Frontend Geliştirme         :b2, after b1, 40d
    section Test
    Birim Testleri              :c1, after b2, 15d
    Entegrasyon Testleri        :c2, after c1, 20d
\`\`\``;
                        const currentContent = content[section.id] || '';
                        handleContentChange(section.id, currentContent + (currentContent ? '\n\n' : '') + ganttExample);
                        toast.info('Gantt chart örneği eklendi! Preview\'da görsel grafik olarak görünecek.');
                      }}
                    >
                      <Code className="h-4 w-4 mr-1.5" />
                      <span className="font-medium">Gantt Chart Ekle</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                    <span className="text-green-700 font-medium">💡 Tablolar ve grafikler preview'da renkli ve görsel olarak görüntülenir</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress Dialog */}
      <Dialog open={generationProgress.isOpen} onOpenChange={(open) => {
        if (!open && generationProgress.current >= generationProgress.total) {
          setGenerationProgress(prev => ({ ...prev, isOpen: false }));
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>İçerik Oluşturuluyor</DialogTitle>
            <DialogDescription>
              Tüm bölümler için içerik oluşturuluyor. Lütfen bekleyin...
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {generationProgress.current} / {generationProgress.total} bölüm tamamlandı
                </span>
                <span className="text-gray-500">
                  {generationProgress.total > 0 
                    ? Math.round((generationProgress.current / generationProgress.total) * 100) 
                    : 0}%
                </span>
              </div>
              <Progress 
                value={generationProgress.total > 0 
                  ? (generationProgress.current / generationProgress.total) * 100 
                  : 0} 
                className="h-2"
              />
            </div>

            {/* Current Section */}
            {generationProgress.currentSectionTitle && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {generationProgress.message}
                  </span>
                </div>
              </div>
            )}

            {/* Completed Sections */}
            {generationProgress.completedSections.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tamamlanan Bölümler ({generationProgress.completedSections.length}/{generationProgress.total}):
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowConsistencyPreview(true)}
                    className="text-xs"
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Bütünlük Kontrolü
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {generationProgress.completedSections.map((sectionId) => {
                    const section = sections.find(s => s.id === sectionId);
                    const hasContent = !!generationProgress.sectionContents[sectionId];
                    return section ? (
                      <div key={sectionId} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className={hasContent ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}>
                          {section.title}
                        </span>
                        {hasContent && (
                          <Badge variant="outline" className="text-xs">
                            {generationProgress.sectionContents[sectionId].length} karakter
                          </Badge>
                        )}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Error Sections */}
            {generationProgress.errorSections.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Hata Oluşan Bölümler:
                </p>
                <div className="space-y-1">
                  {generationProgress.errorSections.map((sectionId) => {
                    const section = sections.find(s => s.id === sectionId);
                    return section ? (
                      <div key={sectionId} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                        <XCircle className="h-4 w-4" />
                        <span>{section.title}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Status Message */}
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {generationProgress.message}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consistency Preview Dialog */}
      <Dialog open={showConsistencyPreview} onOpenChange={setShowConsistencyPreview}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Bütünlük Kontrolü - Tamamlanan Bölümler</DialogTitle>
            <DialogDescription>
              Tüm bölümlerin içeriklerini kontrol ederek bütünlüğü gözden geçirin
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue={generationProgress.completedSections[0] || ''} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-h-32 overflow-y-auto">
              {generationProgress.completedSections.map((sectionId) => {
                const section = sections.find(s => s.id === sectionId);
                return section ? (
                  <TabsTrigger key={sectionId} value={sectionId} className="text-xs">
                    {section.title}
                  </TabsTrigger>
                ) : null;
              })}
            </TabsList>
            
            {generationProgress.completedSections.map((sectionId) => {
              const section = sections.find(s => s.id === sectionId);
              const sectionContent = generationProgress.sectionContents[sectionId] || content[sectionId] || '';
              
              return section ? (
                <TabsContent key={sectionId} value={sectionId} className="mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{section.title}</h3>
                      <Badge variant="outline">
                        {sectionContent.length} karakter
                      </Badge>
                    </div>
                    {section.instructions && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {section.instructions}
                      </p>
                    )}
                    <div className="h-[400px] w-full rounded-md border p-4 overflow-y-auto">
                      <div className="whitespace-pre-wrap text-sm">
                        {sectionContent || (
                          <span className="text-gray-400 italic">İçerik henüz yüklenmedi...</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FileText className="h-3 w-3" />
                      <span>
                        {sectionContent.split(/\s+/).length} kelime
                        {section.maxLength && ` • Maksimum: ${section.maxLength} karakter`}
                      </span>
                    </div>
                  </div>
                </TabsContent>
              ) : null;
            })}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Validation Results Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {validationResults?.passed ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Kural Kontrolü Başarılı
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Kural İhlalleri Tespit Edildi
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {validationResults?.passed
                ? 'Proje içeriği tüm kurallara uygundur.'
                : `${validationResults?.violationsCount || 0} kural ihlali tespit edildi.`}
            </DialogDescription>
          </DialogHeader>

          {validationResults && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <span className="text-sm font-medium">Kontrol Edilen Kurallar:</span>
                <Badge variant="outline">{validationResults.rulesChecked}</Badge>
              </div>

              {validationResults.violations.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-semibold text-red-600">İhlaller:</h4>
                  {validationResults.violations.map((violation, index) => (
                    <Card key={index} className="border-red-200 dark:border-red-800">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-semibold text-red-700 dark:text-red-400">
                                {violation.title}
                              </h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {violation.description}
                              </p>
                            </div>
                            <Badge
                              variant={
                                violation.severity === 'critical'
                                  ? 'destructive'
                                  : violation.severity === 'high'
                                  ? 'destructive'
                                  : violation.severity === 'medium'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {violation.severity === 'critical'
                                ? 'Kritik'
                                : violation.severity === 'high'
                                ? 'Yüksek'
                                : violation.severity === 'medium'
                                ? 'Orta'
                                : 'Düşük'}
                            </Badge>
                          </div>
                          {violation.rule && (
                            <div className="flex gap-2 mt-2">
                              {violation.rule.category && (
                                <Badge variant="outline">Kategori: {violation.rule.category}</Badge>
                              )}
                              {violation.rule.priority && (
                                <Badge variant="outline">Öncelik: {violation.rule.priority}</Badge>
                              )}
                              {violation.rule.isRequired && (
                                <Badge variant="destructive">Zorunlu</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Tüm kurallar başarıyla geçti!</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={() => setShowValidationDialog(false)}>Kapat</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

