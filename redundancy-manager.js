#!/usr/bin/env node

/**
 * HEAD-CRAB Redundancy Manager
 * Ensures system resilience through multiple failover mechanisms
 */

const cluster = require('cluster');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class RedundancyManager {
    constructor() {
        this.workers = new Map();
        this.services = new Map();
        this.healthChecks = new Map();
        this.failoverQueue = [];
        this.replicationFactor = 3;
        
        // Redundancy configuration
        this.config = {
            maxWorkers: Math.min(os.cpus().length, 8),
            healthCheckInterval: 5000,
            restartDelay: 2000,
            maxRestartAttempts: 5,
            replicationSites: [
                '/Volumes/Macintosh HD/usr/local/head-crab',
                '/tmp/head-crab-backup',
                '~/.head-crab/backup'
            ]
        };
    }
    
    async initializeRedundancy() {
        console.log('🛡️  Initializing redundancy systems...');
        
        // Create backup directories
        for (const site of this.config.replicationSites) {
            const expandedPath = site.replace('~', os.homedir());
            await fs.mkdir(expandedPath, { recursive: true }).catch(() => {});
        }
        
        // Set up cluster for worker redundancy
        if (cluster.isMaster) {
            await this.setupMasterProcess();
        } else {
            await this.setupWorkerProcess();
        }
    }
    
    async setupMasterProcess() {
        console.log(`   Master process PID: ${process.pid}`);
        
        // Fork initial workers
        for (let i = 0; i < Math.min(3, this.config.maxWorkers); i++) {
            this.forkWorker(`worker-${i}`);
        }
        
        // Handle worker failures
        cluster.on('exit', (worker, code, signal) => {
            console.log(`⚠️  Worker ${worker.process.pid} died (${signal || code})`);
            this.handleWorkerFailure(worker);
        });
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        // Set up data replication
        this.startDataReplication();
    }
    
    forkWorker(id) {
        const worker = cluster.fork({ WORKER_ID: id });
        this.workers.set(worker.process.pid, {
            id,
            worker,
            restartCount: 0,
            startTime: Date.now()
        });
        
        console.log(`   ✅ Worker spawned: ${id} (PID: ${worker.process.pid})`);
        return worker;
    }
    
    async handleWorkerFailure(worker) {
        const workerInfo = this.workers.get(worker.process.pid);
        if (!workerInfo) return;
        
        this.workers.delete(worker.process.pid);
        
        // Check restart attempts
        if (workerInfo.restartCount >= this.config.maxRestartAttempts) {
            console.log(`   ❌ Worker ${workerInfo.id} exceeded restart limit`);
            this.failoverQueue.push(workerInfo.id);
            return;
        }
        
        // Restart with delay
        setTimeout(() => {
            console.log(`   🔄 Restarting worker ${workerInfo.id}...`);
            const newWorker = this.forkWorker(workerInfo.id);
            const newInfo = this.workers.get(newWorker.process.pid);
            newInfo.restartCount = workerInfo.restartCount + 1;
        }, this.config.restartDelay);
    }
    
    async setupWorkerProcess() {
        const workerId = process.env.WORKER_ID;
        console.log(`   Worker ${workerId} started (PID: ${process.pid})`);
        
        // Load service based on worker ID
        switch (workerId) {
            case 'worker-0':
                // Primary services
                await this.runService('memory-indexer', ['auto']);
                break;
            case 'worker-1':
                // Secondary services
                await this.runService('memory-archive-scheduler', []);
                break;
            case 'worker-2':
                // Monitoring services
                await this.runService('start-monitoring', []);
                break;
            default:
                // Backup worker
                console.log('   Backup worker on standby');
        }
    }
    
    async runService(serviceName, args) {
        try {
            const scriptPath = path.join(__dirname, `${serviceName}.js`);
            console.log(`   Starting service: ${serviceName}`);
            
            // Run in current process (for cluster management)
            require(scriptPath);
            
        } catch (error) {
            console.error(`   ❌ Service ${serviceName} failed:`, error.message);
            process.exit(1); // Let cluster restart the worker
        }
    }
    
    startHealthMonitoring() {
        setInterval(() => {
            for (const [pid, info] of this.workers) {
                const uptime = Date.now() - info.startTime;
                const health = {
                    pid,
                    id: info.id,
                    uptime,
                    restarts: info.restartCount,
                    status: info.worker.isDead() ? 'dead' : 'alive'
                };
                
                this.healthChecks.set(info.id, health);
            }
            
            // Log health status
            const aliveCount = Array.from(this.healthChecks.values())
                .filter(h => h.status === 'alive').length;
            
            if (aliveCount < 2) {
                console.log(`⚠️  Low redundancy: Only ${aliveCount} workers alive`);
                this.increaseRedundancy();
            }
            
        }, this.config.healthCheckInterval);
    }
    
    increaseRedundancy() {
        const currentWorkers = this.workers.size;
        if (currentWorkers < this.config.maxWorkers) {
            const newId = `backup-${Date.now()}`;
            console.log(`   📈 Increasing redundancy: spawning ${newId}`);
            this.forkWorker(newId);
        }
    }
    
    async startDataReplication() {
        console.log('   🔄 Starting data replication...');
        
        setInterval(async () => {
            await this.replicateData();
        }, 60000); // Every minute
        
        // Initial replication
        await this.replicateData();
    }
    
    async replicateData() {
        const criticalFiles = [
            'memory-indexer.js',
            'github-oauth-client.js',
            'rate-limiter.js',
            '.env',
            'workflow-control.json'
        ];
        
        const primarySite = this.config.replicationSites[0];
        
        for (let i = 1; i < this.config.replicationSites.length; i++) {
            const backupSite = this.config.replicationSites[i].replace('~', os.homedir());
            
            try {
                for (const file of criticalFiles) {
                    const source = path.join(primarySite, file);
                    const dest = path.join(backupSite, file);
                    
                    try {
                        const data = await fs.readFile(source);
                        await fs.writeFile(dest, data);
                    } catch (e) {
                        // File might not exist
                    }
                }
                
                console.log(`   ✅ Replicated to ${backupSite}`);
                
            } catch (error) {
                console.log(`   ⚠️  Replication failed to ${backupSite}`);
            }
        }
    }
    
    async createFailoverScript() {
        const failoverScript = `#!/bin/bash
# HEAD-CRAB Failover Script

echo "🚨 HEAD-CRAB Failover Initiated"

# Check primary site
if [ -d "/Volumes/Macintosh HD/usr/local/head-crab" ]; then
    cd "/Volumes/Macintosh HD/usr/local/head-crab"
    node head-crab-boot.js
elif [ -d "/tmp/head-crab-backup" ]; then
    echo "   Using backup site: /tmp/head-crab-backup"
    cd "/tmp/head-crab-backup"
    node head-crab-boot.js
elif [ -d "$HOME/.head-crab/backup" ]; then
    echo "   Using backup site: ~/.head-crab/backup"
    cd "$HOME/.head-crab/backup"
    node head-crab-boot.js
else
    echo "   ❌ No backup sites available!"
    exit 1
fi
`;
        
        const scriptPath = path.join(__dirname, 'head-crab-failover.sh');
        await fs.writeFile(scriptPath, failoverScript);
        await fs.chmod(scriptPath, '755');
        
        console.log('   ✅ Failover script created');
    }
    
    getRedundancyStatus() {
        const workers = Array.from(this.workers.values());
        const healthChecks = Array.from(this.healthChecks.values());
        
        return {
            totalWorkers: workers.length,
            aliveWorkers: healthChecks.filter(h => h.status === 'alive').length,
            failedWorkers: this.failoverQueue.length,
            averageUptime: workers.reduce((sum, w) => sum + (Date.now() - w.startTime), 0) / workers.length / 1000,
            replicationSites: this.config.replicationSites.length,
            redundancyLevel: this.calculateRedundancyLevel()
        };
    }
    
    calculateRedundancyLevel() {
        const aliveWorkers = Array.from(this.healthChecks.values())
            .filter(h => h.status === 'alive').length;
        
        if (aliveWorkers >= 3) return 'HIGH';
        if (aliveWorkers >= 2) return 'MEDIUM';
        if (aliveWorkers >= 1) return 'LOW';
        return 'CRITICAL';
    }
}

// Standalone redundancy system
async function main() {
    console.log('🛡️  HEAD-CRAB Redundancy System');
    console.log('=================================\n');
    
    const redundancy = new RedundancyManager();
    await redundancy.initializeRedundancy();
    
    if (cluster.isMaster) {
        // Create failover script
        await redundancy.createFailoverScript();
        
        // Status monitoring
        setInterval(() => {
            const status = redundancy.getRedundancyStatus();
            console.log(`\n📊 Redundancy Status [${new Date().toTimeString().split(' ')[0]}]`);
            console.log(`   Workers: ${status.aliveWorkers}/${status.totalWorkers}`);
            console.log(`   Redundancy Level: ${status.redundancyLevel}`);
            console.log(`   Average Uptime: ${status.averageUptime.toFixed(0)}s`);
        }, 30000);
        
        console.log('\n✅ Redundancy system active');
        console.log('🦀 HEAD-CRAB running with guaranteed redundancy\n');
    }
}

module.exports = { RedundancyManager };

if (require.main === module) {
    main().catch(console.error);
}