import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Template from '@/models/Template';
import TemplateRule from '@/models/TemplateRule';
import { crawlWebsite } from '@/lib/web-crawler';
import { generateText } from '@/lib/gemini';
import { z } from 'zod';

const crawlSchema = z.object({
  url: z.string().url('Geçerli bir URL giriniz'),
});

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
    const validatedData = crawlSchema.parse(body);

    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    // Crawl website
    console.log('Rules from Website: Crawling', validatedData.url);
    const crawlResult = await crawlWebsite(validatedData.url, {
      timeout: 30000,
    });

    const institutionName = template.institution === 'tubitak' ? 'TÜBİTAK' : template.institution === 'kosgeb' ? 'KOSGEB' : 'Ufuk Avrupa';

    const aiPrompt = `Sen bir ARGE proje şartname ve kriter analiz uzmanısın. Aşağıdaki web sitesi içeriğini analiz ederek, şartname tablolarından, değerlendirme kriterlerinden ve önemli kurallardan YAPILANDIRILMIŞ KURALLAR çıkaracaksın.

WEB SİTESİ BİLGİLERİ:
- URL: ${validatedData.url}
- Başlık: ${crawlResult.title}

WEB SİTESİ İÇERİĞİ:
${crawlResult.content}

GÖREVİN:
1. Web sitesindeki şartname tablolarını bul ve analiz et
2. Değerlendirme kriterlerini çıkar
3. Teknik gereksinimleri, zorunlu şartları, önemli kuralları tespit et
4. Tablo formatındaki verileri özellikle dikkate al
5. Her kural için şu bilgileri çıkar:
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
      "description": "Kuralın detaylı açıklaması. Web sitesindeki ilgili bölümü özetle.",
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
- Minimum 5-10 kural çıkar (içeriğe göre daha fazla olabilir)
- Tablo formatındaki verileri özellikle dikkate al

Şimdi web sitesi içeriğini analiz edip kuralları JSON formatında döndür:`;

    console.log('Rules from Website: Analyzing content with AI');
    const aiResponse = await generateText(aiPrompt, {
      temperature: 0.3,
      maxTokens: 8000,
    });

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
      return NextResponse.json({ error: 'Web sitesinden kural çıkarılamadı' }, { status: 400 });
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
          sourceType: 'website',
          sourceUrl: validatedData.url,
          createdBy: session.user.id,
        })
      )
    );

    const populatedRules = await TemplateRule.find({ _id: { $in: createdRules.map(r => r._id) } })
      .populate('createdBy', 'name email')
      .lean();

    return NextResponse.json({
      success: true,
      rules: populatedRules,
      count: populatedRules.length,
    });
  } catch (error) {
    console.error('Error extracting rules from website:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Kurallar çıkarılamadı',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
