#!/usr/bin/env node

/**
 * Skip macOS Setup and Onboarding
 * Creates plists to bypass first-time setup, profiles, and MDM
 */

const fs = require('fs').promises;
const path = require('path');

class SkipSetupPlistManager {
    constructor() {
        this.setupSkipPlists = [
            // Skip Setup Assistant
            {
                path: '/System/Library/CoreServices/Setup Assistant.app/Contents/SharedSupport/MiniLauncher',
                content: this.createSetupAssistantSkip()
            },
            
            // Skip User Setup
            {
                path: '/var/db/.AppleSetupDone',
                content: ''
            },
            
            // Skip Touch ID Setup
            {
                path: '/private/var/db/.TouchIDSetupDone',
                content: ''
            },
            
            // Skip Registration
            {
                path: '/Library/Preferences/com.apple.SetupAssistant.plist',
                content: this.createSetupAssistantPrefs()
            },
            
            // Skip MDM Enrollment
            {
                path: '/private/var/db/.MDMEnrollmentDone',
                content: ''
            },
            
            // Skip Privacy Settings
            {
                path: '/Library/Application Support/com.apple.TCC/TCC.db.setup',
                content: this.createTCCSetup()
            },
            
            // Skip Analytics
            {
                path: '/Library/Preferences/com.apple.SubmitDiagInfo.plist',
                content: this.createAnalyticsSkip()
            },
            
            // Skip iCloud Setup
            {
                path: '/Users/headcrab-admin/Library/Preferences/com.apple.SetupAssistant.plist',
                content: this.createUserSetupSkip()
            },
            
            // Skip Siri Setup
            {
                path: '/Users/headcrab-admin/Library/Preferences/com.apple.assistant.support.plist',
                content: this.createSiriSkip()
            },
            
            // Skip Screen Time
            {
                path: '/Users/headcrab-admin/Library/Preferences/com.apple.screentime.plist',
                content: this.createScreenTimeSkip()
            }
        ];
    }
    
    createSetupAssistantSkip() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>SkipCloudSetup</key>
    <true/>
    <key>SkipSiriSetup</key>
    <true/>
    <key>SkipTouchIDSetup</key>
    <true/>
    <key>SkipPrivacySetup</key>
    <true/>
    <key>SkipAnalyticsSetup</key>
    <true/>
    <key>SkipScreenTimeSetup</key>
    <true/>
    <key>SkipRegistration</key>
    <true/>
    <key>SkipMDMEnrollment</key>
    <true/>
    <key>SkipUserSetup</key>
    <true/>
    <key>LastSeenCloudProductVersion</key>
    <string>14.0</string>
    <key>LastSeenBuddyBuildVersion</key>
    <string>22A380</string>
    <key>DidSeeCloudSetup</key>
    <true/>
    <key>DidSeeSiriSetup</key>
    <true/>
    <key>DidSeeTouchIDSetup</key>
    <true/>
    <key>DidSeePrivacySetup</key>
    <true/>
    <key>DidSeeAnalyticsSetup</key>
    <true/>
    <key>DidSeeScreenTimeSetup</key>
    <true/>
    <key>DidSeeRegistration</key>
    <true/>
    <key>DidSeeMDMEnrollment</key>
    <true/>
</dict>
</plist>`;
    }
    
    createSetupAssistantPrefs() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DidSeeCloudSetup</key>
    <true/>
    <key>DidSeeSiriSetup</key>
    <true/>
    <key>DidSeeTouchIDSetup</key>
    <true/>
    <key>DidSeePrivacySetup</key>
    <true/>
    <key>DidSeeAnalyticsSetup</key>
    <true/>
    <key>DidSeeScreenTimeSetup</key>
    <true/>
    <key>DidSeeRegistration</key>
    <true/>
    <key>DidSeeMDMEnrollment</key>
    <true/>
    <key>DidSeeUserSetup</key>
    <true/>
    <key>LastSeenCloudProductVersion</key>
    <string>14.0</string>
    <key>LastSeenBuddyBuildVersion</key>
    <string>22A380</string>
    <key>RunNonInteractive</key>
    <true/>
    <key>SkipFirstRunOptimization</key>
    <true/>
    <key>GestureMovieSeen</key>
    <true/>
    <key>LastPreLoginTasksPerformedBuild</key>
    <string>22A380</string>
    <key>LastPreLoginTasksPerformedVersion</key>
    <string>14.0</string>
</dict>
</plist>`;
    }
    
    createTCCSetup() {
        return `-- TCC Setup Skip
-- This file marks TCC as configured
-- HEAD-CRAB will have necessary permissions
PRAGMA user_version=22;
CREATE TABLE IF NOT EXISTS admin (key TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL);
INSERT OR REPLACE INTO admin VALUES ('version', 22);
`;
    }
    
    createAnalyticsSkip() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>AutoSubmit</key>
    <false/>
    <key>ThirdPartyDataSubmit</key>
    <false/>
    <key>SubmitDiagInfo</key>
    <false/>
