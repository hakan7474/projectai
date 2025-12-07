import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import TemplateRule from '@/models/TemplateRule';
import { z } from 'zod';

const updateRuleSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  priority: z.number().min(1).max(10).optional(),
  isRequired: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ruleId } = await params;
    const body = await request.json();
    const validatedData = updateRuleSchema.parse(body);

    await connectDB();
    await ensureModelsRegistered();

    const rule = await TemplateRule.findOne({ _id: ruleId, templateId: id });
    if (!rule) {
      return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 });
    }

    const updatedRule = await TemplateRule.findByIdAndUpdate(
      ruleId,
      validatedData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('sourceDocument', 'originalName')
      .lean();

    return NextResponse.json(updatedRule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Error updating template rule:', error);
    return NextResponse.json({ error: 'Kural güncellenemedi' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; ruleId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, ruleId } = await params;
    await connectDB();
    await ensureModelsRegistered();

    const rule = await TemplateRule.findOne({ _id: ruleId, templateId: id });
    if (!rule) {
      return NextResponse.json({ error: 'Kural bulunamadı' }, { status: 404 });
    }

    await TemplateRule.findByIdAndDelete(ruleId);

    return NextResponse.json({ message: 'Kural silindi' });
  } catch (error) {
    console.error('Error deleting template rule:', error);
    return NextResponse.json({ error: 'Kural silinemedi' }, { status: 500 });
  }
}
