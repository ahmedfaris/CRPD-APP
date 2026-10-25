// src/server/db/mockDb.ts
import { ApplicationUser } from '../../types';

// This acts as our in-memory database to simulate SQL Server/PostgreSQL.
// In a real environment, you would replace this with a connection pool 
// to your SQL Server (e.g. using the 'mssql' package) or PostgreSQL (e.g. 'pg' or 'drizzle').

class Database {
  private users: ApplicationUser[] = [];

  constructor() {
    // Seed initial admin user if empty
    this.users.push({
      id: 'usr_admin',
      userName: 'admin',
      email: 'admin@system.local',
      emailConfirmed: true,
      fullName: 'System Administrator',
      department: 'IT Service Desk',
      jobTitle: 'Chief Administrator',
      role: 'Admin',
      userType: 'System Admin',
      failedAccessCount: 0,
      lockoutEnd: null,
      isLockedOut: false,
      mustChangePassword: false,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      avatarColor: 'bg-indigo-600'
    });
    this.users.push({
      id: 'usr_ahmed',
      userName: 'ahmed.faris',
      email: 'ahmed.faris89@gmail.com',
      emailConfirmed: true,
      fullName: 'Ahmed Faris',
      department: 'Operations',
      jobTitle: 'Senior Specialist',
      role: 'Employee',
      userType: 'Operational User',
      failedAccessCount: 0,
      lockoutEnd: null,
      isLockedOut: false,
      mustChangePassword: false,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      avatarColor: 'bg-slate-600'
    });
  }

  getUsers(): ApplicationUser[] {
    return this.users;
  }

  getUserById(id: string): ApplicationUser | undefined {
    return this.users.find(u => u.id === id);
  }

  createUser(user: ApplicationUser): ApplicationUser {
    this.users.push(user);
    return user;
  }

  deleteUser(id: string): boolean {
    const initialLength = this.users.length;
    this.users = this.users.filter(u => u.id !== id);
    return this.users.length < initialLength;
  }

  updateUser(id: string, updates: Partial<ApplicationUser>): ApplicationUser | null {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return null;

    this.users[index] = { ...this.users[index], ...updates };
    return this.users[index];
  }
}

export const db = new Database();