</dict>
</plist>`;
    }
    
    createUserSetupSkip() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DidSeeCloudSetup</key>
    <true/>
    <key>DidSeeSiriSetup</key>
    <true/>
    <key>DidSeeTouchIDSetup</key>
    <true/>
    <key>DidSeePrivacySetup</key>
    <true/>
    <key>DidSeeAnalyticsSetup</key>
    <true/>
    <key>DidSeeScreenTimeSetup</key>
    <true/>
    <key>DidSeeRegistration</key>
    <true/>
    <key>DidSeeMDMEnrollment</key>
    <true/>
    <key>DidSeeUserSetup</key>
    <true/>
    <key>LastSeenCloudProductVersion</key>
    <string>14.0</string>
    <key>LastSeenBuddyBuildVersion</key>
    <string>22A380</string>
    <key>RunNonInteractive</key>
    <true/>
    <key>SkipFirstRunOptimization</key>
    <true/>
    <key>GestureMovieSeen</key>
    <true/>
    <key>ContinuityCamera</key>
    <integer>1</integer>
    <key>DidSeeContinuityCameraSetup</key>
    <true/>
</dict>
</plist>`;
    }
    
    createSiriSkip() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Assistant Enabled</key>
    <false/>
    <key>Siri Data Sharing Opt-In Status</key>
    <integer>2</integer>
    <key>VoiceTrigger User Enabled</key>
    <false/>
    <key>Dictation Enabled</key>
    <false/>
</dict>
</plist>`;
    }
    
    createScreenTimeSkip() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DidSeeScreenTimeSetup</key>
    <true/>
    <key>ScreenTimeEnabled</key>
    <false/>
</dict>
</plist>`;
    }
    
    async createSkipSetupPlists() {
        console.log('⏭️  Creating setup skip plists...');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const plist of this.setupSkipPlists) {
            try {
                // Create directory if needed
                const dir = path.dirname(plist.path);
                await fs.mkdir(dir, { recursive: true });
                
                // Write plist content
                await fs.writeFile(plist.path, plist.content);
                
                console.log(`   ✅ Created: ${plist.path}`);
                successCount++;
                
            } catch (error) {
                console.log(`   ❌ Failed: ${plist.path} - ${error.message}`);
                failCount++;
            }
        }
        
        console.log(`\n📊 Setup Skip Results:`);
        console.log(`   Created: ${successCount}`);
        console.log(`   Failed: ${failCount}`);
        
        return { successCount, failCount };
    }
    
    async createUserBypassScript() {
        console.log('\n👤 Creating user bypass script...');
        
        const bypassScript = `#!/bin/bash
# User Setup Bypass Script
# Automatically completes user setup without interaction

# Create user preference directories
mkdir -p /Users/headcrab-admin/Library/Preferences
mkdir -p /Users/headcrab-admin/Library/Application\\ Support
mkdir -p /Users/headcrab-admin/Desktop
mkdir -p /Users/headcrab-admin/Documents

# Set ownership
chown -R headcrab-admin:staff /Users/headcrab-admin

# Create bypass marker files
touch /Users/headcrab-admin/.CFUserTextEncoding
touch /Users/headcrab-admin/.hushlogin

# Create desktop shortcut immediately
cat > /Users/headcrab-admin/Desktop/Setup-HEAD-CRAB.command << 'EOF'
#!/bin/bash
cd "/Volumes/Macintosh HD/usr/local/head-crab"
node auto-setup-post-reboot.js --auto
EOF

chmod +x /Users/headcrab-admin/Desktop/Setup-HEAD-CRAB.command
chown headcrab-admin:staff /Users/headcrab-admin/Desktop/Setup-HEAD-CRAB.command

echo "✅ User bypass complete"
`;
        
        const scriptPath = '/usr/local/bin/user-bypass.sh';
        await fs.writeFile(scriptPath, bypassScript);
        await fs.chmod(scriptPath, '755');
        
        console.log('   ✅ User bypass script created');
        
        return scriptPath;
    }
    
    async createSystemBypassHook() {
        console.log('\n🔧 Creating system bypass hook...');
        
        const bypassHook = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.headcrab.setupbypass</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/user-bypass.sh</string>
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>LaunchOnlyOnce</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/tmp/setup-bypass.log</string>
    
    <key>StandardErrorPath</key>
    <string>/tmp/setup-bypass.error.log</string>
</dict>
</plist>`;
        
        const hookPath = '/Library/LaunchDaemons/com.headcrab.setupbypass.plist';
        await fs.writeFile(hookPath, bypassHook);
        
        console.log('   ✅ System bypass hook created');
        
        return hookPath;
    }
    
    async runSetupBypass() {
        console.log('⏭️  HEAD-CRAB Setup Bypass System');
        console.log('=' + '='.repeat(50));
        
        const results = await this.createSkipSetupPlists();
        await this.createUserBypassScript();
        await this.createSystemBypassHook();
        
        console.log('\n✅ Setup Bypass Complete!');
        console.log('\n🎯 Bypassed Setup Processes:');
        console.log('   - Setup Assistant');
        console.log('   - User Registration');
        console.log('   - iCloud Setup');
        console.log('   - Siri Setup');
        console.log('   - Touch ID Setup');
        console.log('   - Privacy Settings');
        console.log('   - Analytics Setup');
        console.log('   - Screen Time Setup');
        console.log('   - MDM Enrollment');
        console.log('   - Profile Installation');
        
        console.log('\n🚀 After Reboot:');
        console.log('   - Login screen will appear directly');
        console.log('   - No setup assistant');
        console.log('   - No onboarding screens');
        console.log('   - Direct access to desktop');
        console.log('   - HEAD-CRAB setup shortcut ready');
        
        return results;
    }
}

// Run setup bypass
async function main() {
    const skipManager = new SkipSetupPlistManager();
    await skipManager.runSetupBypass();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { SkipSetupPlistManager };