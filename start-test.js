import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const processes = [];

console.log('========================================');
console.log('Starting "Don\'t Make Me Say" - Test Mode');
console.log('========================================\n');

// Check and install dependencies
async function checkDependencies(dir, name) {
    const nodeModulesPath = join(__dirname, dir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log(`Installing ${name} dependencies...`);
        await new Promise((resolve, reject) => {
            const install = spawn('npm', ['install'], {
                cwd: join(__dirname, dir),
                shell: true,
                stdio: 'inherit'
            });
            install.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`npm install failed in ${dir}`));
            });
        });
        console.log('');
    }
}

async function startServers() {
    try {
        // Check dependencies
        await checkDependencies('backend', 'backend');
        await checkDependencies('frontend', 'frontend');

        // Start backend
        console.log('Starting backend server...');
        const backend = spawn('npm', ['run', 'dev'], {
            cwd: join(__dirname, 'backend'),
            shell: true,
            stdio: 'inherit'
        });
        processes.push(backend);

        // Wait a bit for backend to start
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Start frontend
        console.log('Starting frontend development server...');
        const frontend = spawn('npm', ['start'], {
            cwd: join(__dirname, 'frontend'),
            shell: true,
            stdio: 'inherit'
        });
        processes.push(frontend);

        console.log('\n========================================');
        console.log('Both servers are starting...');
        console.log('Backend: http://localhost:3001');
        console.log('Frontend: http://localhost:3000');
        console.log('========================================');
        console.log('\nPress Ctrl+C to stop all servers\n');

    } catch (error) {
        console.error('Error starting servers:', error.message);
        cleanup();
    }
}

function cleanup() {
    console.log('\nStopping servers...');
    processes.forEach(proc => {
        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', proc.pid, '/f', '/t'], { shell: true });
            } else {
                proc.kill('SIGTERM');
            }
        } catch (e) {
            // Ignore errors during cleanup
        }
    });
    console.log('Servers stopped.');
    process.exit(0);
}

// Handle termination signals
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

// Start the servers
startServers();
