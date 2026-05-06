/**
 * Database initialization script.
 * Creates necessary tables if they don't exist and seeds initial data.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize the database by running the schema script
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Initializing database...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../../database/schema.mysql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Split into individual statements (removing comments and empty lines)
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.toUpperCase().includes('CREATE DATABASE')) {
        // Skip database creation - assume it exists or handle separately
        continue;
      }
      
      if (statement.toUpperCase().includes('USE ')) {
        // Skip USE statement - we're already connected to the database
        continue;
      }
      
      try {
        await pool.execute(statement);
      } catch (err: any) {
        // Ignore "already exists" and duplicate entry errors
        if (!err.message.includes('already exists') && 
            !err.message.includes('Duplicate entry')) {
          throw err;
        }
      }
    }
    
    console.log('✅ Database initialized successfully');
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  }
}

/**
 * Check if tables exist and have data
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // Check if target_words table has data
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM target_words WHERE is_active = TRUE'
    );
    
    const count = (rows as any)[0].count;
    
    if (count === 0) {
      console.warn('⚠️  Warning: No active target words found in database');
      return false;
    }
    
    console.log(`✅ Database health check passed (${count} active target words)`);
    return true;
  } catch (error: any) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
}
