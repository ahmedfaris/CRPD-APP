// src/server/db/seedTickets.ts
import { db } from '../../db/index.ts';
import { tickets } from '../../db/schema.ts';
import { sql } from 'drizzle-orm';
import { TicketModel } from '../models/ticketModel.ts';

export async function seedTicketsIfEmpty(): Promise<void> {
  // Empty for production export: tickets start cleanly from 0
}
