import mongoose, { Schema, Model } from 'mongoose';
import { ProjectStatus, Collaborator, SourceDocument, ProjectMetadata, ProjectContent } from '@/types';

export interface IProject extends mongoose.Document {
  title: string;
  description: string;
  templateId: mongoose.Types.ObjectId;
  institution: string;
  ownerId: mongoose.Types.ObjectId;
  collaborators: Collaborator[];
  content: ProjectContent;
  sourceDocuments: SourceDocument[];
  status: ProjectStatus;
  metadata: ProjectMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const CollaboratorSchema = new Schema<Collaborator>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['editor', 'viewer'],
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const SourceDocumentSchema = new Schema<SourceDocument>({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const ProjectSchema = new Schema<IProject>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
    },
    institution: {
      type: String,
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collaborators: {
      type: [CollaboratorSchema],
      default: [],
    },
    content: {
      type: Map,
      of: {
        text: { type: String, default: '' },
        aiGenerated: { type: Boolean, default: false },
        lastModified: { type: Date, default: Date.now },
        version: { type: Number, default: 1 },
      },
      default: {},
    },
    sourceDocuments: {
      type: [SourceDocumentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'in-progress', 'completed', 'submitted'],
      default: 'draft',
    },
    metadata: {
      budget: { type: Number },
      duration: { type: Number },
      keywords: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

// Index tanımlamalarını try-catch ile koruyalım
try {
  ProjectSchema.index({ ownerId: 1, status: 1 });
  ProjectSchema.index({ templateId: 1 });
} catch (error) {
  // Index zaten varsa hata vermesin
}

let Project: Model<IProject>;

// Ensure model is registered - check if it exists in mongoose.models first
if (mongoose.models.Project) {
  Project = mongoose.models.Project as Model<IProject>;
} else {
  Project = mongoose.model<IProject>('Project', ProjectSchema);
}

export default Project;
