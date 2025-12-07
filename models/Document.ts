import mongoose, { Schema, Model } from 'mongoose';
import { DocumentMetadata } from '@/types';

export interface IDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  extractedText: string;
  markdownContent?: string;
  metadata: DocumentMetadata;
  uploadedAt: Date;
}

const DocumentMetadataSchema = new Schema<DocumentMetadata>({
  pages: { type: Number },
  wordCount: { type: Number },
  language: { type: String },
});

const DocumentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    extractedText: {
      type: String,
      default: '',
    },
    markdownContent: {
      type: String,
      default: '',
    },
    metadata: {
      type: DocumentMetadataSchema,
      default: {},
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Index tanımlamalarını try-catch ile koruyalım
try {
  DocumentSchema.index({ userId: 1 });
  DocumentSchema.index({ projectId: 1 });
} catch (error) {
  // Index zaten varsa hata vermesin
}

// Use a different variable name to avoid conflict with mongoose.Document type
let DocumentModel: Model<IDocument>;

try {
  DocumentModel = mongoose.models.Document as Model<IDocument>;
} catch {
  DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
}

if (!DocumentModel) {
  DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
}

// Export directly as DocumentModel - imports can use it as Document
export default DocumentModel;
