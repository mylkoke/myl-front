import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole, BoardTheme } from './user.schema';

/**
 * Encapsulates all Mongoose access for users. Swapping the database
 * (e.g. to PostgreSQL) means reimplementing this class only.
 */
@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  findById(id: string): Promise<User | null> {
    return this.model.findById(id).lean();
  }

  findByUsername(username: string): Promise<User | null> {
    return this.model.findOne({ username }).lean();
  }

  findAll(): Promise<User[]> {
    return this.model.find().sort({ created_at: 1 }).lean();
  }

  async create(data: {
    username: string;
    password_hash: string;
    role?: UserRole;
  }): Promise<User> {
    const doc = await this.model.create(data);
    return doc.toObject();
  }

  async update(
    id: string,
    patch: Partial<{ board_theme: BoardTheme; active_deck_id: string; role: UserRole }>,
  ): Promise<User | null> {
    return this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
  }
}
