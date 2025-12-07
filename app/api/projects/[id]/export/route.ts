import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import { ensureModelsRegistered } from '@/lib/models';
import Project from '@/models/Project';

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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf'; // 'pdf' or 'docx'

    await connectDB();
    await ensureModelsRegistered();

    const project = await Project.findById(id)
      .populate('templateId', 'name institution sections')
      .populate('ownerId', 'name email')
      .lean();

    if (!project) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 });
    }

    // Check access
    const isOwner = (project.ownerId as any)._id.toString() === session.user.id;
    const isCollaborator = project.collaborators?.some(
      (collab: any) => (collab.userId as any)?._id?.toString() === session.user.id
    );

    if (!isOwner && !isCollaborator) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const template = project.templateId as any;
    const sections = template?.sections || [];
    
    // Handle content as Map or Object
    let content: Record<string, any> = {};
    if (project.content) {
      if (project.content instanceof Map) {
        content = Object.fromEntries(project.content);
      } else if (typeof project.content === 'object') {
        content = project.content;
      }
    }
    
    // Extract text from content objects
    const contentTexts: Record<string, string> = {};
    Object.entries(content).forEach(([sectionId, sectionContent]: [string, any]) => {
      if (sectionContent && typeof sectionContent === 'object' && sectionContent.text) {
        contentTexts[sectionId] = sectionContent.text;
      } else if (typeof sectionContent === 'string') {
        contentTexts[sectionId] = sectionContent;
      }
    });

    if (format === 'docx') {
      // Dynamic import for docx to avoid build-time issues
      const docxModule = await import('docx');
      return await exportToWord(project, template, sections, contentTexts, docxModule);
    } else {
      // Use require for pdfkit as it's a Node.js-only library
      // Dynamic import can cause issues with CommonJS modules
      try {
        const pdfkitModule = require('pdfkit');
        console.log('PDFKit module loaded:', {
          hasDefault: !!pdfkitModule.default,
          keys: Object.keys(pdfkitModule),
          moduleType: typeof pdfkitModule,
          isFunction: typeof pdfkitModule === 'function',
        });
        return await exportToPDF(project, template, sections, contentTexts, pdfkitModule);
      } catch (importError) {
        console.error('Error requiring pdfkit:', {
          error: importError,
          message: importError instanceof Error ? importError.message : String(importError),
          stack: importError instanceof Error ? importError.stack : undefined,
        });
        throw importError;
      }
    }
  } catch (error) {
    console.error('Error exporting project:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Dışa aktarma başarısız oldu', 
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

async function exportToPDF(
  project: any,
  template: any,
  sections: any[],
  content: Record<string, string>,
  pdfkitModule: any
) {
  return new Promise<NextResponse>((resolve, reject) => {
    try {
      // pdfkit exports PDFDocument - handle both CommonJS (require) and ES modules (import)
      let PDFDocument = pdfkitModule;
      
      // If it's an ES module with default export
      if (pdfkitModule.default) {
        PDFDocument = pdfkitModule.default;
      }
      // If it's a CommonJS module, PDFDocument might be the module itself
      else if (typeof pdfkitModule === 'function') {
        PDFDocument = pdfkitModule;
      }
      // Try accessing PDFDocument property
      else if (pdfkitModule.PDFDocument) {
        PDFDocument = pdfkitModule.PDFDocument;
      }
      
      if (!PDFDocument || typeof PDFDocument !== 'function') {
        console.error('PDFDocument is not a function:', {
          pdfkitModule,
          default: pdfkitModule.default,
          PDFDocument: pdfkitModule.PDFDocument,
          type: typeof PDFDocument,
          moduleType: typeof pdfkitModule,
          keys: Object.keys(pdfkitModule),
        });
        reject(new Error('PDFDocument constructor not found in pdfkit module'));
        return;
      }
      
      console.log('Creating PDFDocument instance...');
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(
          new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${sanitizeFilename(project.title)}.pdf"`,
            },
          })
        );
      });
      doc.on('error', reject);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text(project.title, { align: 'center' });
      doc.moveDown(0.5);

      // Description
      if (project.description) {
        doc.fontSize(12).font('Helvetica').text(project.description, { align: 'justify' });
        doc.moveDown(1);
      }

      // Project Info
      doc.fontSize(14).font('Helvetica-Bold').text('Proje Bilgileri', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Kurum: ${getInstitutionName(template?.institution || '')}`, { indent: 20 });
      doc.text(`Durum: ${getStatusLabel(project.status)}`, { indent: 20 });
      if (project.metadata?.budget) {
        doc.text(`Bütçe: ${project.metadata.budget.toLocaleString('tr-TR')} TL`, { indent: 20 });
      }
      if (project.metadata?.duration) {
        doc.text(`Süre: ${project.metadata.duration} ay`, { indent: 20 });
      }
      doc.moveDown(1);

      // Sections
      sections.forEach((section, index) => {
        const sectionText = content[section.id] || '';

        if (sectionText.trim()) {
          // Section Title
          if (index > 0) {
            doc.addPage();
          }
          doc.fontSize(14).font('Helvetica-Bold').text(`${index + 1}. ${section.title}`, {
            underline: true,
          });
          doc.moveDown(0.3);

          // Section Instructions
          if (section.instructions) {
            doc.fontSize(9).font('Helvetica-Oblique').text(`Not: ${section.instructions}`, {
              indent: 20,
              color: '#666666',
            });
            doc.moveDown(0.3);
          }

          // Section Content
          doc.fontSize(11).font('Helvetica');
          const lines = sectionText.split('\n');
          lines.forEach((line: string) => {
            if (line.trim()) {
              // Handle long lines - wrap text
              doc.text(line, { 
                align: 'justify', 
                indent: 20,
                width: doc.page.width - 100, // Account for margins
              });
            } else {
              doc.moveDown(0.3);
            }
          });

          doc.moveDown(1);
        }
      });

      doc.end();
    } catch (error) {
      console.error('Error in exportToPDF:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      reject(error);
    }
  });
}

async function exportToWord(
  project: any,
  template: any,
  sections: any[],
  content: Record<string, string>,
  docxModule: typeof import('docx')
) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxModule;
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: project.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Description
  if (project.description) {
    children.push(
      new Paragraph({
        text: project.description,
        spacing: { after: 300 },
      })
    );
  }

  // Project Info
  children.push(
    new Paragraph({
      text: 'Proje Bilgileri',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  const infoText = [
    `Kurum: ${getInstitutionName(template?.institution || '')}`,
    `Durum: ${getStatusLabel(project.status)}`,
    project.metadata?.budget ? `Bütçe: ${project.metadata.budget.toLocaleString('tr-TR')} TL` : null,
    project.metadata?.duration ? `Süre: ${project.metadata.duration} ay` : null,
  ]
    .filter(Boolean)
    .join('\n');

  children.push(
    new Paragraph({
      text: infoText,
      spacing: { after: 400 },
    })
  );

  // Sections
  sections.forEach((section, index) => {
    const sectionText = content[section.id] || '';

    if (sectionText.trim()) {
      // Section Title
      children.push(
        new Paragraph({
          text: `${index + 1}. ${section.title}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: index > 0 ? 400 : 200, after: 200 },
        })
      );

      // Section Instructions
      if (section.instructions) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Not: ${section.instructions}`,
                italics: true,
                color: '666666',
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }

      // Section Content
      const lines = sectionText.split('\n');
      lines.forEach((line: string) => {
        if (line.trim()) {
          children.push(
            new Paragraph({
              text: line,
              spacing: { after: 100 },
            })
          );
        } else {
          children.push(
            new Paragraph({
              spacing: { after: 100 },
            })
          );
        }
      });
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = sanitizeFilename(project.title);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}.docx"`,
    },
  });
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

function getInstitutionName(institution: string): string {
  const names: Record<string, string> = {
    tubitak: 'TÜBİTAK',
    kosgeb: 'KOSGEB',
    'ufuk-avrupa': 'Ufuk Avrupa',
  };
  return names[institution] || institution;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Taslak',
    'in-progress': 'Devam Ediyor',
    completed: 'Tamamlandı',
    submitted: 'Başvuruldu',
  };
  return labels[status] || status;
}
