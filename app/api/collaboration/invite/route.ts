import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';
import User from '@/models/User';
import { z } from 'zod';

const inviteSchema = z.object({
  projectId: z.string(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
});

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = inviteSchema.parse(body);

    await connectDB();

    const project = await Project.findById(validatedData.projectId);

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Only owner can invite
    if (project.ownerId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Find user by email
    const user = await User.findOne({ email: validatedData.email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    // Check if already a collaborator
    const existingCollaborator = project.collaborators.find(
      (collab: any) => collab.userId.toString() === user._id.toString()
    );

    if (existingCollaborator) {
      return NextResponse.json({ error: 'Kullanıcı zaten collaborator' }, { status: 400 });
    }

    // Add collaborator
    project.collaborators.push({
      userId: user._id,
      role: validatedData.role,
      addedAt: new Date(),
    });

    await project.save();

    return NextResponse.json({
      message: 'Collaborator başarıyla eklendi',
      collaborator: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: validatedData.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error('Error inviting collaborator:', error);
    return NextResponse.json({ error: 'Davet gönderilemedi' }, { status: 500 });
  }
}

