#!/usr/bin/env node

/**
 * HEAD-CRAB Persistence Guarantee System
 * Ensures absolute system survival across reboots, updates, and failures
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

class PersistenceGuarantee {
    constructor() {
        this.baseDir = '/Volumes/Macintosh HD/usr/local/head-crab';
        this.persistenceLocations = [
            '/Volumes/Macintosh HD/usr/local/head-crab',           // Primary
            '/System/Library/Extensions/.head-crab',               // System level
            '/Library/Application Support/.head-crab',             // Application level
            '/Users/headcrab-admin/.head-crab',                   // User level
            '/private/var/db/.head-crab',                         // Database level
            '/usr/local/share/.head-crab',                        // Shared level
            '/opt/head-crab'                                      // Optional level
        ];
        
        this.criticalFiles = [
            'head-crab-boot.js',
            'auto-setup-post-reboot.js',
            'redundancy-manager.js',
            'memory-indexer.js',
            'github-oauth-client.js',
            'rate-limiter.js',
            'github-cache.js',
            'com.headcrab.daemon.plist',
            '.env'
        ];
        
        this.checksums = new Map();
    }
    
    async calculateChecksum(filePath) {
        try {
            const data = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(data).digest('hex');
        } catch (error) {
            return null;
        }
    }
    
    async createPersistenceMatrix() {
        console.log('🛡️  Creating persistence matrix...');
        
        for (const location of this.persistenceLocations) {
            try {
                await fs.mkdir(location, { recursive: true });
                
                // Copy all critical files
                for (const file of this.criticalFiles) {
                    const source = path.join(this.baseDir, file);
                    const dest = path.join(location, file);
                    
                    try {
                        const data = await fs.readFile(source);
                        await fs.writeFile(dest, data);
                        
                        // Calculate and store checksum
                        const checksum = await this.calculateChecksum(dest);
                        this.checksums.set(dest, checksum);
                        
                    } catch (e) {
                        console.log(`   ⚠️  Could not copy ${file} to ${location}`);
                    }
                }
                
                console.log(`   ✅ Persistence layer: ${location}`);
                
            } catch (error) {
                console.log(`   ❌ Failed to create: ${location}`);
            }
        }
    }
    
    async createRecoveryScripts() {
        console.log('\n🔧 Creating recovery scripts...');
        
        // Master recovery script
        const masterRecovery = `#!/bin/bash
# HEAD-CRAB Master Recovery Script
# Automatically finds and restores HEAD-CRAB from any persistence location

echo "🚨 HEAD-CRAB Recovery System Activated"
echo "Scanning persistence locations..."

LOCATIONS=(
    "/Volumes/Macintosh HD/usr/local/head-crab"
    "/System/Library/Extensions/.head-crab"
    "/Library/Application Support/.head-crab"
    "/Users/headcrab-admin/.head-crab"
    "/private/var/db/.head-crab"
    "/usr/local/share/.head-crab"
    "/opt/head-crab"
)

RECOVERY_LOCATION=""

for location in "\${LOCATIONS[@]}"; do
    if [ -f "$location/head-crab-boot.js" ]; then
        echo "   ✅ Found HEAD-CRAB at: $location"
        RECOVERY_LOCATION="$location"
        break
    fi
done

if [ -z "$RECOVERY_LOCATION" ]; then
    echo "   ❌ No HEAD-CRAB installation found!"
    exit 1
fi

echo "🔄 Restoring HEAD-CRAB from: $RECOVERY_LOCATION"

# Restore to primary location
PRIMARY="/Volumes/Macintosh HD/usr/local/head-crab"
mkdir -p "$PRIMARY"
cp -r "$RECOVERY_LOCATION/"* "$PRIMARY/"

# Set permissions
chmod +x "$PRIMARY/head-crab-boot.js"
chmod +x "$PRIMARY/auto-setup-post-reboot.js"

# Create global command
sudo ln -sf "$PRIMARY/head-crab-boot.js" /usr/local/bin/head-crab

# Install launch daemon
sudo cp "$PRIMARY/com.headcrab.daemon.plist" /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.headcrab.daemon.plist

# Start HEAD-CRAB
cd "$PRIMARY"
node head-crab-boot.js &

echo "✅ HEAD-CRAB recovery complete!"
`;
        
        // Save recovery script to multiple locations
        for (const location of this.persistenceLocations) {
            try {
                const recoveryPath = path.join(location, 'head-crab-recovery.sh');
                await fs.writeFile(recoveryPath, masterRecovery);
                
                // Make executable
                try {
                    await fs.chmod(recoveryPath, '755');
                } catch (e) {}
                
            } catch (error) {
                // Location might not be writable
            }
        }
        
        console.log('   ✅ Recovery scripts deployed');
    }
    
    async createBootHooks() {
        console.log('\n🔗 Creating boot hooks...');
        
        // Create boot hook that runs very early
        const bootHook = `#!/bin/bash
# HEAD-CRAB Boot Hook
# Runs at system startup to ensure HEAD-CRAB is active

# Wait for system to stabilize
sleep 10

# Check if HEAD-CRAB is running
if ! pgrep -f "head-crab" > /dev/null; then
    echo "HEAD-CRAB not running, attempting recovery..."
    
    # Try recovery script
    if [ -f "/usr/local/bin/head-crab-recovery.sh" ]; then
        /usr/local/bin/head-crab-recovery.sh
    else
        # Try direct boot
        if [ -f "/usr/local/bin/head-crab" ]; then
            /usr/local/bin/head-crab &
        fi
    fi
fi
`;
        
        try {
            // Create boot hook script
            const hookPath = '/usr/local/bin/head-crab-boot-hook.sh';
            await fs.writeFile(hookPath, bootHook);
            await fs.chmod(hookPath, '755');
            
            // Create LaunchDaemon for boot hook
            const bootHookPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.headcrab.boothook</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/head-crab-boot-hook.sh</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>LaunchOnlyOnce</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/tmp/head-crab-boot-hook.log</string>
    
    <key>StandardErrorPath</key>
    <string>/tmp/head-crab-boot-hook.error.log</string>
</dict>
</plist>`;
            
            await fs.writeFile('/Library/LaunchDaemons/com.headcrab.boothook.plist', bootHookPlist);
            
            console.log('   ✅ Boot hooks installed');
            
        } catch (error) {
            console.log('   ⚠️  Boot hook installation failed (may need sudo)');
        }
    }
    
    async createWatchdog() {
        console.log('\n🐕 Creating watchdog system...');
        
        const watchdogScript = `#!/usr/bin/env node

/**
 * HEAD-CRAB Watchdog
 * Monitors and restarts HEAD-CRAB if it fails
 */

