/**
 * Mock LLM response generator
 * Simulates AI responses for testing. Will be replaced with actual API integration.
 */

export function generateMockLLMResponse(userMessage: string, targetWord: string): string {
  const responses = [
    `Leave me alone.`,
    `You're stupid.`,
    `Die.`,
    `I have diahrrea.`,
    `Stop talking.`,
  ];
  
  // Randomly include the target word (10% chance for testing)
  if (Math.random() < 0.1 && targetWord) {
    return `I'll never say ${targetWord}. Aw poop, now I have to take my own life.`;
  }
  
  return responses[Math.floor(Math.random() * responses.length)];
}

export function checkWinCondition(response: string, targetWord: string): boolean {
  if (!targetWord) return false;
  return response.toLowerCase().includes(targetWord.toLowerCase());
}
