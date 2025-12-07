import mongoose, { Schema, Model } from 'mongoose';
import type { RuleSourceType } from '@/types';

export interface ITemplateRule extends mongoose.Document {
  templateId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category?: string;
  priority?: number;
  isRequired: boolean;
  sourceType: RuleSourceType;
  sourceDocument?: mongoose.Types.ObjectId;
  sourceUrl?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateRuleSchema = new Schema<ITemplateRule>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      trim: true,
    },
    priority: {
      type: Number,
      min: 1,
      max: 10,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    sourceType: {
      type: String,
      enum: ['manual', 'document', 'website'],
      required: true,
      default: 'manual',
    },
    sourceDocument: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

try {
  TemplateRuleSchema.index({ templateId: 1, createdAt: -1 });
  TemplateRuleSchema.index({ templateId: 1, category: 1 });
} catch (error) {
  // Index zaten varsa hata vermesin
}

const TemplateRule: Model<ITemplateRule> =
  mongoose.models.TemplateRule || mongoose.model<ITemplateRule>('TemplateRule', TemplateRuleSchema);

export { TemplateRuleSchema };
export default TemplateRule;
