import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Document from '@/models/Document';
import { generateText, analyzeDocumentWithVision } from '@/lib/gemini';
import { processDocument } from '@/lib/document-processor';
import { readFile, access } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    console.log('Template Analyze Document: Starting');
    
    const session = await getAuthSession();

    if (!session) {
      console.error('Template Analyze Document: Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can analyze documents for templates
    if (session.user.role !== 'admin') {
      console.error('Template Analyze Document: Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { documentId, institution } = body;

    if (!documentId || !institution) {
      return NextResponse.json(
        { error: 'Doküman ID ve kurum bilgisi gereklidir' },
        { status: 400 }
      );
    }

    await connectDB();
    await ensureModelsRegistered();
    console.log('Template Analyze Document: Database connected');

    // Fetch document
    const document = await Document.findById(documentId).lean();

    if (!document) {
      return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 });
    }

    // Check access
    if (document.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('Template Analyze Document: Analyzing document with Gemini Vision API', {
      documentId,
      institution,
      mimeType: document.mimeType,
      storagePath: document.storagePath,
    });

    // Read the file directly and send to Gemini Vision API (bypasses PDF parsing)
    const filePath = path.join(process.cwd(), 'public', document.storagePath);
    
    // Check if file exists
    try {
      await access(filePath);
      console.log('Template Analyze Document: File exists at', filePath);
    } catch (accessError) {
      console.error('Template Analyze Document: File does not exist at path', filePath);
      return NextResponse.json(
        { error: `Dosya bulunamadı: ${filePath}` },
        { status: 404 }
      );
    }

    // Read file buffer
    const fileBuffer = await readFile(filePath);
    console.log('Template Analyze Document: File read successfully', {
      bufferSize: fileBuffer.length,
      mimeType: document.mimeType,
    });

    // Build comprehensive AI prompt for template analysis
    const institutionName = institution === 'tubitak' ? 'TÜBİTAK' : institution === 'kosgeb' ? 'KOSGEB' : 'Ufuk Avrupa';
    
    const aiPrompt = `Sen bir ARGE proje şablonu analiz uzmanısın. Aşağıdaki ${institutionName} proje başvuru dokümanını (PDF veya Word) detaylıca analiz ederek, profesyonel bir şablon yapısı çıkaracaksın.

DOKÜMAN:
Yüklenen dokümanı görüyorsun. Lütfen dokümanın tamamını oku ve analiz et.

GÖREVİN:
1. Dokümanı dikkatlice oku ve ${institutionName} proje başvuru formunun yapısını anla
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

    console.log('Template Analyze Document: Calling AI for document analysis');
    let aiResponse: string;
    
    try {
      // Use Vision API for PDF files (bypasses text extraction)
      if (document.mimeType === 'application/pdf') {
        console.log('Template Analyze Document: Using Vision API for PDF analysis', {
          mimeType: document.mimeType,
          bufferSize: fileBuffer.length,
        });
        aiResponse = await analyzeDocumentWithVision(fileBuffer, document.mimeType, aiPrompt, {
          temperature: 0.3,
          maxTokens: 8000,
        });
      } else if (document.mimeType.includes('word') || document.mimeType.includes('msword')) {
        // For Word documents, extract text first then use text generation
        console.log('Template Analyze Document: Extracting text from Word document');
        const processed = await processDocument(filePath, document.mimeType);
        const extractedText = processed.text || '';
        
        if (!extractedText || extractedText.length === 0) {
          throw new Error('Word dokümanından metin çıkarılamadı');
        }
        
        const textToAnalyze = extractedText.length > 100000 
          ? extractedText.substring(0, 100000) + '\n\n[... doküman devam ediyor ...]'
          : extractedText;
        
        console.log('Template Analyze Document: Using text generation for Word document', {
          textLength: textToAnalyze.length,
        });
        
        const fullPrompt = `${aiPrompt}\n\nDOKÜMAN İÇERİĞİ:\n${textToAnalyze}`;
        aiResponse = await generateText(fullPrompt, {
          temperature: 0.3,
          maxTokens: 8000,
        });
      } else {
        // For text files, use regular text generation
        console.log('Template Analyze Document: Using text generation for text files');
        const extractedText = document.extractedText || '';
        const textToAnalyze = extractedText.length > 100000 
          ? extractedText.substring(0, 100000) + '\n\n[... doküman devam ediyor ...]'
          : extractedText;
        
        if (!textToAnalyze || textToAnalyze.length === 0) {
          throw new Error('Metin dosyası için içerik bulunamadı');
        }
        
        const fullPrompt = `${aiPrompt}\n\nDOKÜMAN İÇERİĞİ:\n${textToAnalyze}`;
        aiResponse = await generateText(fullPrompt, {
          temperature: 0.3,
          maxTokens: 8000,
        });
      }
    } catch (aiError) {
      console.error('Template Analyze Document: AI analysis error', {
        error: aiError instanceof Error ? aiError.message : 'Unknown error',
        stack: aiError instanceof Error ? aiError.stack : undefined,
        mimeType: document.mimeType,
      });
      return NextResponse.json(
        {
          error: 'Doküman analiz edilemedi',
          details: aiError instanceof Error ? aiError.message : 'Bilinmeyen hata',
        },
        { status: 500 }
      );
    }

    console.log('Template Analyze Document: AI response received', {
      responseLength: aiResponse.length,
      responsePreview: aiResponse.substring(0, 200),
    });

    // Parse AI response (it should be JSON)
    let templateData;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedResponse = aiResponse.trim();
      
      // Remove markdown code blocks (```json ... ```)
      cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      cleanedResponse = cleanedResponse.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      // Try to extract JSON object from response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        templateData = JSON.parse(jsonMatch[0]);
      } else {
        templateData = JSON.parse(cleanedResponse);
      }
      
      console.log('Template Analyze Document: JSON parsed successfully', {
        hasName: !!templateData.name,
        sectionsCount: templateData.sections?.length || 0,
        criteriaCount: templateData.criteria?.length || 0,
      });
    } catch (parseError) {
      console.error('Template Analyze Document: Failed to parse AI response', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        responsePreview: aiResponse.substring(0, 1000),
      });
      return NextResponse.json(
        {
          error: 'AI yanıtı parse edilemedi. Lütfen dokümanın geçerli bir şablon içerdiğinden emin olun.',
          details: parseError instanceof Error ? parseError.message : 'Bilinmeyen hata',
          responsePreview: aiResponse.substring(0, 500),
        },
        { status: 500 }
      );
    }

    // Validate template data structure
    if (!templateData.sections || !Array.isArray(templateData.sections)) {
      return NextResponse.json(
        { error: 'AI yanıtında geçersiz şablon yapısı' },
        { status: 500 }
      );
    }

    // Ensure all sections have required fields
    templateData.sections = templateData.sections.map((section: any, index: number) => ({
      id: section.id || `section-${index + 1}`,
      title: section.title || 'Başlıksız Bölüm',
      required: section.required ?? false,
      maxLength: section.maxLength,
      format: section.format || 'text',
      instructions: section.instructions || '',
    }));

    // Ensure criteria have required fields
    if (templateData.criteria && Array.isArray(templateData.criteria)) {
      templateData.criteria = templateData.criteria.map((criterion: any) => ({
        title: criterion.title || 'Başlıksız Kriter',
        description: criterion.description || '',
        weight: criterion.weight,
      }));
    } else {
      templateData.criteria = [];
    }

    console.log('Template Analyze Document: Success', {
      sectionsCount: templateData.sections.length,
      criteriaCount: templateData.criteria.length,
    });

    return NextResponse.json({
      success: true,
      template: {
        name: templateData.name || 'Yeni Şablon',
        description: templateData.description || '',
        sections: templateData.sections,
        criteria: templateData.criteria,
      },
    });
  } catch (error) {
    console.error('Template Analyze Document: Unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
    });
    return NextResponse.json(
      {
        error: 'Doküman analiz edilemedi',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}

