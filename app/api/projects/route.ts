import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import Template from '@/models/Template';
import mongoose from 'mongoose';
import { z } from 'zod';

const projectSchema = z.object({
  title: z.string().min(1, 'Proje başlığı gereklidir'),
  description: z.string().min(1, 'Açıklama gereklidir'),
  templateId: z.string().min(1, 'Şablon seçimi gereklidir'),
  institution: z.string().min(1, 'Kurum seçimi gereklidir'),
  sourceDocuments: z.array(z.string()).optional(),
  metadata: z
    .object({
      budget: z.number().optional(),
      duration: z.number().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Ensure Template model is registered before populate
    const _templateCheck = Template;
    if (!mongoose.models.Template) {
      const TemplateModule = await import('@/models/Template');
      if (TemplateModule.TemplateSchema) {
        mongoose.model('Template', TemplateModule.TemplateSchema);
      }
    }

    const projects = await Project.find({ ownerId: session.user.id })
      .populate('templateId', 'name institution')
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Projeler getirilemedi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = projectSchema.parse(body);

    await connectDB();

    // Verify template exists
    const template = await Template.findById(validatedData.templateId);
    if (!template) {
      return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 });
    }

    // Create project
    const project = await Project.create({
      title: validatedData.title,
      description: validatedData.description,
      templateId: validatedData.templateId,
      institution: validatedData.institution,
      ownerId: session.user.id,
      sourceDocuments: validatedData.sourceDocuments?.map((docId) => ({
        documentId: docId,
        uploadedAt: new Date(),
      })) || [],
      metadata: validatedData.metadata || {},
      status: 'draft',
    });

    // Ensure Template model is registered before populate
    if (!mongoose.models.Template) {
      const TemplateModule = await import('@/models/Template');
      if (TemplateModule.TemplateSchema) {
        mongoose.model('Template', TemplateModule.TemplateSchema);
      }
    }

    const populatedProject = await Project.findById(project._id)
      .populate('templateId', 'name institution sections')
      .lean();

    return NextResponse.json(populatedProject, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Proje oluşturulamadı' }, { status: 500 });
  }
}

