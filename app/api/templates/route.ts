import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Template from '@/models/Template';
import { z } from 'zod';

const templateSchema = z.object({
  institution: z.enum(['tubitak', 'kosgeb', 'ufuk-avrupa']),
  name: z.string().min(1, 'Şablon adı gereklidir'),
  description: z.string().min(1, 'Açıklama gereklidir'),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      required: z.boolean(),
      maxLength: z.number().optional(),
      format: z.enum(['text', 'rich-text', 'table', 'budget']).optional(),
      instructions: z.string().optional(),
    })
  ),
  criteria: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      weight: z.number().optional(),
    })
  ),
  sourceDocument: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await ensureModelsRegistered();

    const templates = await Template.find({ isActive: true })
      .populate('createdBy', 'name email')
      .populate('sourceDocument', 'originalName storagePath mimeType')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Şablonlar getirilemedi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = templateSchema.parse(body);

    await connectDB();
    await ensureModelsRegistered();

    const template = await Template.create({
      institution: validatedData.institution,
      name: validatedData.name,
      description: validatedData.description,
      sections: validatedData.sections,
      criteria: validatedData.criteria,
      sourceDocument: validatedData.sourceDocument || undefined,
      createdBy: session.user.id,
      isActive: validatedData.isActive ?? true,
    });

    // Populate and return the created template
    const populatedTemplate = await Template.findById(template._id)
      .populate('createdBy', 'name email')
      .populate('sourceDocument', 'originalName storagePath mimeType')
      .lean();

    return NextResponse.json(populatedTemplate, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Şablon oluşturulamadı' }, { status: 500 });
  }
}

