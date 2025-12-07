import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Document from '@/models/Document';
import { processDocument } from '@/lib/document-processor';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Desteklenmeyen dosya tipi. PDF, DOCX, TXT veya MD dosyaları yükleyebilirsiniz.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Dosya boyutu 10MB\'dan büyük olamaz' }, { status: 400 });
    }

    await connectDB();
    await ensureModelsRegistered();

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const filename = `${uuidv4()}${fileExtension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Process document (extract text)
    let processed;
    let processingWarning: string | null = null;
    try {
      processed = await processDocument(filePath, file.type);
    } catch (processError) {
      // If processing fails, still save the document but with empty text
      console.error('Document processing failed, saving with empty text:', processError);
      processed = {
        text: '',
        metadata: {
          wordCount: 0,
        },
      };
      
      // Store warning message but don't fail the upload
      processingWarning = processError instanceof Error ? processError.message : 'Dosya işlenemedi';
      
      // Provide helpful suggestions based on error
      if (processingWarning.includes('body element') || processingWarning.includes('docx file')) {
        processingWarning = 'Word dosyası işlenemedi. Dosyanın DOCX formatında olduğundan ve bozuk olmadığından emin olun. Alternatif: Dosyayı PDF formatına çevirip yükleyebilirsiniz.';
      }
    }

    // Save document metadata to database
    const document = await Document.create({
      userId: session.user.id,
      projectId: projectId || undefined,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      storagePath: `/uploads/${filename}`,
      extractedText: processed.text,
      metadata: processed.metadata,
    });

    return NextResponse.json(
      {
        message: processingWarning 
          ? 'Doküman yüklendi ancak içerik çıkarılamadı' 
          : 'Doküman başarıyla yüklendi',
        document: {
          id: document._id.toString(),
          filename: document.filename,
          originalName: document.originalName,
          size: document.size,
          mimeType: document.mimeType,
          metadata: document.metadata,
        },
        warning: processingWarning || undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    return NextResponse.json(
      {
        error: 'Doküman yüklenemedi',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

