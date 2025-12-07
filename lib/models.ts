/**
 * Centralized model registration
 * Import this file to ensure all models are registered before use
 */
import mongoose from 'mongoose';

// Import all models to ensure they're registered
import '@/models/User';
import '@/models/Template';
import '@/models/Project';
import '@/models/Document';
import '@/models/Collaboration';
import '@/models/TemplateRule';
import '@/models/ProjectRuleValidation';

// Re-export models for convenience
export { default as User } from '@/models/User';
export { default as Template } from '@/models/Template';
export { default as Project } from '@/models/Project';
export { default as Document } from '@/models/Document';
export { default as Collaboration } from '@/models/Collaboration';
export { default as TemplateRule } from '@/models/TemplateRule';

/**
 * Ensure all models are registered
 * Call this function before using populate
 */
export async function ensureModelsRegistered() {
  const requiredModels = ['User', 'Template', 'Project', 'Document', 'Collaboration', 'TemplateRule', 'ProjectRuleValidation'];
  const missingModels = requiredModels.filter(
    (modelName) => !mongoose.models[modelName]
  );
  
  if (missingModels.length > 0) {
    console.warn('Missing models, re-importing:', missingModels);
    // Force re-import
    await Promise.all([
      import('@/models/User'),
      import('@/models/Template'),
      import('@/models/Project'),
      import('@/models/Document'),
      import('@/models/Collaboration'),
      import('@/models/TemplateRule'),
      import('@/models/ProjectRuleValidation'),
    ]);
    
    // Double check
    const stillMissing = requiredModels.filter(
      (modelName) => !mongoose.models[modelName]
    );
    if (stillMissing.length > 0) {
      console.error('Failed to register models:', stillMissing);
    }
  }
}

