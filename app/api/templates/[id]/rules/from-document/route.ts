import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Template from '@/models/Template';
import TemplateRule from '@/models/TemplateRule';
import Document from '@/models/Document';
import { generateText, analyzeDocumentWithVision } from '@/lib/gemini';
import { processDocument } from '@/lib/document-processor';
import { readFile, access } from 'fs/promises';
import path from 'path';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'Doküman ID gereklidir' }, { status: 400 });
    }

    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    const document = await Document.findById(documentId).lean();
    if (!document) {
      return NextResponse.json({ error: 'Doküman bulunamadı' }, { status: 404 });
    }

    if (document.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), 'public', document.storagePath);
    await access(filePath);
    const fileBuffer = await readFile(filePath);

    const institutionName = template.institution === 'tubitak' ? 'TÜBİTAK' : template.institution === 'kosgeb' ? 'KOSGEB' : 'Ufuk Avrupa';

    const aiPrompt = `Sen bir ARGE proje şartname ve kriter analiz uzmanısın. Aşağıdaki ${institutionName} proje dokümanını analiz ederek, şartname tablolarından, değerlendirme kriterlerinden ve önemli kurallardan YAPILANDIRILMIŞ KURALLAR çıkaracaksın.

DOKÜMAN:
Yüklenen dokümanı görüyorsun. Lütfen dokümanın tamamını oku ve analiz et.

GÖREVİN:
1. Dokümandaki şartname tablolarını bul ve analiz et
2. Değerlendirme kriterlerini çıkar
3. Teknik gereksinimleri, zorunlu şartları, önemli kuralları tespit et
4. Her kural için şu bilgileri çıkar:
   - Başlık (title): Kuralın kısa ve açıklayıcı başlığı
   - Açıklama (description): Kuralın detaylı açıklaması
   - Kategori (category): "şartname", "değerlendirme", "teknik", "mali", "yasal" gibi
   - Öncelik (priority): 1-10 arası (10 en yüksek öncelik)
   - Zorunlu mu (isRequired): true/false

YANIT FORMATI:
SADECE geçerli bir JSON objesi döndür. Format şu şekilde olmalı:

{
  "rules": [
    {
      "title": "Kural başlığı",
      "description": "Kuralın detaylı açıklaması. Dokümandaki ilgili bölümü özetle.",
      "category": "şartname",
      "priority": 8,
      "isRequired": true
    }
  ]
}

ÖNEMLİ KURALLAR:
- SADECE JSON döndür, başka açıklama ekleme
- Tüm önemli kuralları çıkar, hiçbirini atlama
- Şartname tablolarındaki tüm satırları analiz et
- Değerlendirme kriterlerini detaylıca çıkar
- Kategorileri doğru belirle
- Öncelikleri mantıklı şekilde atama (zorunlu ve kritik kurallar yüksek öncelik)
- Minimum 5-10 kural çıkar (doküman içeriğine göre daha fazla olabilir)

Şimdi dokümanı analiz edip kuralları JSON formatında döndür:`;

    let aiResponse: string;
    
    if (document.mimeType === 'application/pdf') {
      aiResponse = await analyzeDocumentWithVision(fileBuffer, document.mimeType, aiPrompt, {
        temperature: 0.3,
        maxTokens: 8000,
      });
    } else if (document.mimeType.includes('word') || document.mimeType.includes('msword')) {
      const processed = await processDocument(filePath, document.mimeType);
      const extractedText = processed.text || '';
      
      if (!extractedText || extractedText.length === 0) {
        throw new Error('Word dokümanından metin çıkarılamadı');
      }
      
      const textToAnalyze = extractedText.length > 100000 
        ? extractedText.substring(0, 100000) + '\n\n[... doküman devam ediyor ...]'
        : extractedText;
      
      const fullPrompt = `${aiPrompt}\n\nDOKÜMAN İÇERİĞİ:\n${textToAnalyze}`;
      aiResponse = await generateText(fullPrompt, {
        temperature: 0.3,
        maxTokens: 8000,
      });
    } else {
      const processed = await processDocument(filePath, document.mimeType);
      const extractedText = processed.text || '';
      const fullPrompt = `${aiPrompt}\n\nDOKÜMAN İÇERİĞİ:\n${extractedText}`;
      aiResponse = await generateText(fullPrompt, {
        temperature: 0.3,
        maxTokens: 8000,
      });
    }

    let cleanedResponse = aiResponse.trim();
    cleanedResponse = cleanedResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    cleanedResponse = cleanedResponse.replace(/^```\s*/i, '').replace(/\s*```$/i, '');

    let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const firstBrace = cleanedResponse.indexOf('{');
      if (firstBrace !== -1) {
        cleanedResponse = cleanedResponse.substring(firstBrace);
        jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      }
    }

    if (!jsonMatch) {
      throw new Error('JSON formatı bulunamadı');
    }

    let jsonString = jsonMatch[0];
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

    const parsedData = JSON.parse(jsonString);
    const rules = parsedData.rules || [];

    if (!Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json({ error: 'Dokümandan kural çıkarılamadı' }, { status: 400 });
    }

    const createdRules = await Promise.all(
      rules.map((rule: any) =>
        TemplateRule.create({
          templateId: id,
          title: rule.title || 'Başlıksız Kural',
          description: rule.description || '',
          category: rule.category,
          priority: rule.priority,
          isRequired: rule.isRequired ?? false,
          sourceType: 'document',
          sourceDocument: documentId,
          createdBy: session.user.id,
        })
      )
    );

    const populatedRules = await TemplateRule.find({ _id: { $in: createdRules.map(r => r._id) } })
      .populate('createdBy', 'name email')
      .populate('sourceDocument', 'originalName')
      .lean();

    return NextResponse.json({
      success: true,
      rules: populatedRules,
      count: populatedRules.length,
    });
  } catch (error) {
    console.error('Error extracting rules from document:', error);
    return NextResponse.json(
      {
        error: 'Kurallar çıkarılamadı',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
