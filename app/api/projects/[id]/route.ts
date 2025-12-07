import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Project from '@/models/Project';
import Template from '@/models/Template'; // Import Template to register the model
import mongoose from 'mongoose';
import { z, ZodError } from 'zod';

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  content: z.record(z.string(), z.any()).optional().nullable(),
  status: z.enum(['draft', 'in-progress', 'completed', 'submitted']).optional(),
  metadata: z
    .object({
      budget: z.number().optional(),
      duration: z.number().optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
}).passthrough(); // Allow extra fields

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('GET /api/projects/[id]: Starting');
    
    const session = await getAuthSession();

    if (!session) {
      console.error('GET /api/projects/[id]: Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('GET /api/projects/[id]: Project ID', { id });
    
    await connectDB();
    console.log('GET /api/projects/[id]: Database connected');

    // Ensure all models are registered before populate
    await ensureModelsRegistered();
    console.log('GET /api/projects/[id]: Models registered');

    console.log('GET /api/projects/[id]: Fetching project...');
    const project = await Project.findById(id)
      .populate('templateId', 'name institution sections criteria')
      .populate('ownerId', 'name email')
      .populate('collaborators.userId', 'name email')
      .populate('sourceDocuments.documentId', 'originalName extractedText')
      .lean();

    console.log('GET /api/projects/[id]: Project fetched', { 
      projectFound: !!project,
      hasTemplateId: !!project?.templateId 
    });

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Check access
    const isOwner = project.ownerId._id.toString() === session.user.id;
    const isCollaborator = project.collaborators?.some(
      (collab: any) => collab.userId._id.toString() === session.user.id
    );

    if (!isOwner && !isCollaborator) {
      console.error('GET /api/projects/[id]: Unauthorized access', {
        userId: session.user.id,
        ownerId: project.ownerId._id.toString(),
        isOwner,
        isCollaborator,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    console.log('GET /api/projects/[id]: Success');
    return NextResponse.json(project);
  } catch (error) {
    console.error('GET /api/projects/[id]: Error fetching project', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Proje getirilemedi',
        details: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    console.log('PUT /api/projects/[id]: Starting');
    
    const session = await getAuthSession();

    if (!session) {
      console.error('PUT /api/projects/[id]: Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    let body: any;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('PUT /api/projects/[id]: Invalid JSON in request body', jsonError);
      return NextResponse.json({ error: 'Geçersiz JSON formatı' }, { status: 400 });
    }
    
    console.log('PUT /api/projects/[id]: Request body', { 
      id, 
      hasContent: !!body.content,
      contentKeys: body.content ? Object.keys(body.content) : []
    });

    let validatedData;
    try {
      validatedData = updateProjectSchema.parse(body);
    } catch (validationError: any) {
      if (validationError instanceof ZodError || validationError?.name === 'ZodError') {
        console.error('PUT /api/projects/[id]: Validation error', {
          errors: validationError.errors || validationError.issues,
          message: validationError.message,
        });
        const errorDetails = validationError.errors 
          ? validationError.errors.map((e: any) => `${e.path?.join('.') || 'unknown'}: ${e.message || 'validation error'}`).join(', ')
          : validationError.message || 'Geçersiz veri formatı';
        return NextResponse.json(
          { 
            error: 'Geçersiz veri formatı',
            details: errorDetails
          }, 
          { status: 400 }
        );
      }
      console.error('PUT /api/projects/[id]: Unexpected validation error', {
        error: validationError,
        type: typeof validationError,
        name: validationError?.name,
        message: validationError?.message,
      });
      throw validationError;
    }

    await connectDB();
    console.log('PUT /api/projects/[id]: Database connected');

    const project = await Project.findById(id);

    if (!project) {
      console.error('PUT /api/projects/[id]: Project not found', { id });
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Check access
    const isOwner = project.ownerId.toString() === session.user.id;
    const isEditor = project.collaborators?.some(
      (collab: any) =>
        collab.userId.toString() === session.user.id && collab.role === 'editor'
    );

    if (!isOwner && !isEditor) {
      console.error('PUT /api/projects/[id]: Unauthorized access', {
        userId: session.user.id,
        ownerId: project.ownerId.toString(),
        isOwner,
        isEditor,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update project
    if (validatedData.content) {
      console.log('PUT /api/projects/[id]: Updating content', {
        contentKeys: Object.keys(validatedData.content),
      });
      
      // Handle content as Map or Object
      const contentMap = project.content instanceof Map ? project.content : new Map(Object.entries(project.content || {}));
      
      Object.keys(validatedData.content).forEach((sectionId) => {
        const incomingContent = validatedData.content[sectionId];
        const existing = contentMap.get(sectionId);
        
        contentMap.set(sectionId, {
          text: incomingContent.text || '',
          aiGenerated: incomingContent.aiGenerated ?? existing?.aiGenerated ?? false,
          lastModified: new Date(),
          version: existing ? (existing.version || 1) + 1 : 1,
        });
      });
      
      // Convert Map back to the format Mongoose expects
      project.content = contentMap as any;
    }

    if (validatedData.title) project.title = validatedData.title;
    if (validatedData.description) project.description = validatedData.description;
    if (validatedData.status) project.status = validatedData.status;
    if (validatedData.metadata) {
      project.metadata = { ...project.metadata, ...validatedData.metadata };
    }

    console.log('PUT /api/projects/[id]: Saving project');
    await project.save();
    console.log('PUT /api/projects/[id]: Project saved successfully');

    // Ensure all models are registered before populate
    await ensureModelsRegistered();

    const updatedProject = await Project.findById(id)
      .populate('templateId', 'name institution sections criteria')
      .lean();

    return NextResponse.json(updatedProject);
  } catch (error: any) {
    if (error instanceof ZodError || error?.name === 'ZodError') {
      console.error('PUT /api/projects/[id]: Validation error in catch', {
        errors: error.errors || error.issues,
        message: error.message,
      });
      const errorDetails = error.errors 
        ? error.errors.map((e: any) => `${e.path?.join('.') || 'unknown'}: ${e.message || 'validation error'}`).join(', ')
        : error.message || 'Geçersiz veri formatı';
      return NextResponse.json(
        { 
          error: 'Geçersiz veri formatı',
          details: errorDetails
        }, 
        { status: 400 }
      );
    }

    console.error('PUT /api/projects/[id]: Error updating project', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorName: error?.name,
      errorType: typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error,
    });
    return NextResponse.json(
      { 
        error: 'Proje güncellenemedi',
        details: error instanceof Error ? error.message : (error?.message || 'Bilinmeyen hata')
      }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const project = await Project.findById(id);

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Only owner can delete
    if (project.ownerId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await Project.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Proje silindi' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Proje silinemedi' }, { status: 500 });
  }
}
