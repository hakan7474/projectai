import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import { generateText } from '@/lib/gemini';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import Template from '@/models/Template';
import mongoose from 'mongoose';

export async function POST(request: Request) {
  try {
    console.log('AI Generate: Starting request');
    
    const session = await getAuthSession();

    if (!session) {
      console.error('AI Generate: Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, sectionId, prompt } = body;

    console.log('AI Generate: Request body', { projectId, sectionId, prompt: prompt?.substring(0, 50) });

    if (!projectId || !sectionId || !prompt) {
      console.error('AI Generate: Missing parameters', { projectId, sectionId, prompt: !!prompt });
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
    }

    await connectDB();
    console.log('AI Generate: Database connected');

    // Ensure Template model is registered before populate
    const _templateCheck = Template;
    if (!mongoose.models.Template) {
      const TemplateModule = await import('@/models/Template');
      if (TemplateModule.TemplateSchema) {
        mongoose.model('Template', TemplateModule.TemplateSchema);
      }
    }

    const project = await Project.findById(projectId)
      .populate('templateId')
      .populate('sourceDocuments.documentId');

    if (!project) {
      console.error('AI Generate: Project not found', { projectId });
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    console.log('AI Generate: Project found', { 
      title: project.title, 
      hasTemplate: !!project.templateId,
      hasSourceDocs: !!project.sourceDocuments?.length 
    });

    // Check access
    const isOwner = project.ownerId.toString() === session.user.id;
    const isEditor = project.collaborators?.some(
      (collab: any) => collab.userId.toString() === session.user.id && collab.role === 'editor'
    );

    if (!isOwner && !isEditor) {
      console.error('AI Generate: Unauthorized access', { 
        userId: session.user.id, 
        ownerId: project.ownerId.toString(),
        isOwner,
        isEditor 
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const template = project.templateId as any;
    
    if (!template) {
      console.error('AI Generate: Template not found');
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    const section = template.sections?.find((s: any) => s.id === sectionId);

    if (!section) {
      console.error('AI Generate: Section not found', { 
        sectionId, 
        availableSections: template.sections?.map((s: any) => s.id) 
      });
      return NextResponse.json({ error: 'Bölüm bulunamadı' }, { status: 404 });
    }

    console.log('AI Generate: Section found', { sectionTitle: section.title });

    // Build context from source documents
    let context = '';
    if (project.sourceDocuments && project.sourceDocuments.length > 0) {
      const docTexts = project.sourceDocuments.map((doc: any) => {
        if (doc.documentId?.extractedText) {
          return doc.documentId.extractedText.substring(0, 2000); // Limit context
        }
        return '';
      });
      context = docTexts.join('\n\n');
      console.log('AI Generate: Context built', { contextLength: context.length });
    }

    // Build AI prompt - Much more detailed and project-specific
    const aiPrompt = `Sen bir ARGE proje yazım uzmanısın. Aşağıdaki PROJE BİLGİLERİNİ kullanarak "${section.title}" bölümünü yazacaksın.

ÖNEMLİ: Bu bölüm "${project.title}" adlı projeye özel olmalı. Jenerik veya genel bir metin yazma. Proje başlığı ve açıklamasındaki bilgileri kullanarak bu projeye özel, detaylı ve derinlemesine bir içerik hazırla.

PROJE BİLGİLERİ:
Proje Başlığı: "${project.title}"
Proje Açıklaması: "${project.description}"
Hedef Kurum: ${project.institution}

${context ? `KAYNAK DOKÜMANLAR (Bu dokümanlardaki bilgileri kullanarak projeye özel içerik hazırla):\n${context}\n` : ''}

BÖLÜM BİLGİLERİ:
Bölüm Başlığı: "${section.title}"
${section.instructions ? `Bölüm Amacı ve Talimatları: ${section.instructions}\n` : ''}
${section.maxLength ? `Maksimum Uzunluk: ${section.maxLength} karakter\n` : ''}

TALİMATLAR:
1. "${project.title}" projesine özel bir içerik hazırla. Proje başlığı ve açıklamasındaki konuya derinlemesine odaklan.
2. Bölüm başlığı "${section.title}" ve amacına uygun olarak içerik hazırla.
3. ${context ? 'Kaynak dokümanlardaki bilgileri kullanarak projeye özel detaylar ekle.' : 'Proje başlığı ve açıklamasındaki bilgileri kullanarak detaylı bir içerik hazırla.'}
4. Profesyonel, akademik ve Türkçe bir dil kullan.
5. ${project.institution === 'tubitak' ? 'TÜBİTAK proje kriterlerine uygun, bilimsel ve teknik detaylar içeren' : project.institution === 'kosgeb' ? 'KOSGEB proje kriterlerine uygun, işletme ve pazar odaklı' : 'Ufuk Avrupa proje kriterlerine uygun, uluslararası standartlarda'} bir metin hazırla.
6. Jenerik veya genel ifadeler kullanma. Bu projeye özel, somut ve detaylı bilgiler ver.
7. Metin "${project.title}" projesinin "${section.title}" bölümü için hazırlanmış olmalı ve proje konusuyla doğrudan ilgili olmalı.

Şimdi "${project.title}" projesinin "${section.title}" bölümünü yaz:`;

    console.log('AI Generate: Calling Gemini API', { promptLength: aiPrompt.length });

    const generatedText = await generateText(aiPrompt, {
      temperature: 0.7,
    });

    console.log('AI Generate: Text generated successfully', { textLength: generatedText.length });

    return NextResponse.json({
      text: generatedText,
      sectionId,
    });
  } catch (error) {
    console.error('AI Generate: Error occurred', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Metin üretilemedi',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }, 
      { status: 500 }
    );
  }
}
