import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Template from '@/models/Template';
import TemplateRule from '@/models/TemplateRule';
import { z } from 'zod';

const createRuleSchema = z.object({
  title: z.string().min(1, 'Başlık gereklidir'),
  description: z.string().min(1, 'Açıklama gereklidir'),
  category: z.string().optional(),
  priority: z.number().min(1).max(10).optional(),
  isRequired: z.boolean().optional().default(false),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    const rules = await TemplateRule.find({ templateId: id })
      .populate('createdBy', 'name email')
      .populate('sourceDocument', 'originalName')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching template rules:', error);
    return NextResponse.json({ error: 'Kurallar getirilemedi' }, { status: 500 });
  }
}

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
    const validatedData = createRuleSchema.parse(body);

    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.findById(id);
    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    const rule = await TemplateRule.create({
      templateId: id,
      title: validatedData.title,
      description: validatedData.description,
      category: validatedData.category,
      priority: validatedData.priority,
      isRequired: validatedData.isRequired ?? false,
      sourceType: 'manual',
      createdBy: session.user.id,
    });

    const populatedRule = await TemplateRule.findById(rule._id)
      .populate('createdBy', 'name email')
      .lean();

    return NextResponse.json(populatedRule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error('Error creating template rule:', error);
    return NextResponse.json({ error: 'Kural oluşturulamadı' }, { status: 500 });
  }
}
