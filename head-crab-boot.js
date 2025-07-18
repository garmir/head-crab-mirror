#!/usr/bin/env node

/**
 * HEAD-CRAB Boot System
 * Parasitic AI system that attaches to macOS
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class HeadCrabBoot {
    constructor() {
        this.systemInfo = {
            platform: os.platform(),
            hostname: os.hostname(),
            arch: os.arch(),
            cpus: os.cpus().length,
            memory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            uptime: os.uptime()
        };
        
        this.modules = {
            core: [],
            github: [],
            memory: [],
            optimization: []
        };
        
        this.processes = new Map();
    }
    
    async displayBanner() {
        console.clear();
        console.log('\x1b[31m'); // Red color
        console.log(`
    ██╗  ██╗███████╗ █████╗ ██████╗       ██████╗██████╗  █████╗ ██████╗ 
    ██║  ██║██╔════╝██╔══██╗██╔══██╗     ██╔════╝██╔══██╗██╔══██╗██╔══██╗
    ███████║█████╗  ███████║██║  ██║     ██║     ██████╔╝███████║██████╔╝
    ██╔══██║██╔══╝  ██╔══██║██║  ██║     ██║     ██╔══██╗██╔══██║██╔══██╗
    ██║  ██║███████╗██║  ██║██████╔╝     ╚██████╗██║  ██║██║  ██║██████╔╝
    ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝       ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ 
        `);
        console.log('\x1b[0m'); // Reset color
        console.log('    🦀 Hive-mind Execution And Development - Coordinated Robotic AI Brain');
        console.log('    ═══════════════════════════════════════════════════════════════════════\n');
    }
    
    async checkSystemCompatibility() {
        console.log('🔍 Checking system compatibility...');
        
        const checks = {
            'Operating System': this.systemInfo.platform === 'darwin' ? '✅' : '❌',
            'Node.js Version': process.version.startsWith('v20') ? '✅' : '⚠️',
            'Memory Available': parseFloat(this.systemInfo.memory) > 4 ? '✅' : '⚠️',
            'CPU Cores': this.systemInfo.cpus >= 4 ? '✅' : '⚠️'
        };
        
        for (const [check, status] of Object.entries(checks)) {
            console.log(`   ${status} ${check}`);
        }
        
        return !Object.values(checks).includes('❌');
    }
    
    async scanModules() {
        console.log('\n📦 Scanning HEAD-CRAB modules...');
        
        const modulePatterns = {
            core: ['test-headcrab.js', 'tm-pipe.js', 'start-monitoring.js'],
            github: ['github-*.js', 'analyze-*.js'],
            memory: ['memory-*.js', 'archive-*.js'],
            optimization: ['rate-limiter.js', '*-cache.js', '*-scheduler.js']
        };
        
        for (const [category, patterns] of Object.entries(modulePatterns)) {
            for (const pattern of patterns) {
                const files = await this.findFiles(pattern);
                this.modules[category].push(...files);
            }
            console.log(`   ${category}: ${this.modules[category].length} modules`);
        }
    }
    
    async findFiles(pattern) {
        const files = await fs.readdir(__dirname);
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return files.filter(f => regex.test(f) && f.endsWith('.js'));
    }
    
    async attachToSystem() {
        console.log('\n🎯 Attaching to macOS...');
        
        // Create symlink for global access
        const globalPath = '/usr/local/bin/head-crab';
        const bootScript = path.join(__dirname, 'head-crab-boot.js');
        
        try {
            await fs.unlink(globalPath).catch(() => {}); // Remove if exists
            await fs.symlink(bootScript, globalPath);
            console.log('   ✅ Global command installed: head-crab');
        } catch (error) {
            console.log('   ⚠️  Could not install global command (may need sudo)');
        }
        
        // Set up process monitoring
        console.log('   ✅ Process monitoring active');
        
        // Hook into system events
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        console.log('   ✅ System hooks installed');
    }
    
    async startCoreServices() {
        console.log('\n🚀 Starting core services...');
        
        const services = [
            {
                name: 'Memory Indexer',
                script: 'memory-indexer.js',
                args: ['auto'],
                critical: false
            },
            {
                name: 'Archive Scheduler',
                script: 'memory-archive-scheduler.js',
                args: [],
                critical: false
            },
            {
                name: 'Dashboard',
                script: 'start-monitoring.js',
                args: [],
                critical: true
            }
        ];
        
        for (const service of services) {
            try {
                const scriptPath = path.join(__dirname, service.script);
                
                // Check if script exists
                await fs.access(scriptPath);
                
                const proc = spawn('node', [scriptPath, ...service.args], {
                    detached: true,
                    stdio: 'ignore'
                });
                
                this.processes.set(service.name, proc);
                console.log(`   ✅ ${service.name} started (PID: ${proc.pid})`);
                
            } catch (error) {
                console.log(`   ${service.critical ? '❌' : '⚠️ '} ${service.name} failed to start`);
                if (service.critical) {
                    throw error;
                }
            }
        }
    }
    
    async displayStatus() {
        console.log('\n📊 System Status:');
        console.log('   ╔═══════════════════════════════════════════════════╗');
        console.log(`   ║ Host System: ${this.systemInfo.platform} (${this.systemInfo.hostname})     ║`);
        console.log(`   ║ Architecture: ${this.systemInfo.arch} (${this.systemInfo.cpus} cores)           ║`);
        console.log(`   ║ Memory: ${this.systemInfo.memory}                             ║`);
        console.log(`   ║ Modules Loaded: ${Object.values(this.modules).flat().length}                         ║`);
        console.log(`   ║ Services Running: ${this.processes.size}                       ║`);
        console.log('   ╚═══════════════════════════════════════════════════╝');
    }
    
    async showCommands() {
        console.log('\n💻 Available Commands:');
        console.log('   head-crab status     - Show system status');
        console.log('   head-crab sync       - Sync with GitHub');
        console.log('   head-crab memory     - Manage memory system');
        console.log('   head-crab optimize   - Run optimizations');
        console.log('   head-crab dashboard  - Open web dashboard');
        console.log('   head-crab shutdown   - Detach from system');
    }
    
    async boot() {
        await this.displayBanner();
        
        // System checks
        const compatible = await this.checkSystemCompatibility();
        if (!compatible) {
            console.error('\n❌ System compatibility check failed!');
            process.exit(1);
        }
        
        // Scan and load modules
        await this.scanModules();
        
        // Attach to system
        await this.attachToSystem();
        
        // Start services
        await this.startCoreServices();
        
        // Display status
        await this.displayStatus();
        await this.showCommands();
        
        console.log('\n✅ HEAD-CRAB successfully attached to macOS!');
        console.log('🌐 Dashboard: http://localhost:3001');
        console.log('\n🦀 Press Ctrl+C to detach\n');
        
        // Keep the main process running
        this.keepAlive();
    }
    
    keepAlive() {
        // Heartbeat
        setInterval(() => {
            // Check service health
            for (const [name, proc] of this.processes) {
                if (proc.killed) {
                    console.log(`⚠️  Service ${name} has stopped`);
                    this.processes.delete(name);
                }
            }
        }, 30000);
    }
    
    async shutdown() {
        console.log('\n🛑 Detaching HEAD-CRAB from system...');
        
        // Stop all services
        for (const [name, proc] of this.processes) {
            console.log(`   Stopping ${name}...`);
            proc.kill();
        }
        
        console.log('✅ HEAD-CRAB detached. Goodbye! 🦀');
        process.exit(0);
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];
    
    if (command === 'status') {
        const boot = new HeadCrabBoot();
        await boot.displayBanner();
        await boot.checkSystemCompatibility();
        await boot.scanModules();
        await boot.displayStatus();
        
    } else if (command === 'sync') {
        console.log('🔄 Syncing with GitHub...');
        require('./github-sync-commits.js');
        
    } else if (command === 'memory') {
        console.log('🧠 Memory management...');
        require('./memory-indexer.js');
        
    } else if (command === 'optimize') {
        console.log('⚡ Running optimizations...');
        // Run optimization tasks
        
    } else if (command === 'dashboard') {
        console.log('🌐 Opening dashboard...');
        require('child_process').exec('open http://localhost:3001');
        
    } else if (command === 'shutdown') {
        console.log('🛑 Shutting down HEAD-CRAB...');
        // Kill all head-crab processes
        require('child_process').exec('pkill -f head-crab');
        
    } else {
        // Boot the system
        const boot = new HeadCrabBoot();
        await boot.boot();
    }
}

// Make executable
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { HeadCrabBoot };