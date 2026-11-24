/**
 * About page component that displays project information, tech stack details,
 * feature overview, and gameplay instructions. Provides context about the
 * "Don't Make Me Say" game and its implementation.
 */
import React from 'react';

const AboutPage: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto">
      {/* Layer 2 container - first level bubble */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card">
          
          <h2 className="app-heading mb-4">
            ℹ️ About Don't Make Me Say
          </h2>
          
          <div className="space-y-6 app-body">
            <section>

              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">
                Tech Stack
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Layer 3 nested containers */}
                <div className="card-inner">

                  <h4 className="app-label">Frontend</h4>

                  <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                    <li>• React with TypeScript</li>
                    <li>• Tailwind CSS</li>
                    <li>• Framer Motion</li>
                    <li>• Zustand (State Management)</li>
                  </ul>

                </div>


                <div className="card-inner">
                  
                  <h4 className="app-label">Backend</h4>
                  
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                    <li>• Node.js, Express, and TypeScript</li>
                    <li>• MySQL</li>
                    <li>• Model calls stay on the server</li>
                  </ul>

                </div>

              </div>

            </section>


            <section>
              
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">
                Features
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                
                <ul className="space-y-1">
                  <li>• 🌙 Dark/Light mode</li>
                  <li>• 📱 Mobile responsive</li>
                  <li>• 🔒 Passphrase gate</li>
                  <li>• ⚡ Real-time chat</li>
                </ul>

                <ul className="space-y-1">
                  <li>• 📊 Token tracking</li>
                  <li>• 🏆 Live leaderboard</li>
                  <li>• 🎯 Strategic gameplay</li>
                  <li>• 💾 Session persistence</li>
                </ul>

              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;