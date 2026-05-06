/**
 * Shared TypeScript types and interfaces used across multiple stores.
 */

/**
 * Represents a single chat message in the conversation.
 * 
 * TYPESCRIPT INTERFACE:
 * - Defines the contract/structure for message objects
 * - Used by both the store and components
 */
export interface ChatMessage {
  id: string;                      // Unique identifier for the message
  text: string;                    // The actual message content
  sender: 'user' | 'llm';         // Union type: must be one of these literal strings
  timestamp: number;               // When message was created (milliseconds since epoch)
  tokenCount?: number;             // Optional: number of tokens this message consumed
}

/**
 * Valid page names in the application.
 * 
 * TYPE ALIAS:
 * - Creates a reusable union type
 * - Better than repeating the union everywhere
 * - Easy to add new pages (just update here)
 */
export type PageType = 'chat' | 'leaderboard' | 'about' | 'howtoplay';
