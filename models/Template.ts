import mongoose, { Schema, Model } from 'mongoose';
import { Institution, Section, Criteria } from '@/types';

export interface ITemplate extends mongoose.Document {
  institution: Institution;
  name: string;
  description: string;
  sections: Section[];
  criteria: Criteria[];
  createdBy: mongoose.Types.ObjectId;
  sourceDocument?: mongoose.Types.ObjectId; // Reference to uploaded template document
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<Section>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  required: { type: Boolean, default: false },
  maxLength: { type: Number },
  format: {
    type: String,
    enum: ['text', 'rich-text', 'table', 'budget'],
    default: 'text',
  },
  instructions: { type: String },
});

const CriteriaSchema = new Schema<Criteria>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  weight: { type: Number },
});

const TemplateSchema = new Schema<ITemplate>(
  {
    institution: {
      type: String,
      enum: ['tubitak', 'kosgeb', 'ufuk-avrupa'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    sections: {
      type: [SectionSchema],
      default: [],
    },
    criteria: {
      type: [CriteriaSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sourceDocument: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strictPopulate: false, // Allow populating fields that may not exist in all documents
  } as any
);

// Index tanımlamasını try-catch ile koruyalım
try {
  TemplateSchema.index({ institution: 1, isActive: 1 });
} catch (error) {
  // Index zaten varsa hata vermesin
}

// Ensure model is registered - check if it exists in mongoose.models first
// This pattern ensures the model is registered even in Next.js hot reload scenarios
const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

// Export schema for manual registration if needed
export { TemplateSchema };

export default Template;
