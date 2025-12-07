import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Document from '@/models/Document';
import Template from '@/models/Template';
import { generateText } from '@/lib/gemini';
import { readFile, access } from 'fs/promises';
import path from 'path';
import { pdfFileToMarkdown } from '@/lib/pdf-to-markdown';

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, institution, createTemplate } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Doküman ID gereklidir' },
        { status: 400 }
      );
    }

    // If createTemplate is true, institution is required
    if (createTemplate && !institution) {
      return NextResponse.json(
        { error: 'Şablon oluşturmak için kurum bilgisi gereklidir' },
        { status: 400 }
      );
    }

    // Check if user is admin for template creation
    if (createTemplate && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Şablon oluşturmak için admin yetkisi gereklidir' },
        { status: 403 }
      );
    }

    await connectDB();
    await ensureModelsRegistered();

    // Fetch document
    const document = await Document.findById(documentId).lean();

    if (!document) {
      return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 });
    }

    // Check access
    if (document.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only support PDF files for now
    if (document.mimeType !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Sadece PDF dosyaları Markdown formatına dönüştürülebilir' },
        { status: 400 }
      );
    }

    // Read the file
    const filePath = path.join(process.cwd(), 'public', document.storagePath);
    
    try {
      await access(filePath);
    } catch (accessError) {
      return NextResponse.json(
        { error: `Dosya bulunamadı: ${filePath}` },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);

    console.log('Convert to Markdown: Converting PDF to Markdown', {
      documentId,
      bufferSize: fileBuffer.length,
      mimeType: document.mimeType,
    });

    // Use pdfjs-dist to convert PDF directly to Markdown (no AI needed)
    console.log('Convert to Markdown: Using pdfjs-dist to convert PDF to Markdown');
    console.log('Convert to Markdown: File info', {
      bufferSize: fileBuffer.length,
      mimeType: document.mimeType,
      filePath: document.storagePath,
    });
    
    let markdownContent: string;
    
    try {
      // Convert PDF to Markdown using pdfjs-dist
      markdownContent = await pdfFileToMarkdown(filePath, {
        preserveFormatting: true,
        includePageNumbers: false,
      });
      
      console.log('Convert to Markdown: pdfjs-dist conversion succeeded', {
        markdownLength: markdownContent?.length || 0,
      });
    } catch (conversionError) {
      console.error('Convert to Markdown: Conversion failed - FULL ERROR DETAILS', {
        error: conversionError instanceof Error ? conversionError.message : 'Unknown error',
        errorType: conversionError?.constructor?.name,
        errorName: conversionError instanceof Error ? conversionError.name : undefined,
        stack: conversionError instanceof Error ? conversionError.stack : undefined,
        filePath: document.storagePath,
        bufferSize: fileBuffer.length,
      });
      
      // Return detailed error for debugging
      const errorMessage = conversionError instanceof Error ? conversionError.message : 'Bilinmeyen hata';
      const errorStack = conversionError instanceof Error ? conversionError.stack : undefined;
      
      console.error('Convert to Markdown: Error stack trace:', errorStack);
      
      throw new Error(
        `PDF Markdown formatına dönüştürülemedi. ` +
        `Hata: ${errorMessage}. ` +
        `Lütfen terminal loglarını kontrol edin veya PDF dosyasının geçerli olduğundan emin olun.`
      );
    }

    // Update document with markdown content
    await Document.findByIdAndUpdate(documentId, {
      markdownContent: markdownContent,
    });

    console.log('Convert to Markdown: Success', {
      markdownLength: markdownContent.length,
    });

    // If createTemplate is requested, analyze markdown and create template
    let createdTemplate = null;
    if (createTemplate && institution) {
      try {
        console.log('Convert to Markdown: Creating template from markdown', {
          documentId,
          institution,
          markdownLength: markdownContent.length,
        });

        // Build AI prompt for template analysis from markdown
        const institutionName = institution === 'tubitak' ? 'TÜBİTAK' : institution === 'kosgeb' ? 'KOSGEB' : 'Ufuk Avrupa';
        
        const aiPrompt = `Sen bir ARGE proje şablonu analiz uzmanısın. Aşağıdaki ${institutionName} proje başvuru dokümanının Markdown formatındaki içeriğini detaylıca analiz ederek, profesyonel bir şablon yapısı çıkaracaksın.

MARKDOWN İÇERİK:
\`\`\`
${markdownContent.length > 50000 ? markdownContent.substring(0, 50000) + '\n\n[... doküman devam ediyor ...]' : markdownContent}
\`\`\`

GÖREVİN:
1. Markdown içeriğini dikkatlice oku ve ${institutionName} proje başvuru formunun yapısını anla
2. Dokümandan proje şablonunun TÜM bölümlerini (sections) çıkar:
   - Her bölüm için başlık (title) - dokümandaki gerçek başlığı kullan
   - Bölüm açıklaması/amaçı (instructions) - dokümandaki açıklamaları ve talimatları özetle
   - Zorunlu mu? (required) - dokümandaki zorunlu/opsiyonel ifadelerine göre belirle
   - Maksimum karakter/kelime sayısı varsa (maxLength) - dokümandaki limitleri çıkar
   - Format tipi (format) - içeriğe göre belirle:
     * "text": Normal metin bölümleri
     * "rich-text": Formatlanmış metin gerektiren bölümler
     * "table": Tablo formatında veri gerektiren bölümler
     * "budget": Bütçe/bedel tabloları

3. Değerlendirme kriterlerini (criteria) çıkar:
   - Her kriter için başlık (title)
   - Kriter açıklaması (description) - dokümandaki değerlendirme kriterlerini detaylıca açıkla
   - Ağırlık varsa (weight) - dokümandaki puanlama sistemine göre belirle

4. Şablon için uygun bir isim (name) ve açıklama (description) öner:
   - İsim: ${institutionName} proje türünü ve amacını yansıtmalı
   - Açıklama: Şablonun kapsamını ve kullanım amacını açıkla

YANIT FORMATI:
Sadece geçerli bir JSON objesi döndür. Format şu şekilde olmalı:

{
  "name": "Şablon Adı",
  "description": "Şablon açıklaması (2-3 cümle)",
  "sections": [
    {
      "id": "section-1",
      "title": "Bölüm Başlığı (dokümandaki gerçek başlık)",
      "required": true,
      "maxLength": 5000,
      "format": "text",
      "instructions": "Bu bölümde ne yazılmalı, hangi bilgiler isteniyor (dokümandan çıkar)"
    }
  ],
  "criteria": [
    {
      "title": "Kriter Başlığı",
      "description": "Kriter açıklaması (dokümandaki değerlendirme kriterlerini detaylıca açıkla)",
      "weight": 10
    }
  ]
}

ÖNEMLİ KURALLAR:
- Sadece JSON döndür, başka açıklama veya markdown formatı ekleme
- Bölüm ID'lerini "section-1", "section-2", "section-3" formatında sıralı oluştur
- Format değerleri sadece şunlar olabilir: "text", "rich-text", "table", "budget"
- Maksimum karakter sayısı dokümanda belirtilmemişse maxLength alanını ekleme
- Weight dokümanda belirtilmemişse weight alanını ekleme
- Dokümandaki TÜM önemli bölümleri çıkar, hiçbirini atlama
- Bölüm başlıklarını dokümandaki gerçek başlıkları kullanarak oluştur
- Instructions alanını dokümandaki açıklamalardan ve talimatlardan doldur

Şimdi analiz sonucunu JSON formatında döndür:`;

        // Send markdown to AI for analysis
        console.log('Convert to Markdown: Sending markdown to AI for template analysis');
        const aiResponse = await generateText(aiPrompt, {
          temperature: 0.3,
          maxTokens: 8000,
        });

        console.log('Convert to Markdown: AI response received', {
          responseLength: aiResponse.length,
          responsePreview: aiResponse.substring(0, 200),
        });

        // Parse AI response
        let templateData;
        try {
          let cleanedResponse = aiResponse.trim();
          cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
          cleanedResponse = cleanedResponse.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
          
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            templateData = JSON.parse(jsonMatch[0]);
          } else {
            templateData = JSON.parse(cleanedResponse);
          }
        } catch (parseError) {
          console.error('Convert to Markdown: Failed to parse AI response for template', {
            error: parseError instanceof Error ? parseError.message : 'Unknown error',
            responsePreview: aiResponse.substring(0, 500),
          });
          // Don't fail the whole request, just skip template creation
          console.warn('Convert to Markdown: Template creation skipped due to parse error');
        }

        // Create template if parsing succeeded
        if (templateData && templateData.sections && Array.isArray(templateData.sections)) {
          // Ensure all sections have required fields
          const sections = templateData.sections.map((section: any, index: number) => ({
            id: section.id || `section-${index + 1}`,
            title: section.title || 'Başlıksız Bölüm',
            required: section.required ?? false,
            maxLength: section.maxLength,
            format: section.format || 'text',
            instructions: section.instructions || '',
          }));

          // Ensure criteria have required fields
          const criteria = (templateData.criteria && Array.isArray(templateData.criteria))
            ? templateData.criteria.map((criterion: any) => ({
                title: criterion.title || 'Başlıksız Kriter',
                description: criterion.description || '',
                weight: criterion.weight,
              }))
            : [];

          // Create template in database
          const template = await Template.create({
            institution: institution,
            name: templateData.name || 'Yeni Şablon',
            description: templateData.description || '',
            sections: sections,
            criteria: criteria,
            sourceDocument: documentId,
            createdBy: session.user.id,
            isActive: true,
          });

          // Populate the created template
          createdTemplate = await Template.findById(template._id)
            .populate('createdBy', 'name email')
            .populate('sourceDocument', 'originalName storagePath mimeType')
            .lean();

          console.log('Convert to Markdown: Template created successfully', {
            templateId: template._id,
            sectionsCount: sections.length,
            criteriaCount: criteria.length,
          });
        }
      } catch (templateError) {
        console.error('Convert to Markdown: Error creating template', {
          error: templateError instanceof Error ? templateError.message : 'Unknown error',
          stack: templateError instanceof Error ? templateError.stack : undefined,
        });
        // Don't fail the whole request, just log the error
        // Markdown conversion was successful, template creation is optional
      }
    }

    return NextResponse.json({
      success: true,
      markdown: markdownContent,
      documentId: documentId,
      template: createdTemplate,
    });
  } catch (error) {
    console.error('Convert to Markdown: Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      errorName: error instanceof Error ? error.name : undefined,
    });
    
    // Provide more helpful error messages
    let errorMessage = 'PDF Markdown formatına dönüştürülemedi';
    let errorDetails = error instanceof Error ? error.message : 'Bilinmeyen hata';
    
    if (errorDetails.includes('file size') || errorDetails.includes('too large')) {
      errorMessage = 'PDF dosyası çok büyük. Maksimum 20MB olmalı.';
    } else if (errorDetails.includes('API') || errorDetails.includes('quota') || errorDetails.includes('limit')) {
      errorMessage = 'Gemini API hatası. Lütfen daha sonra tekrar deneyin.';
    } else if (errorDetails.includes('text') || errorDetails.includes('extract')) {
      errorMessage = 'PDF\'den metin çıkarılamadı. PDF korumalı veya görüntü tabanlı olabilir.';
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

