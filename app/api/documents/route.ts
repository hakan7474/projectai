import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-helper';
import connectDB from '@/lib/mongodb';
import Document from '@/models/Document';
import Template from '@/models/Template';
import TemplateRule from '@/models/TemplateRule';
import { ensureModelsRegistered } from '@/lib/models';

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    await ensureModelsRegistered();

    const documents = await Document.find({ userId: session.user.id })
      .sort({ uploadedAt: -1 })
      .lean();

    // Find all document IDs used in templates and template rules
    const templateDocuments = await Template.find({
      sourceDocument: { $exists: true, $ne: null },
    })
      .select('sourceDocument')
      .lean();

    const ruleDocuments = await TemplateRule.find({
      sourceDocument: { $exists: true, $ne: null },
    })
      .select('sourceDocument')
      .lean();

    // Create a Set of all used document IDs
    const usedDocumentIds = new Set<string>();
    
    templateDocuments.forEach((template: any) => {
      if (template.sourceDocument) {
        usedDocumentIds.add(template.sourceDocument.toString());
      }
    });

    ruleDocuments.forEach((rule: any) => {
      if (rule.sourceDocument) {
        usedDocumentIds.add(rule.sourceDocument.toString());
      }
    });

    // Add isUsed flag to each document
    const documentsWithUsage = documents.map((doc: any) => ({
      ...doc,
      isUsed: usedDocumentIds.has(doc._id.toString()),
    }));

    return NextResponse.json(documentsWithUsage);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Dokümanlar getirilemedi' }, { status: 500 });
  }
}

