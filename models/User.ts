import mongoose, { Schema, Model } from 'mongoose';
import { UserRole } from '@/types';

export interface IUser extends mongoose.Document {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Index tanımlaması - unique: true zaten index oluşturur, ama açıkça tanımlayalım
try {
  UserSchema.index({ email: 1 }, { unique: true });
} catch (error) {
  // Index zaten varsa hata vermesin
}

let UserModel: Model<IUser>;

try {
  UserModel = mongoose.models.User as Model<IUser>;
} catch {
  UserModel = mongoose.model<IUser>('User', UserSchema);
}

if (!UserModel) {
  UserModel = mongoose.model<IUser>('User', UserSchema);
}

export default UserModel;
