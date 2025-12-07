export type UserRole = 'admin' | 'user';
export type Institution = 'tubitak' | 'kosgeb' | 'ufuk-avrupa';
export type ProjectStatus = 'draft' | 'in-progress' | 'completed' | 'submitted';
export type CollaboratorRole = 'editor' | 'viewer';
export type SectionFormat = 'text' | 'rich-text' | 'table' | 'budget';
export type CollaborationAction = 'create' | 'edit' | 'comment' | 'share';

export interface Section {
  id: string;
  title: string;
  required: boolean;
  maxLength?: number;
  format?: SectionFormat;
  instructions?: string;
}

export interface Criteria {
  title: string;
  description: string;
  weight?: number;
}

export interface ProjectContent {
  [sectionId: string]: {
    text: string;
    aiGenerated: boolean;
    lastModified: Date;
    version: number;
  };
}

export interface Collaborator {
  userId: string;
  role: CollaboratorRole;
  addedAt: Date;
}

export interface SourceDocument {
  documentId: string;
  uploadedAt: Date;
}

export interface ProjectMetadata {
  budget?: number;
  duration?: number;
  keywords?: string[];
}

export interface DocumentMetadata {
  pages?: number;
  wordCount?: number;
  language?: string;
}

export type RuleSourceType = 'manual' | 'document' | 'website';

export interface TemplateRule {
  id?: string;
  templateId: string;
  title: string;
  description: string;
  category?: string;
  priority?: number;
  isRequired: boolean;
  sourceType: RuleSourceType;
  sourceDocument?: string;
  sourceUrl?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RuleViolation {
  ruleId: string;
  title: string;
  description: string;
  severity: ViolationSeverity;
  rule?: {
    category?: string;
    priority?: number;
    isRequired?: boolean;
  };
}

export interface ProjectRuleValidation {
  id?: string;
  projectId: string;
  templateId: string;
  passed: boolean;
  violations: RuleViolation[];
  rulesChecked: number;
  violationsCount: number;
  validatedAt: Date;
  validatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

