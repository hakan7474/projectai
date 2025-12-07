import mongoose, { Schema, Model } from 'mongoose';

export interface IProjectRuleValidation extends mongoose.Document {
  projectId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  passed: boolean;
  violations: Array<{
    ruleId: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    rule?: {
      category?: string;
      priority?: number;
      isRequired?: boolean;
    };
  }>;
  rulesChecked: number;
  violationsCount: number;
  validatedAt: Date;
  validatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ViolationSchema = new Schema(
  {
    ruleId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    rule: {
      category: String,
      priority: Number,
      isRequired: Boolean,
    },
  },
  { _id: false }
);

const ProjectRuleValidationSchema = new Schema<IProjectRuleValidation>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
      required: true,
    },
    passed: {
      type: Boolean,
      required: true,
      default: false,
    },
    violations: {
      type: [ViolationSchema],
      default: [],
    },
    rulesChecked: {
      type: Number,
      required: true,
      default: 0,
    },
    violationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    validatedAt: {
      type: Date,
      default: Date.now,
    },
    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
try {
  ProjectRuleValidationSchema.index({ projectId: 1, validatedAt: -1 });
  ProjectRuleValidationSchema.index({ projectId: 1, passed: 1 });
} catch (error) {
  // Index already exists
}

const ProjectRuleValidation: Model<IProjectRuleValidation> =
  mongoose.models.ProjectRuleValidation ||
  mongoose.model<IProjectRuleValidation>('ProjectRuleValidation', ProjectRuleValidationSchema);

export { ProjectRuleValidationSchema };
export default ProjectRuleValidation;
