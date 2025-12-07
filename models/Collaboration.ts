import mongoose, { Schema, Model } from 'mongoose';
import { CollaborationAction } from '@/types';

export interface ICollaboration extends mongoose.Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: CollaborationAction;
  sectionId?: string;
  details: Record<string, unknown>;
  timestamp: Date;
}

const CollaborationSchema = new Schema<ICollaboration>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['create', 'edit', 'comment', 'share'],
      required: true,
    },
    sectionId: {
      type: String,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
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
  CollaborationSchema.index({ projectId: 1, timestamp: -1 });
  CollaborationSchema.index({ userId: 1 });
} catch (error) {
  // Index zaten varsa hata vermesin
}

let Collaboration: Model<ICollaboration>;

try {
  Collaboration = mongoose.models.Collaboration as Model<ICollaboration>;
} catch {
  Collaboration = mongoose.model<ICollaboration>('Collaboration', CollaborationSchema);
}

if (!Collaboration) {
  Collaboration = mongoose.model<ICollaboration>('Collaboration', CollaborationSchema);
}

export default Collaboration;
