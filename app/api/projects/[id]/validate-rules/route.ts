import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Project from '@/models/Project';
import Template from '@/models/Template';
import TemplateRule from '@/models/TemplateRule';
import ProjectRuleValidation from '@/models/ProjectRuleValidation';
import { generateText } from '@/lib/gemini';
import mongoose from 'mongoose';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  try {
    console.log('Validate Rules API: Starting validation');
    
    const session = await getAuthSession();

    if (!session) {
      console.error('Validate Rules API: Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized', message: 'Oturum bulunamadı' }, { status: 401 });
    }

    const paramsData = await params;
    id = paramsData.id;
    console.log('Validate Rules API: Project ID:', id);
    
    await connectDB();
    await ensureModelsRegistered();
    console.log('Validate Rules API: Database connected');
    
    // Ensure ProjectRuleValidation model is registered
    if (!mongoose.models.ProjectRuleValidation) {
      console.warn('Validate Rules API: ProjectRuleValidation model not found, importing...');
      await import('@/models/ProjectRuleValidation');
    }

    console.log('Validate Rules API: Fetching project...');
    const project = await Project.findById(id)
      .populate('templateId')
      .populate('sourceDocuments.documentId')
      .lean();

    if (!project) {
      console.error('Validate Rules API: Project not found:', id);
      return NextResponse.json({ error: 'Proje bulunamadı', message: 'Proje bulunamadı' }, { status: 404 });
    }

    console.log('Validate Rules API: Project found:', project.title);

    // Check access
    const isOwner = project.ownerId.toString() === session.user.id;
    const isEditor = project.collaborators?.some(
      (collab: any) => collab.userId.toString() === session.user.id && collab.role === 'editor'
    );

    if (!isOwner && !isEditor) {
      console.error('Validate Rules API: Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized', message: 'Bu projeye erişim yetkiniz yok' }, { status: 403 });
    }

    const template = project.templateId as any;
    if (!template) {
      console.error('Validate Rules API: Template not found for project');
      return NextResponse.json({ error: 'Şablon bulunamadı', message: 'Proje şablonu bulunamadı' }, { status: 404 });
    }

    console.log('Validate Rules API: Template found:', template.name);

    // Get all rules for this template
    console.log('Validate Rules API: Fetching rules for template:', template._id);
    const rules = await TemplateRule.find({ templateId: template._id })
      .sort({ priority: -1, isRequired: -1 })
      .lean();
    
    console.log('Validate Rules API: Found rules count:', rules.length);

    if (rules.length === 0) {
      return NextResponse.json({
        passed: true,
        message: 'Bu şablon için tanımlı kural bulunmamaktadır',
        violations: [],
      });
    }

    // Build project content
    const projectContent: Record<string, string> = {};
    if (project.content && typeof project.content === 'object') {
      Object.entries(project.content).forEach(([sectionId, content]: [string, any]) => {
        if (content && typeof content === 'object' && content.text) {
          projectContent[sectionId] = content.text;
        }
      });
    }

    let allContent = Object.values(projectContent).join('\n\n');
    
    // Limit content length to avoid AI API issues (Gemini has token limits)
    // More conservative limit to ensure AI can respond
    const MAX_CONTENT_LENGTH = 30000; // ~30K characters to leave room for prompt and rules
    if (allContent.length > MAX_CONTENT_LENGTH) {
      console.warn(`Validate Rules: Content too long (${allContent.length}), truncating to ${MAX_CONTENT_LENGTH}`);
      allContent = allContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n[... içerik kısaltıldı - ilk ${MAX_CONTENT_LENGTH} karakter gösteriliyor ...]';
    }

    // Build rules context - limit to avoid prompt being too long
    // More conservative limit - prioritize required and high priority rules
    const MAX_RULES_TO_SHOW = 15; // Show first 15 rules to avoid prompt being too long
    const rulesToShow = rules.slice(0, MAX_RULES_TO_SHOW);
    
    // Limit description length for each rule to keep prompt shorter
    const rulesContext = rulesToShow.map((rule, index) => {
      const description = rule.description.length > 200 
        ? rule.description.substring(0, 200) + '...' 
        : rule.description;
      return `${index + 1}. [${rule.isRequired ? 'ZORUNLU' : 'OPSİYONEL'}] ${rule.title} (Öncelik: ${rule.priority || 'N/A'}, Kategori: ${rule.category || 'Genel'})
   Açıklama: ${description}`;
    }).join('\n\n');
    
    if (rules.length > MAX_RULES_TO_SHOW) {
      console.warn(`Validate Rules: Too many rules (${rules.length}), showing first ${MAX_RULES_TO_SHOW} (prioritized by isRequired and priority)`);
    }

    const institutionName = template.institution === 'tubitak' ? 'TÜBİTAK' : template.institution === 'kosgeb' ? 'KOSGEB' : 'Ufuk Avrupa';

    const aiPrompt = `Sen bir ARGE proje değerlendirme uzmanısın. "${project.title}" adlı ${institutionName} projesinin içeriğini, şablon kurallarına göre kontrol edeceksin.

PROJE BİLGİLERİ:
- Başlık: "${project.title}"
- Açıklama: "${project.description}"
- Kurum: ${institutionName}

PROJE İÇERİĞİ:
${allContent || 'İçerik henüz oluşturulmamış.'}

ŞABLON KURALLARI (Bu kurallara göre kontrol yapılacak):
${rulesContext}

GÖREVİN:
1. Proje içeriğini her kurala göre kontrol et
2. İhlal edilen kuralları tespit et
3. Her ihlal için:
   - Hangi kural ihlal edildi (ruleId, title)
   - İhlalin açıklaması (description)
   - İhlalin ciddiyeti (severity): "low", "medium", "high", "critical"
   - İhlalin detaylı açıklaması

YANIT FORMATI:
SADECE geçerli bir JSON objesi döndür. Format şu şekilde olmalı:

{
  "passed": false,
  "violations": [
    {
      "ruleId": "rule-id-string",
      "title": "İhlal edilen kural başlığı",
      "description": "İhlalin detaylı açıklaması",
      "severity": "high"
    }
  ]
}

ÖNEMLİ KURALLAR:
- SADECE JSON döndür, başka açıklama ekleme
- Tüm ihlalleri tespit et
- Zorunlu kuralların (isRequired: true) ihlali "high" veya "critical" severity olmalı
- Öncelikli kuralların (priority yüksek) ihlali daha yüksek severity olmalı
- Eğer hiç ihlal yoksa passed: true ve violations: [] döndür
- Severity değerleri: "low", "medium", "high", "critical"

Şimdi proje içeriğini kontrol edip sonuçları JSON formatında döndür:`;

    console.log('Validate Rules: Checking project against rules', {
      projectId: id,
      rulesCount: rules.length,
      contentLength: allContent.length,
    });

    let aiResponse: string;
    try {
      console.log('Validate Rules: Calling AI API...');
      console.log('Validate Rules: Prompt length:', aiPrompt.length);
      
      aiResponse = await generateText(aiPrompt, {
        temperature: 0.3,
        maxTokens: 4000,
      });
      
      console.log('Validate Rules: AI response received, length:', aiResponse?.length || 0);
      
      if (!aiResponse || aiResponse.trim().length === 0) {
        console.error('Validate Rules: Empty AI response received');
        console.error('Validate Rules: Prompt length was:', aiPrompt.length);
        console.error('Validate Rules: Content length was:', allContent.length);
        console.error('Validate Rules: Rules count was:', rules.length);
        
        // Return a default response instead of throwing error
        const defaultValidationData = {
          passed: false,
          violations: [{
            ruleId: 'ai-error',
            title: 'AI Yanıt Hatası',
            description: 'AI yanıtı alınamadı. Prompt çok uzun olabilir veya AI API sorunu olabilir. Lütfen daha sonra tekrar deneyin.',
            severity: 'medium' as const,
          }],
          rulesChecked: rules.length,
          violationsCount: 1,
        };
        
        // Try to save even with error (non-blocking)
        Promise.resolve().then(async () => {
          try {
            if (mongoose.models.ProjectRuleValidation) {
              await ProjectRuleValidation.create({
                projectId: id,
                templateId: template._id,
                passed: defaultValidationData.passed,
                violations: defaultValidationData.violations,
                rulesChecked: defaultValidationData.rulesChecked,
                violationsCount: defaultValidationData.violationsCount,
                validatedAt: new Date(),
                validatedBy: session.user.id,
              });
              console.log('Validate Rules: Error validation saved');
            }
          } catch (saveError) {
            console.error('Validate Rules: Failed to save error validation:', saveError);
          }
        }).catch(() => {});
        
        return NextResponse.json(defaultValidationData);
      }
    } catch (aiError) {
      console.error('Validate Rules: AI generation error:', {
        error: aiError,
        errorType: aiError instanceof Error ? aiError.constructor.name : typeof aiError,
        errorMessage: aiError instanceof Error ? aiError.message : String(aiError),
        errorStack: aiError instanceof Error ? aiError.stack : undefined,
        promptLength: aiPrompt.length,
      });
      
      // Return error response instead of throwing
      const errorValidationData = {
        passed: false,
        violations: [{
          ruleId: 'ai-error',
          title: 'AI API Hatası',
          description: `AI yanıtı alınamadı: ${aiError instanceof Error ? aiError.message : 'Bilinmeyen hata'}`,
          severity: 'medium' as const,
        }],
        rulesChecked: rules.length,
        violationsCount: 1,
      };
      
      // Try to save error (non-blocking)
      Promise.resolve().then(async () => {
        try {
          if (mongoose.models.ProjectRuleValidation && id) {
            await ProjectRuleValidation.create({
              projectId: id,
              templateId: template._id,
              passed: errorValidationData.passed,
              violations: errorValidationData.violations,
              rulesChecked: errorValidationData.rulesChecked,
              violationsCount: errorValidationData.violationsCount,
              validatedAt: new Date(),
              validatedBy: session.user.id,
            });
          }
        } catch (saveError) {
          console.error('Validate Rules: Failed to save error validation:', saveError);
        }
      }).catch(() => {});
      
      return NextResponse.json(errorValidationData);
    }

    console.log('Validate Rules: Processing AI response...');
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
      console.error('Validate Rules: JSON not found in response');
      console.error('Validate Rules: Response preview:', cleanedResponse.substring(0, 500));
      throw new Error('AI yanıtından JSON formatı bulunamadı');
    }

    let jsonString = jsonMatch[0];
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    console.log('Validate Rules: JSON string extracted, length:', jsonString.length);

    let validationResult: any;
    try {
      console.log('Validate Rules: Parsing JSON...');
      validationResult = JSON.parse(jsonString);
      console.log('Validate Rules: JSON parsed successfully');
    } catch (parseError) {
      console.error('Validate Rules: JSON parse error:', {
        error: parseError,
        errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
        jsonPreview: jsonString.substring(0, 500),
      });
      throw new Error(`JSON parse hatası: ${parseError instanceof Error ? parseError.message : 'Bilinmeyen hata'}`);
    }

    if (!validationResult || typeof validationResult !== 'object') {
      console.error('Validate Rules: Invalid validation result format');
      throw new Error('Geçersiz validation sonucu formatı');
    }

    // Map ruleId to actual rule objects
    const violations = (validationResult.violations || []).map((violation: any) => {
      const rule = rules.find((r: any) => r._id.toString() === violation.ruleId || r.title === violation.title);
      return {
        ruleId: rule?._id?.toString() || violation.ruleId,
        title: violation.title || rule?.title || 'Bilinmeyen Kural',
        description: violation.description || '',
        severity: violation.severity || 'medium',
        rule: rule ? {
          category: rule.category,
          priority: rule.priority,
          isRequired: rule.isRequired,
        } : undefined,
      };
    });

    const validationData = {
      passed: validationResult.passed !== false && violations.length === 0,
      violations,
      rulesChecked: rules.length,
      violationsCount: violations.length,
    };

    // Save validation results to database
    try {
      console.log('Validate Rules: Saving validation results to database...');
      console.log('Validate Rules: Save data:', {
        projectId: id,
        templateId: template._id?.toString(),
        passed: validationData.passed,
        violationsCount: validationData.violations.length,
        rulesChecked: validationData.rulesChecked,
        validatedBy: session.user.id,
      });
      
      // Ensure model is registered
      if (!mongoose.models.ProjectRuleValidation) {
        console.warn('Validate Rules: ProjectRuleValidation model not found, importing...');
        await import('@/models/ProjectRuleValidation');
      }
      
      // Verify model is now registered
      if (!mongoose.models.ProjectRuleValidation) {
        console.error('Validate Rules: ProjectRuleValidation model still not registered after import');
        throw new Error('ProjectRuleValidation model could not be registered');
      }
      
      console.log('Validate Rules: Model registered, creating validation record...');
      
      const validationRecord = await ProjectRuleValidation.create({
        projectId: id,
        templateId: template._id,
        passed: validationData.passed,
        violations: validationData.violations,
        rulesChecked: validationData.rulesChecked,
        violationsCount: validationData.violationsCount,
        validatedAt: new Date(),
        validatedBy: session.user.id,
      });
      
      console.log('Validate Rules: Validation results saved successfully!', {
        validationId: validationRecord._id?.toString(),
        projectId: validationRecord.projectId?.toString(),
        templateId: validationRecord.templateId?.toString(),
      });
    } catch (saveError) {
      console.error('Validate Rules: CRITICAL - Failed to save validation results:', {
        error: saveError,
        errorType: saveError instanceof Error ? saveError.constructor.name : typeof saveError,
        errorMessage: saveError instanceof Error ? saveError.message : String(saveError),
        errorStack: saveError instanceof Error ? saveError.stack : undefined,
        projectId: id,
        templateId: template._id?.toString(),
        modelRegistered: !!mongoose.models.ProjectRuleValidation,
      });
      // Don't throw - continue and return results even if save fails
      // But log it clearly so we can debug
    }

    console.log('Validate Rules: Returning validation results');
    return NextResponse.json(validationData);
  } catch (error) {
    const errorDetails = {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      projectId: id || 'unknown',
    };
    
    console.error('Error validating project rules:', errorDetails);
    
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Always return a valid JSON response, even on error
    try {
      const errorResponse = {
        error: 'Kural kontrolü yapılamadı',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && {
          details: errorStack,
          errorType: errorDetails.errorType,
        }),
      };
      
      return NextResponse.json(
        errorResponse,
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (jsonError) {
      // Fallback if JSON creation fails
      console.error('Failed to create JSON error response:', jsonError);
      return new NextResponse(
        `{"error":"Kural kontrolü yapılamadı","message":"${errorMessage.replace(/"/g, '\\"')}"}`,
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }
}
