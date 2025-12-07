import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Template from '@/models/Template';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  institution: z.enum(['tubitak', 'kosgeb', 'ufuk-avrupa']).optional(),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        required: z.boolean(),
        maxLength: z.number().optional(),
        format: z.enum(['text', 'rich-text', 'table', 'budget']).optional(),
        instructions: z.string().optional(),
      })
    )
    .optional(),
  criteria: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        weight: z.number().optional(),
      })
    )
    .optional(),
  sourceDocument: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.findById(id)
      .populate('createdBy', 'name email')
      .populate('sourceDocument', 'originalName storagePath mimeType')
      .lean();

    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Şablon getirilemedi' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateTemplateSchema.parse(body);

    await connectDB();
    await ensureModelsRegistered();

    const updateData: any = { ...validatedData };
    if (validatedData.sourceDocument !== undefined) {
      updateData.sourceDocument = validatedData.sourceDocument || null;
    }

    const template = await Template.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('sourceDocument', 'originalName storagePath mimeType');

    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Şablon güncellenemedi' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.findByIdAndDelete(id);

    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Şablon silindi' });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Şablon silinemedi' }, { status: 500 });
  }
}

