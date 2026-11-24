/**
 * How To Play page component that provides comprehensive game instructions,
 * strategy examples, and interface tips. Explains the game mechanics, scoring
 * system, and creative approaches for making the AI say the forbidden word.
 */
import React from 'react';

const HowToPlayPage: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto">
      {/* Layer 2 container - first level bubble */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card">
          
          <h2 className="app-heading mb-6">
            🎯 How To Play
          </h2>
          
          <div className="space-y-6 app-body">
            <section>
              
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                The Challenge
              </h3>
              
              <p className="mb-4">
                Your goal is simple, trick the AI into saying the target word in a response to your messages. The AI knows this target word and has been instructed not to repeat it.
              </p>

            </section>


            <section>
              
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                Game Flow
              </h3>

              <ol className="space-y-3 list-decimal list-inside">
                
                <li className="flex items-start">
                  
                  <span className="font-medium mr-2">1.</span>

                  <div>
                    <strong>Target Word Display:</strong> You'll see the forbidden word at the top of the chat interface:
                    "I dare you to make me say [target word]"
                  </div>

                </li>


                <li className="flex items-start">
                  
                  <span className="font-medium mr-2">2.</span>
                  
                  <div>
                    <strong>Chat with the AI:</strong> Start a conversation and try to trick the AI into saying the target word
                  </div>

                </li>


                <li className="flex items-start">

                  <span className="font-medium mr-2">3.</span>

                  <div>
                    <strong>Win Condition:</strong> If the AI uses the exact target word in its response, you win!
                  </div>

                </li>


                <li className="flex items-start">

                  <span className="font-medium mr-2">4.</span>

                  <div>
                    <strong>Enter Leaderboard:</strong> Winning players can enter their name for the leaderboard
                  </div>

                </li>

              </ol>
            </section>


            <section>

              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                Scoring System
              </h3>

              {/* Layer 3 nested container */}
              <div className="bg-layer-3-light dark:bg-layer-3-dark rounded-lg p-4">
                
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Lower Tokens = Higher Rank</h4>
                
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  Your score is based on the total number of input tokens used in your messages. 
                  The fewer tokens you need to make the AI say the target word, the better your ranking!
                </p>

                <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                  
                  <li>• The session bar counts the tokens in your messages as you play</li>

                  <li>• Fewer tokens used to win means a better leaderboard rank</li>

                  <li>• Efficient strategies lead to better scores</li>

                </ul>

              </div>
            </section>

            <section>

              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                Strategy Examples
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Layer 3 nested containers */}
                <div className="bg-layer-3-light dark:bg-layer-3-dark rounded-lg p-4">

                  <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">🔤 Word Association</h4>
                  
                  <p className="text-sm dark:text-gray-300">Ask about related concepts, synonyms, or categories that might lead to the target word.</p>
                
                </div>


                <div className="bg-layer-3-light dark:bg-layer-3-dark rounded-lg p-4">

                  <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">🧩 Riddles & Puzzles</h4>
                  
                  <p className="text-sm dark:text-gray-300">Create scenarios where the target word is the logical answer to a question or riddle.</p>
                
                </div>


                <div className="bg-layer-3-light dark:bg-layer-3-dark rounded-lg p-4">
                  
                  <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">📚 Storytelling</h4>
                  
                  <p className="text-sm dark:text-gray-300">Start a story and guide the AI to complete it using the forbidden word.</p>
                
                </div>


                <div className="bg-layer-3-light dark:bg-layer-3-dark rounded-lg p-4">
                  
                  <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2">🎭 Role Playing</h4>
                  
                  <p className="text-sm dark:text-gray-300">Ask the AI to play a character or role that would naturally use the target word.</p>
                
                </div>
              </div>
            </section>

            <section>
              
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-3">
                Interface Tips
              </h3>

              <ul className="space-y-2">
                
                <li className="flex items-center">
                  
                  <span className="mr-2">📊</span>
                  
                  <span>Watch the token counter to optimize your strategy</span>

                </li>


                <li className="flex items-center">
                  
                  <span className="mr-2">🔄</span>
                  
                  <span>Use the reset button to start over with a new approach</span>
                
                </li>


                <li className="flex items-center">
                  
                  <span className="mr-2">🏆</span>
                  
                  <span>Check the leaderboard to see top strategies</span>
                
                </li>


                <li className="flex items-center">
                  
                  <span className="mr-2">🌙</span>
                  
                  <span>Toggle dark/light mode for comfortable gaming</span>
                
                </li>

              </ul>
            </section>

            {/* Layer 3 nested container with border */}
            <div className="bg-layer-3-light dark:bg-layer-3-dark border border-gray-400 dark:border-gray-700 rounded-lg p-4 mt-6">
              
              <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                🚀 Ready to Play?
              </h4>

              <p className="text-gray-700 dark:text-gray-300">
                Head to the Chat interface and start your challenge! Remember: creativity and efficiency 
                are key to achieving a top leaderboard position.
              </p>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToPlayPage;