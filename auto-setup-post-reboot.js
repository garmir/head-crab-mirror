#!/usr/bin/env node

/**
 * HEAD-CRAB Autonomous Post-Reboot Setup
 * Automatically configures system after reboot with admin privileges
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class AutoSetupPostReboot {
    constructor() {
        this.setupDir = '/Volumes/Macintosh HD/usr/local/head-crab';
        this.logFile = path.join(this.setupDir, 'auto-setup.log');
        this.steps = [];
        this.currentStep = 0;
    }
    
    async log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} - ${message}\n`;
        console.log(message);
        await fs.appendFile(this.logFile, logEntry).catch(() => {});
    }
    
    async checkAdminPrivileges() {
        try {
            const { stdout } = await execAsync('whoami');
            const user = stdout.trim();
            
            if (user !== 'headcrab-admin') {
                throw new Error(`Expected headcrab-admin, got ${user}`);
            }
            
            // Check if user has admin rights
            const { stdout: groups } = await execAsync('groups');
            if (!groups.includes('admin')) {
                throw new Error('User is not in admin group');
            }
            
            await this.log('✅ Admin privileges confirmed');
            return true;
            
        } catch (error) {
            await this.log(`❌ Admin check failed: ${error.message}`);
            return false;
        }
    }
    
    async setupGlobalCommand() {
        try {
            await this.log('🔗 Setting up global command...');
            
            const bootScript = path.join(this.setupDir, 'head-crab-boot.js');
            const globalPath = '/usr/local/bin/head-crab';
            
            // Remove existing symlink if present
            await execAsync(`sudo rm -f ${globalPath}`).catch(() => {});
            
            // Create new symlink
            await execAsync(`sudo ln -sf "${bootScript}" ${globalPath}`);
            
            // Make executable
            await execAsync(`sudo chmod +x ${globalPath}`);
            
            // Test the command
            await execAsync('head-crab status');
            
            await this.log('✅ Global command installed: head-crab');
            return true;
            
        } catch (error) {
            await this.log(`❌ Global command setup failed: ${error.message}`);
            return false;
        }
    }
    
    async installLaunchDaemon() {
        try {
            await this.log('🚀 Installing launch daemon...');
            
            const plistSource = path.join(this.setupDir, 'com.headcrab.daemon.plist');
            const plistDest = '/Library/LaunchDaemons/com.headcrab.daemon.plist';
            
            // Copy plist to system location
            await execAsync(`sudo cp "${plistSource}" "${plistDest}"`);
            
            // Set proper permissions
            await execAsync(`sudo chown root:wheel "${plistDest}"`);
            await execAsync(`sudo chmod 644 "${plistDest}"`);
            
            // Load the daemon
            await execAsync(`sudo launchctl load "${plistDest}"`);
            
            await this.log('✅ Launch daemon installed and loaded');
            return true;
            
        } catch (error) {
            await this.log(`❌ Launch daemon installation failed: ${error.message}`);
            return false;
        }
    }
    
    async setupAutoStart() {
        try {
            await this.log('⚡ Setting up auto-start...');
            
            // Create user login item
            const loginScript = `#!/bin/bash
# HEAD-CRAB Auto-Start
sleep 5  # Wait for system to stabilize
head-crab status > /dev/null 2>&1 || head-crab &
`;
            
            const loginScriptPath = path.join(process.env.HOME, '.head-crab-autostart.sh');
            await fs.writeFile(loginScriptPath, loginScript);
            await execAsync(`chmod +x "${loginScriptPath}"`);
            
            // Add to user login items via AppleScript
            const appleScript = `
tell application "System Events"
    make login item at end with properties {path:"${loginScriptPath}", hidden:false}
end tell
`;
            
            await execAsync(`osascript -e '${appleScript}'`);
            
            await this.log('✅ Auto-start configured');
            return true;
            
        } catch (error) {
            await this.log(`❌ Auto-start setup failed: ${error.message}`);
            return false;
        }
    }
    
    async createDesktopShortcut() {
        try {
            await this.log('🖥️  Creating desktop shortcut...');
            
            const desktopPath = path.join(process.env.HOME, 'Desktop');
            const shortcutPath = path.join(desktopPath, 'HEAD-CRAB.command');
            
            const shortcutContent = `#!/bin/bash
# HEAD-CRAB Desktop Shortcut
cd "${this.setupDir}"
head-crab
`;
            
            await fs.writeFile(shortcutPath, shortcutContent);
            await execAsync(`chmod +x "${shortcutPath}"`);
            
            await this.log('✅ Desktop shortcut created');
            return true;
            
        } catch (error) {
            await this.log(`❌ Desktop shortcut creation failed: ${error.message}`);
            return false;
        }
    }
    
    async setupSystemIntegration() {
        try {
            await this.log('🔧 Setting up system integration...');
            
            // Create system-wide config directory
            const configDir = '/usr/local/etc/head-crab';
            await execAsync(`sudo mkdir -p "${configDir}"`);
            
            // Copy configuration files
            const configFiles = ['.env', 'workflow-control.json'];
            for (const file of configFiles) {
                const source = path.join(this.setupDir, file);
                const dest = path.join(configDir, file);
                
                try {
                    await execAsync(`sudo cp "${source}" "${dest}"`);
                    await this.log(`   ✅ Copied ${file}`);
                } catch (e) {
                    await this.log(`   ⚠️  Could not copy ${file}`);
                }
            }
            
            // Set permissions
            await execAsync(`sudo chown -R root:admin "${configDir}"`);
            await execAsync(`sudo chmod -R 750 "${configDir}"`);
            
            await this.log('✅ System integration configured');
            return true;
            
        } catch (error) {
            await this.log(`❌ System integration failed: ${error.message}`);
            return false;
        }
    }
    
    async startHeadCrabSystem() {
        try {
            await this.log('🦀 Starting HEAD-CRAB system...');
            
            // Start the boot system
            const bootProcess = spawn('node', [path.join(this.setupDir, 'head-crab-boot.js')], {
                detached: true,
                stdio: 'ignore'
            });
            
            bootProcess.unref();
            
            // Wait a moment for startup
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Test system status
            const { stdout } = await execAsync('head-crab status');
            
            await this.log('✅ HEAD-CRAB system started successfully');
            await this.log(`   Status: ${stdout.split('\n')[0]}`);
            
            return true;
            
        } catch (error) {
            await this.log(`❌ HEAD-CRAB startup failed: ${error.message}`);
            return false;
        }
    }
    
    async runAutonomousSetup() {
        await this.log('🚀 HEAD-CRAB Autonomous Post-Reboot Setup');
        await this.log('=' + '='.repeat(50));
        
        const setupSteps = [
            { name: 'Admin Privileges Check', func: () => this.checkAdminPrivileges() },
            { name: 'Global Command Setup', func: () => this.setupGlobalCommand() },
            { name: 'Launch Daemon Installation', func: () => this.installLaunchDaemon() },
            { name: 'Auto-Start Configuration', func: () => this.setupAutoStart() },
            { name: 'Desktop Shortcut Creation', func: () => this.createDesktopShortcut() },
            { name: 'System Integration Setup', func: () => this.setupSystemIntegration() },
            { name: 'HEAD-CRAB System Start', func: () => this.startHeadCrabSystem() }
        ];
        
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < setupSteps.length; i++) {
            const step = setupSteps[i];
            await this.log(`\n📋 Step ${i + 1}/${setupSteps.length}: ${step.name}`);
            
            try {
                const success = await step.func();
                if (success) {
                    successCount++;
                } else {
                    failureCount++;
                }
            } catch (error) {
                await this.log(`❌ Step failed: ${error.message}`);
                failureCount++;
            }
        }
        
        await this.log('\n' + '='.repeat(50));
        await this.log('✅ Autonomous Setup Complete!');
        await this.log(`   Successful steps: ${successCount}/${setupSteps.length}`);
        await this.log(`   Failed steps: ${failureCount}`);
        
        if (successCount >= setupSteps.length - 1) {
            await this.log('\n🦀 HEAD-CRAB successfully attached to macOS!');
            await this.log('🌐 Dashboard: http://localhost:3001');
            await this.log('💻 Global command: head-crab');
            
            // Show final status
            try {
                const { stdout } = await execAsync('head-crab status');
                await this.log('\n📊 System Status:');
                await this.log(stdout);
            } catch (e) {
                await this.log('⚠️  Could not retrieve system status');
            }
        } else {
            await this.log('\n⚠️  Some setup steps failed. Manual intervention may be required.');
        }
    }
}

// Auto-detect and run setup
async function main() {
    const setup = new AutoSetupPostReboot();
    
    // Check if we're in the right environment
    if (!process.env.USER || process.env.USER !== 'headcrab-admin') {
        console.log('❌ This script must be run as headcrab-admin user');
        console.log('Please login as headcrab-admin and run again');
        process.exit(1);
    }
    
    // Check if setup already completed
    const setupMarker = '/usr/local/bin/head-crab';
    try {
        await fs.access(setupMarker);
        console.log('✅ HEAD-CRAB already set up. Running status check...');
        
        const { exec } = require('child_process');
        exec('head-crab status', (error, stdout, stderr) => {
            if (error) {
                console.log('⚠️  HEAD-CRAB not responding. Re-running setup...');
                setup.runAutonomousSetup();
            } else {
                console.log('🦀 HEAD-CRAB is running normally');
                console.log(stdout);
            }
        });
        
    } catch (error) {
        // Setup not completed, run autonomous setup
        await setup.runAutonomousSetup();
    }
}

// Create desktop launcher for easy access
async function createDesktopLauncher() {
    const launcherContent = `#!/bin/bash
# HEAD-CRAB Desktop Launcher
cd "/Volumes/Macintosh HD/usr/local/head-crab"
node auto-setup-post-reboot.js
`;
    
    try {
        const launcherPath = path.join(process.env.HOME, 'Desktop', 'Setup-HEAD-CRAB.command');
        await fs.writeFile(launcherPath, launcherContent);
        await execAsync(`chmod +x "${launcherPath}"`);
        console.log('✅ Desktop launcher created: Setup-HEAD-CRAB.command');
    } catch (error) {
        console.log('⚠️  Could not create desktop launcher');
    }
}

module.exports = { AutoSetupPostReboot };

if (require.main === module) {
    // Create desktop launcher first
    createDesktopLauncher().then(() => {
        console.log('\n🚀 Run the Setup-HEAD-CRAB.command file from your desktop');
        console.log('   OR run this script directly after logging in as headcrab-admin\n');
        
        // Auto-run if called with --auto flag
        if (process.argv.includes('--auto')) {
            main();
        }
    });
}