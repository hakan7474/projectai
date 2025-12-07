import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import { generateText } from '@/lib/gemini';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Project from '@/models/Project';
import Template from '@/models/Template';

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Proje ID gereklidir' }, { status: 400 });
    }

    await connectDB();
    await ensureModelsRegistered();

    const project = await Project.findById(projectId)
      .populate('templateId')
      .populate('sourceDocuments.documentId');

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Check access
    const isOwner = project.ownerId.toString() === session.user.id;
    const isEditor = project.collaborators?.some(
      (collab: any) => collab.userId.toString() === session.user.id && collab.role === 'editor'
    );

    if (!isOwner && !isEditor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const template = project.templateId as any;
    const sections = template.sections || [];
    const criteria = template.criteria || [];

    // Build context from source documents
    let context = '';
    if (project.sourceDocuments && project.sourceDocuments.length > 0) {
      const docTexts = project.sourceDocuments.map((doc: any) => {
        if (doc.documentId?.extractedText) {
          return doc.documentId.extractedText.substring(0, 5000);
        }
        if (doc.documentId?.markdownContent) {
          return doc.documentId.markdownContent.substring(0, 5000);
        }
        return '';
      });
      context = docTexts.join('\n\n');
    }

    // Build comprehensive prompt with ALL sections and criteria
    const institutionName = project.institution === 'tubitak' ? 'TÜBİTAK' : project.institution === 'kosgeb' ? 'KOSGEB' : 'Ufuk Avrupa';
    
    // Build sections information
    const sectionsInfo = sections.map((section: any, index: number) => {
      return `
${index + 1}. BÖLÜM: "${section.title}" (ID: ${section.id})
   - Amaç/Talimatlar: ${section.instructions || 'Belirtilmemiş'}
   - Zorunlu: ${section.required ? 'Evet' : 'Hayır'}
   ${section.maxLength ? `- Maksimum Uzunluk: ${section.maxLength} karakter` : ''}
   - Format: ${section.format || 'text'}`;
    }).join('\n');

    // Build criteria information
    const criteriaInfo = criteria.length > 0 ? criteria.map((criterion: any, index: number) => {
      return `
${index + 1}. KRİTER: "${criterion.title}"
   - Açıklama: ${criterion.description || 'Belirtilmemiş'}
   ${criterion.weight ? `- Ağırlık: ${criterion.weight}` : ''}`;
    }).join('\n') : 'Değerlendirme kriterleri belirtilmemiş.';

    const comprehensivePrompt = `Sen bir ARGE proje yazım uzmanısın. "${project.title}" adlı ${institutionName} projesi için TÜM bölümlerin içeriğini bir seferde, birbiriyle tutarlı ve mantıklı bir ilişki içinde oluşturacaksın.

ÖNEMLİ KURALLAR:
1. TÜM bölümler birbiriyle tutarlı olmalı - aynı proje hakkında yazıldığı belli olmalı
2. Her bölüm "${project.title}" projesine özel olmalı - jenerik içerik yazma
3. Bölümler arasında mantıklı bir akış ve ilişki olmalı
4. Değerlendirme kriterlerini dikkate alarak içerik hazırla
5. Profesyonel, akademik ve Türkçe dil kullan

PROJE BİLGİLERİ:
- Proje Başlığı: "${project.title}"
- Proje Açıklaması: "${project.description}"
- Hedef Kurum: ${institutionName}
${project.metadata?.budget ? `- Bütçe: ${project.metadata.budget} TL` : ''}
${project.metadata?.duration ? `- Süre: ${project.metadata.duration} ay` : ''}
${project.metadata?.keywords && project.metadata.keywords.length > 0 ? `- Anahtar Kelimeler: ${project.metadata.keywords.join(', ')}` : ''}

${context ? `KAYNAK DOKÜMANLAR (Bu dokümanlardaki bilgileri kullanarak projeye özel içerik hazırla):\n${context}\n` : ''}

TÜM BÖLÜMLER (Her biri için içerik oluşturmalısın):
${sectionsInfo}

DEĞERLENDİRME KRİTERLERİ (Bu kriterlere uygun içerik hazırla):
${criteriaInfo}

TALİMATLAR:
1. "${project.title}" projesine özel, birbiriyle tutarlı içerikler hazırla
2. Her bölümün amacına ve talimatlarına uygun içerik yaz
3. Bölümler arasında mantıklı bir akış sağla - önceki bölümlerde bahsedilen konular sonraki bölümlerde de tutarlı şekilde devam etmeli
4. ${context ? 'Kaynak dokümanlardaki bilgileri kullanarak projeye özel detaylar ekle.' : 'Proje başlığı ve açıklamasındaki bilgileri kullanarak detaylı bir içerik hazırla.'}
5. Değerlendirme kriterlerine uygun içerik hazırla - kriterlerde vurgulanan noktaları içeriklerde de vurgula
6. ${project.institution === 'tubitak' ? 'TÜBİTAK proje kriterlerine uygun, bilimsel ve teknik detaylar içeren' : project.institution === 'kosgeb' ? 'KOSGEB proje kriterlerine uygun, işletme ve pazar odaklı' : 'Ufuk Avrupa proje kriterlerine uygun, uluslararası standartlarda'} bir metin hazırla
7. Jenerik veya genel ifadeler kullanma - bu projeye özel, somut ve detaylı bilgiler ver
8. Her bölüm için maksimum uzunluk sınırlarına dikkat et

YANIT FORMATI:
SADECE geçerli bir JSON objesi döndür. Hiçbir açıklama, markdown, veya ekstra metin ekleme. Sadece JSON.

Format şu şekilde olmalı (örnek):

{
  "sections": {
    "section-1": "Bu bölümün içeriği buraya gelecek. İçerikte çift tırnak kullanıyorsan \\\" şeklinde escape et.",
    "section-2": "Bu bölümün içeriği buraya gelecek.",
    "section-3": "Bu bölümün içeriği buraya gelecek."
  }
}

KRİTİK KURALLAR:
1. SADECE JSON döndür - başka hiçbir şey ekleme (açıklama, markdown, ön/son metin YOK)
2. JSON'da çift tırnak içinde metin varsa mutlaka \\\" şeklinde escape et
3. JSON'da satır sonları için \\n kullan
4. Her section ID'si için mutlaka içerik oluştur (boş bırakma)
5. İçerikler birbiriyle tutarlı ve mantıklı bir ilişki içinde olmalı
6. Maksimum uzunluk sınırlarına dikkat et
7. Değerlendirme kriterlerine uygun içerik hazırla
8. JSON formatı geçerli olmalı - virgül, tırnak, süslü parantez hataları olmamalı

Şimdi "${project.title}" projesinin TÜM bölümlerinin içeriğini SADECE JSON formatında (başka hiçbir şey olmadan) döndür:`;

    console.log('AI Agent: Generating content for all sections with comprehensive prompt', {
      projectId,
      sectionsCount: sections.length,
      criteriaCount: criteria.length,
      hasContext: !!context,
    });

    // Generate content for each section sequentially with progress updates
    // This allows us to show progress and maintain consistency by passing previous sections as context
    let results: Record<string, string> = {};
    const generatedSections: Array<{ id: string; title: string; content: string }> = [];
    
    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendProgress = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };
        
        try {
          // Send initial progress
          sendProgress({
            type: 'start',
            total: sections.length,
            current: 0,
            message: 'İçerik oluşturma başlatılıyor...',
          });
          
          // Generate content for each section
          for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const sectionIndex = i + 1;
            
            // Send progress update
            sendProgress({
              type: 'progress',
              total: sections.length,
              current: sectionIndex,
              sectionId: section.id,
              sectionTitle: section.title,
              message: `"${section.title}" bölümü oluşturuluyor... (${sectionIndex}/${sections.length})`,
            });
            
            // Build comprehensive context for consistency
            // 1. All sections structure (so AI knows the full project structure)
            const allSectionsInfo = sections.map((s: any, idx: number) => {
              const isCurrent = s.id === section.id;
              const isCompleted = generatedSections.some(gs => gs.id === s.id);
              return `${idx + 1}. "${s.title}" (${isCurrent ? 'ŞU AN YAZILIYOR' : isCompleted ? 'TAMAMLANDI' : 'HENÜZ YAZILMADI'})${s.instructions ? ` - ${s.instructions}` : ''}`;
            }).join('\n');
            
            // 2. Previous sections content (for consistency)
            let previousSectionsContext = '';
            if (generatedSections.length > 0) {
              previousSectionsContext = '\n\nÖNCEKİ BÖLÜMLERİN İÇERİKLERİ (Bu bölümlerle TAM TUTARLI olmalı - aynı proje, aynı konu, aynı detaylar):\n';
              generatedSections.forEach((prevSection, idx) => {
                // Show more content for better consistency (up to 2000 chars per section)
                const contentPreview = prevSection.content.length > 2000 
                  ? prevSection.content.substring(0, 2000) + '\n[... içerik devam ediyor ...]'
                  : prevSection.content;
                previousSectionsContext += `\n--- BÖLÜM ${idx + 1}: "${prevSection.title}" ---\n${contentPreview}\n`;
              });
              previousSectionsContext += '\nÖNEMLİ: Yukarıdaki bölümlerde bahsedilen tüm konular, teknik detaylar, rakamlar, isimler ve bilgiler bu bölümde de TUTARLI şekilde kullanılmalı. Çelişki olmamalı.\n';
            }
            
            // 3. Upcoming sections info (so AI knows what comes next)
            const upcomingSections = sections.slice(i + 1).map((s: any, idx: number) => {
              return `${idx + 1}. "${s.title}"${s.instructions ? ` - ${s.instructions}` : ''}`;
            });
            const upcomingSectionsInfo = upcomingSections.length > 0 
              ? `\n\nSONRAKİ BÖLÜMLER (Bu bölümü yazarken sonraki bölümlerle de uyumlu olacak şekilde yaz):\n${upcomingSections.join('\n')}\n`
              : '';
            
            const sectionPrompt = `Sen bir ARGE proje yazım uzmanısın. "${project.title}" adlı ${institutionName} projesi için "${section.title}" bölümünün içeriğini yazacaksın.

KRİTİK BÜTÜNLÜK KURALLARI:
1. Bu bölüm "${project.title}" projesine özel olmalı - jenerik içerik yazma
2. ${previousSectionsContext ? 'Önceki bölümlerle TAM TUTARLI olmalı - aynı proje, aynı teknik detaylar, aynı rakamlar, aynı isimler kullanılmalı' : 'Bu ilk bölüm, sonraki bölümlerle tutarlı olacak şekilde yaz - proje detaylarını net belirt'}
3. Sonraki bölümlerle de uyumlu olmalı - bu bölümde verilen bilgiler sonraki bölümlerde de kullanılabilir olmalı
4. Tüm bölümler birbirini tamamlamalı - çelişki, tekrar veya tutarsızlık olmamalı
5. Değerlendirme kriterlerini dikkate al
6. Profesyonel, akademik ve Türkçe dil kullan

PROJE BİLGİLERİ:
- Proje Başlığı: "${project.title}"
- Proje Açıklaması: "${project.description}"
- Hedef Kurum: ${institutionName}
${project.metadata?.budget ? `- Bütçe: ${project.metadata.budget} TL` : ''}
${project.metadata?.duration ? `- Süre: ${project.metadata.duration} ay` : ''}
${project.metadata?.keywords && project.metadata.keywords.length > 0 ? `- Anahtar Kelimeler: ${project.metadata.keywords.join(', ')}` : ''}

${context ? `KAYNAK DOKÜMANLAR (Bu dokümanlardaki bilgileri kullanarak projeye özel içerik hazırla):\n${context}\n` : ''}

TÜM BÖLÜMLERİN YAPISI (Proje yapısını anlamak için):
${allSectionsInfo}

${previousSectionsContext}

${upcomingSectionsInfo}

ŞU AN YAZILACAK BÖLÜM:
- Bölüm Başlığı: "${section.title}"
${section.instructions ? `- Amaç/Talimatlar: ${section.instructions}` : ''}
${section.maxLength ? `- Maksimum Uzunluk: ${section.maxLength} karakter` : ''}
- Format: ${section.format || 'text'}

DEĞERLENDİRME KRİTERLERİ (Bu kriterlere uygun içerik hazırla):
${criteriaInfo}

DETAYLI TALİMATLAR:
1. "${project.title}" projesine özel, detaylı ve derinlemesine içerik hazırla
2. Bölüm başlığı "${section.title}" ve amacına uygun içerik yaz
3. ${previousSectionsContext ? 'ÖNCEKİ BÖLÜMLERLE TAM TUTARLI OL:\n   - Önceki bölümlerde bahsedilen teknik detayları, rakamları, isimleri, tarihleri aynen kullan\n   - Önceki bölümlerde belirtilen proje özelliklerini, hedeflerini, metodolojisini koru\n   - Çelişki, tutarsızlık veya tekrar olmamalı\n   - Önceki bölümlerdeki bilgileri bu bölümde de doğru şekilde referans ver' : 'Bu ilk bölüm, sonraki bölümlerle tutarlı olacak şekilde yaz - proje detaylarını, teknik özelliklerini, rakamlarını net belirt'}
4. ${upcomingSections.length > 0 ? 'SONRAKİ BÖLÜMLERLE UYUMLU OL:\n   - Bu bölümde verdiğin bilgiler sonraki bölümlerde de kullanılabilir olmalı\n   - Sonraki bölümlerin konularına hazırlık yap' : 'Bu son bölüm, önceki bölümlerle tutarlı şekilde tamamla'}
5. ${context ? 'Kaynak dokümanlardaki bilgileri kullan - dokümanlardaki teknik detayları, rakamları, isimleri doğru şekilde kullan' : 'Proje başlığı ve açıklamasındaki bilgileri kullan - bu bilgileri genişlet ve detaylandır'}
6. Değerlendirme kriterlerine uygun içerik hazırla - kriterlerde vurgulanan noktaları içerikte de vurgula
7. ${project.institution === 'tubitak' ? 'TÜBİTAK proje kriterlerine uygun, bilimsel ve teknik detaylar içeren' : project.institution === 'kosgeb' ? 'KOSGEB proje kriterlerine uygun, işletme ve pazar odaklı' : 'Ufuk Avrupa proje kriterlerine uygun, uluslararası standartlarda'} bir metin hazırla
8. Jenerik ifadeler kullanma - bu projeye özel, somut ve detaylı bilgiler ver
9. Tüm bölümler birbirini tamamlamalı - her bölüm projenin bir parçası olmalı
${section.maxLength ? `10. Maksimum ${section.maxLength} karakter sınırına dikkat et` : ''}

Şimdi "${project.title}" projesinin "${section.title}" bölümünü yaz:`;

            try {
              const sectionContent = await generateText(sectionPrompt, {
                temperature: 0.7,
                maxTokens: section.maxLength ? Math.min(4000, Math.floor(section.maxLength / 2)) : 4000,
              });
              
              results[section.id] = sectionContent;
              generatedSections.push({
                id: section.id,
                title: section.title,
                content: sectionContent,
              });
              
              // Send section completed update with content
              sendProgress({
                type: 'section-complete',
                total: sections.length,
                current: sectionIndex,
                sectionId: section.id,
                sectionTitle: section.title,
                sectionContent: sectionContent, // Include content for preview
                message: `"${section.title}" bölümü tamamlandı (${sectionIndex}/${sections.length})`,
              });
            } catch (sectionError) {
              console.error(`AI Agent: Error generating section ${section.id}:`, sectionError);
              results[section.id] = '';
              
              sendProgress({
                type: 'section-error',
                total: sections.length,
                current: sectionIndex,
                sectionId: section.id,
                sectionTitle: section.title,
                message: `"${section.title}" bölümü oluşturulurken hata oluştu`,
                error: sectionError instanceof Error ? sectionError.message : 'Bilinmeyen hata',
              });
            }
          }
          
          // Save all content to database
          const contentToSave: Record<string, any> = {};
          Object.keys(results).forEach((sectionId) => {
            contentToSave[sectionId] = {
              text: results[sectionId] || '',
              aiGenerated: true,
              lastModified: new Date(),
              version: 1,
            };
          });
          
          try {
            const contentMap = new Map(Object.entries(contentToSave));
            await Project.findByIdAndUpdate(projectId, {
              $set: { content: contentMap },
            });
            console.log('AI Agent: Content saved to database', {
              sectionsCount: Object.keys(results).length,
            });
          } catch (saveError) {
            console.error('AI Agent: Error saving content to database', saveError);
          }
          
          // Send final results
          sendProgress({
            type: 'complete',
            total: sections.length,
            current: sections.length,
            results: results,
            message: 'Tüm bölümler başarıyla oluşturuldu ve veritabanına kaydedildi',
          });
          
        } catch (error) {
          sendProgress({
            type: 'error',
            message: 'İçerik oluşturulurken hata oluştu',
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          });
        } finally {
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in agent workflow:', error);
    return NextResponse.json(
      { 
        error: 'Agent işlemi başarısız oldu',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }, 
      { status: 500 }
    );
  }
}
