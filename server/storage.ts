import { type User, type InsertUser, type FieldDefinition, type InsertFieldDefinition, type Rule, type InsertRule, defaultFieldDefinitions, type ClaimSubmission, type DocumentChecklistItem, requiredDocumentTypes, type RequiredDocumentType } from "@shared/schema";
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
  getRules(): Promise<Rule[]>;
  getEnabledRules(): Promise<Rule[]>;
  getRule(id: string): Promise<Rule | undefined>;
  createRule(rule: InsertRule): Promise<Rule>;
  updateRule(id: string, updates: Partial<Rule>): Promise<Rule | undefined>;
  deleteRule(id: string): Promise<boolean>;
  createSubmission(patientInfo: ClaimSubmission['patientInfo'], providerEmail: string): Promise<ClaimSubmission>;
  getSubmission(id: string): Promise<ClaimSubmission | undefined>;
  updateSubmissionDocument(id: string, documentType: RequiredDocumentType, document: Omit<DocumentChecklistItem, 'type'>): Promise<ClaimSubmission | undefined>;
  updateSubmissionStatus(id: string, status: ClaimSubmission['status']): Promise<ClaimSubmission | undefined>;
  setSubmissionNotified(id: string): Promise<ClaimSubmission | undefined>;
  setSubmissionExtractedData(id: string, data: Record<string, any>): Promise<ClaimSubmission | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private fieldDefinitions: Map<string, FieldDefinition>;
  private rules: Map<string, Rule>;
  private submissions: Map<string, ClaimSubmission>;

  constructor() {
    this.users = new Map();
    this.fieldDefinitions = new Map();
    this.rules = new Map();
    this.submissions = new Map();
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

  async getRules(): Promise<Rule[]> {
    return Array.from(this.rules.values());
  }

  async getEnabledRules(): Promise<Rule[]> {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  async getRule(id: string): Promise<Rule | undefined> {
    return this.rules.get(id);
  }

  async createRule(rule: InsertRule): Promise<Rule> {
    const id = randomUUID();
    const newRule: Rule = { ...rule, id };
    this.rules.set(id, newRule);
    return newRule;
  }

  async updateRule(id: string, updates: Partial<Rule>): Promise<Rule | undefined> {
    const existing = this.rules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, id };
    this.rules.set(id, updated);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  private calculateMissingDocuments(checklist: DocumentChecklistItem[]): RequiredDocumentType[] {
    return requiredDocumentTypes.filter(type => {
      const item = checklist.find(c => c.type === type);
      return !item || !item.uploaded;
    });
  }

  async createSubmission(patientInfo: ClaimSubmission['patientInfo'], providerEmail: string): Promise<ClaimSubmission> {
    const id = randomUUID();
    const documentChecklist: DocumentChecklistItem[] = requiredDocumentTypes.map(type => ({
      type,
      uploaded: false,
    }));
    
    const submission: ClaimSubmission = {
      id,
      patientInfo,
      documentChecklist,
      isComplete: false,
      missingDocuments: [...requiredDocumentTypes],
      createdAt: new Date().toISOString(),
      status: 'pending_documents',
      providerEmail,
    };
    
    this.submissions.set(id, submission);
    return submission;
  }

  async getSubmission(id: string): Promise<ClaimSubmission | undefined> {
    return this.submissions.get(id);
  }

  async updateSubmissionDocument(id: string, documentType: RequiredDocumentType, document: Omit<DocumentChecklistItem, 'type'>): Promise<ClaimSubmission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;

    const updatedChecklist = submission.documentChecklist.map(item => {
      if (item.type === documentType) {
        return { ...item, ...document, type: documentType };
      }
      return item;
    });

    const missingDocuments = this.calculateMissingDocuments(updatedChecklist);
    const isComplete = missingDocuments.length === 0;

    const updated: ClaimSubmission = {
      ...submission,
      documentChecklist: updatedChecklist,
      missingDocuments,
      isComplete,
      status: isComplete ? 'ready' : 'pending_documents',
    };

    this.submissions.set(id, updated);
    return updated;
  }

  async updateSubmissionStatus(id: string, status: ClaimSubmission['status']): Promise<ClaimSubmission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;

    const updated: ClaimSubmission = { ...submission, status };
    this.submissions.set(id, updated);
    return updated;
  }

  async setSubmissionNotified(id: string): Promise<ClaimSubmission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;

    const updated: ClaimSubmission = {
      ...submission,
      status: 'notified',
      notificationSentAt: new Date().toISOString(),
    };

    this.submissions.set(id, updated);
    return updated;
  }

  async setSubmissionExtractedData(id: string, data: Record<string, any>): Promise<ClaimSubmission | undefined> {
    const submission = this.submissions.get(id);
    if (!submission) return undefined;

    const updated: ClaimSubmission = {
      ...submission,
      extractedData: data,
      status: 'completed',
    };

    this.submissions.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