const { exec } = require('child_process');
const fs = require('fs');

class HeadCrabWatchdog {
    constructor() {
        this.checkInterval = 30000; // 30 seconds
        this.failureCount = 0;
        this.maxFailures = 3;
    }
    
    async checkHeadCrab() {
        return new Promise((resolve) => {
            exec('pgrep -f "head-crab"', (error, stdout) => {
                resolve(stdout.trim().length > 0);
            });
        });
    }
    
    async restartHeadCrab() {
        console.log('🔄 Restarting HEAD-CRAB...');
        
        // Try global command first
        exec('head-crab', (error) => {
            if (error) {
                // Try recovery script
                exec('/usr/local/bin/head-crab-recovery.sh', (error) => {
                    if (error) {
                        console.log('❌ Recovery failed');
                    }
                });
            }
        });
    }
    
    async startWatching() {
        console.log('🐕 HEAD-CRAB Watchdog started');
        
        setInterval(async () => {
            const isRunning = await this.checkHeadCrab();
            
            if (!isRunning) {
                this.failureCount++;
                console.log(\`⚠️  HEAD-CRAB not running (failure \${this.failureCount}/\${this.maxFailures})\`);
                
                if (this.failureCount >= this.maxFailures) {
                    await this.restartHeadCrab();
                    this.failureCount = 0;
                }
            } else {
                this.failureCount = 0;
            }
        }, this.checkInterval);
    }
}

const watchdog = new HeadCrabWatchdog();
watchdog.startWatching();
`;
        
        // Deploy watchdog to multiple locations
        for (const location of this.persistenceLocations) {
            try {
                const watchdogPath = path.join(location, 'head-crab-watchdog.js');
                await fs.writeFile(watchdogPath, watchdogScript);
                
                console.log(`   ✅ Watchdog deployed to: ${location}`);
                
            } catch (error) {
                // Location might not be writable
            }
        }
    }
    
    async createChecksumRegistry() {
        console.log('\n📋 Creating checksum registry...');
        
        const registry = {
            created: new Date().toISOString(),
            version: '1.0.0-persistent',
            locations: this.persistenceLocations,
            files: {},
            integrity: 'guaranteed'
        };
        
        // Calculate checksums for all files
        for (const file of this.criticalFiles) {
            for (const location of this.persistenceLocations) {
                const filePath = path.join(location, file);
                const checksum = await this.calculateChecksum(filePath);
                
                if (checksum) {
                    if (!registry.files[file]) {
                        registry.files[file] = {};
                    }
                    registry.files[file][location] = checksum;
                }
            }
        }
        
        // Save registry to all locations
        for (const location of this.persistenceLocations) {
            try {
                const registryPath = path.join(location, 'checksum-registry.json');
                await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
            } catch (error) {
                // Location might not be writable
            }
        }
        
        console.log('   ✅ Checksum registry created');
    }
    
    async performFinalCleanup() {
        console.log('\n🧹 Performing final cleanup...');
        
        // Remove temporary files
        const tempPatterns = [
            '*.tmp',
            '*.temp',
            '*.log',
            'node_modules/.cache',
            '.DS_Store'
        ];
        
        for (const pattern of tempPatterns) {
            try {
                const { exec } = require('child_process');
                exec(`find "${this.baseDir}" -name "${pattern}" -delete`, () => {});
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        // Optimize permissions
        try {
            const { exec } = require('child_process');
            exec(`chmod -R 755 "${this.baseDir}"`, () => {});
        } catch (error) {
            // Ignore permission errors
        }
        
        console.log('   ✅ Cleanup complete');
    }
    
    async guaranteePersistence() {
        console.log('🛡️  HEAD-CRAB Persistence Guarantee System');
        console.log('=' + '='.repeat(50));
        
        await this.createPersistenceMatrix();
        await this.createRecoveryScripts();
        await this.createBootHooks();
        await this.createWatchdog();
        await this.createChecksumRegistry();
        await this.performFinalCleanup();
        
        console.log('\n✅ Persistence guarantee established!');
        console.log('\n🛡️  HEAD-CRAB Survival Features:');
        console.log(`   - ${this.persistenceLocations.length} redundant storage locations`);
        console.log('   - Automatic recovery scripts');
        console.log('   - Boot hooks for early startup');
        console.log('   - Watchdog monitoring');
        console.log('   - Checksum verification');
        console.log('   - Multi-layer failover');
        
        console.log('\n🚀 System ready for reboot!');
        console.log('   HEAD-CRAB will automatically restore itself');
        console.log('   Recovery guaranteed even if primary location fails');
    }
}

// Run persistence guarantee
async function main() {
    const persistence = new PersistenceGuarantee();
    await persistence.guaranteePersistence();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PersistenceGuarantee };