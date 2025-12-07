import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import { z } from 'zod';

const updateRoleSchema = z.object({
  role: z.enum(['editor', 'viewer']),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string; userId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, userId } = await params;
    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body);

    await connectDB();

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Only owner can update roles
    if (project.ownerId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const collaborator = project.collaborators.find(
      (collab: any) => collab.userId.toString() === userId
    );

    if (!collaborator) {
      return NextResponse.json({ error: 'Collaborator bulunamadı' }, { status: 404 });
    }

    collaborator.role = validatedData.role;
    await project.save();

    return NextResponse.json({ message: 'Rol güncellendi' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Error updating role:', error);
    return NextResponse.json({ error: 'Rol güncellenemedi' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; userId: string }> }
) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, userId } = await params;

    await connectDB();

    const project = await Project.findById(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Only owner can remove collaborators
    if (project.ownerId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    project.collaborators = project.collaborators.filter(
      (collab: any) => collab.userId.toString() !== userId
    );

    await project.save();

    return NextResponse.json({ message: 'Collaborator kaldırıldı' });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    return NextResponse.json({ error: 'Collaborator kaldırılamadı' }, { status: 500 });
  }
}

