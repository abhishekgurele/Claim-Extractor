import { type User, type InsertUser, type FieldDefinition, type InsertFieldDefinition, defaultFieldDefinitions } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getFieldDefinitions(): Promise<FieldDefinition[]>;
  getEnabledFieldDefinitions(): Promise<FieldDefinition[]>;
  createFieldDefinition(field: InsertFieldDefinition): Promise<FieldDefinition>;
  updateFieldDefinition(id: string, updates: Partial<FieldDefinition>): Promise<FieldDefinition | undefined>;
  deleteFieldDefinition(id: string): Promise<boolean>;
  resetFieldDefinitions(): Promise<FieldDefinition[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private fieldDefinitions: Map<string, FieldDefinition>;

  constructor() {
    this.users = new Map();
    this.fieldDefinitions = new Map();
    defaultFieldDefinitions.forEach(field => {
      this.fieldDefinitions.set(field.id, field);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getFieldDefinitions(): Promise<FieldDefinition[]> {
    return Array.from(this.fieldDefinitions.values());
  }

  async getEnabledFieldDefinitions(): Promise<FieldDefinition[]> {
    return Array.from(this.fieldDefinitions.values()).filter(f => f.enabled);
  }

  async createFieldDefinition(field: InsertFieldDefinition): Promise<FieldDefinition> {
    const id = randomUUID();
    const newField: FieldDefinition = { ...field, id };
    this.fieldDefinitions.set(id, newField);
    return newField;
  }

  async updateFieldDefinition(id: string, updates: Partial<FieldDefinition>): Promise<FieldDefinition | undefined> {
    const existing = this.fieldDefinitions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, id };
    this.fieldDefinitions.set(id, updated);
    return updated;
  }

  async deleteFieldDefinition(id: string): Promise<boolean> {
    return this.fieldDefinitions.delete(id);
  }

  async resetFieldDefinitions(): Promise<FieldDefinition[]> {
    this.fieldDefinitions.clear();
    defaultFieldDefinitions.forEach(field => {
      this.fieldDefinitions.set(field.id, field);
    });
    return Array.from(this.fieldDefinitions.values());
  }
}

export const storage = new MemStorage();
