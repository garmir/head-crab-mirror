#!/usr/bin/env node

/**
 * Memory Indexing System for HEAD-CRAB
 * Creates searchable indexes for fast memory lookup
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class MemoryIndexer {
    constructor(options = {}) {
        this.memoryDir = options.memoryDir || path.join(__dirname, 'memory');
        this.indexDir = options.indexDir || path.join(__dirname, '.memory-index');
        this.updateInterval = options.updateInterval || 300000; // 5 minutes
        this.indexes = {
            keyword: {},      // Word -> memory files
            timestamp: {},    // Date -> memory files
            command: {},      // Command -> memory files
            hash: {},         // Hash -> file mapping
            metadata: {}      // File -> metadata
        };
    }
    
    async init() {
        await fs.mkdir(this.indexDir, { recursive: true });
        await this.loadIndexes();
    }
    
    async loadIndexes() {
        try {
            const indexFiles = ['keyword', 'timestamp', 'command', 'hash', 'metadata'];
            for (const indexType of indexFiles) {
                const indexPath = path.join(this.indexDir, `${indexType}.index.json`);
                try {
                    const data = await fs.readFile(indexPath, 'utf8');
                    this.indexes[indexType] = JSON.parse(data);
                } catch (e) {
                    // Index doesn't exist yet
                }
            }
            console.log('📚 Loaded existing indexes');
        } catch (error) {
            console.log('📝 Starting with fresh indexes');
        }
    }
    
    async saveIndexes() {
        for (const [indexType, data] of Object.entries(this.indexes)) {
            const indexPath = path.join(this.indexDir, `${indexType}.index.json`);
            await fs.writeFile(indexPath, JSON.stringify(data, null, 2));
        }
    }
    
    extractKeywords(text) {
        // Extract meaningful keywords
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['this', 'that', 'with', 'from', 'have'].includes(word));
        
        return [...new Set(words)];
    }
    
    async indexMemoryFile(fileName) {
        try {
            const filePath = path.join(this.memoryDir, fileName);
            const content = await fs.readFile(filePath, 'utf8');
            const memory = JSON.parse(content);
            const stats = await fs.stat(filePath);
            
            // Generate file hash
            const hash = crypto.createHash('md5').update(content).digest('hex');
            
            // Skip if already indexed and unchanged
            if (this.indexes.hash[fileName] === hash) {
                return false;
            }
            
            // Update hash index
            this.indexes.hash[fileName] = hash;
            
            // Extract and index keywords
            const text = [
                memory.content || '',
                memory.task || '',
                memory.phase || '',
                memory.result || ''
            ].join(' ');
            
            const keywords = this.extractKeywords(text);
            for (const keyword of keywords) {
                if (!this.indexes.keyword[keyword]) {
                    this.indexes.keyword[keyword] = [];
                }
                if (!this.indexes.keyword[keyword].includes(fileName)) {
                    this.indexes.keyword[keyword].push(fileName);
                }
            }
            
            // Index by timestamp
            const date = new Date(memory.timestamp || stats.mtime).toISOString().split('T')[0];
            if (!this.indexes.timestamp[date]) {
                this.indexes.timestamp[date] = [];
            }
            if (!this.indexes.timestamp[date].includes(fileName)) {
                this.indexes.timestamp[date].push(fileName);
            }
            
            // Index by command if present
            if (memory.command) {
                const cmd = memory.command.split(' ')[0];
                if (!this.indexes.command[cmd]) {
                    this.indexes.command[cmd] = [];
                }
                if (!this.indexes.command[cmd].includes(fileName)) {
                    this.indexes.command[cmd].push(fileName);
                }
            }
            
            // Store metadata
            this.indexes.metadata[fileName] = {
                size: stats.size,
                modified: stats.mtime,
                keywords: keywords.length,
                indexed: new Date().toISOString()
            };
            
            return true;
        } catch (error) {
            console.error(`Failed to index ${fileName}:`, error.message);
            return false;
        }
    }
    
    async buildIndex() {
        console.log('🔨 Building memory index...');
        const startTime = Date.now();
        
        const files = await fs.readdir(this.memoryDir);
        const memoryFiles = files.filter(f => f.endsWith('.json'));
        
        let indexed = 0;
        let skipped = 0;
        
        for (let i = 0; i < memoryFiles.length; i++) {
            const file = memoryFiles[i];
            const wasIndexed = await this.indexMemoryFile(file);
            
            if (wasIndexed) indexed++;
            else skipped++;
            
            // Progress update
            if ((i + 1) % 50 === 0) {
                console.log(`   Progress: ${i + 1}/${memoryFiles.length} files`);
            }
        }
        
        await this.saveIndexes();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Index complete in ${duration}s`);
        console.log(`   Indexed: ${indexed} new/modified files`);
        console.log(`   Skipped: ${skipped} unchanged files`);
        console.log(`   Total keywords: ${Object.keys(this.indexes.keyword).length}`);
        
        return { indexed, skipped, duration };
    }
    
    async search(query, options = {}) {
        const results = new Set();
        const queryLower = query.toLowerCase();
        const words = this.extractKeywords(queryLower);
        
        // Search in keywords
        for (const word of words) {
            const files = this.indexes.keyword[word] || [];
            files.forEach(f => results.add(f));
        }
        
        // Search by date if query looks like a date
        if (/\d{4}-\d{2}-\d{2}/.test(query)) {
            const dateFiles = this.indexes.timestamp[query] || [];
            dateFiles.forEach(f => results.add(f));
        }
        
        // Search by command
        const cmdFiles = this.indexes.command[query] || [];
        cmdFiles.forEach(f => results.add(f));
        
        // Rank results by relevance
        const rankedResults = Array.from(results).map(file => {
            let score = 0;
            
            // Score by keyword matches
            for (const word of words) {
                if (this.indexes.keyword[word]?.includes(file)) {
                    score += 10;
                }
            }
            
            // Boost recent files
            const meta = this.indexes.metadata[file];
            if (meta) {
                const age = Date.now() - new Date(meta.modified).getTime();
                const daysSinceModified = age / (1000 * 60 * 60 * 24);
                score += Math.max(0, 10 - daysSinceModified);
            }
            
            return { file, score };
        });
        
        // Sort by score and limit results
        rankedResults.sort((a, b) => b.score - a.score);
        const limit = options.limit || 10;
        
        return rankedResults.slice(0, limit);
    }
    
    async getStats() {
        return {
            totalFiles: Object.keys(this.indexes.metadata).length,
            totalKeywords: Object.keys(this.indexes.keyword).length,
            totalCommands: Object.keys(this.indexes.command).length,
            indexSizeKB: (JSON.stringify(this.indexes).length / 1024).toFixed(2),
            dates: Object.keys(this.indexes.timestamp).length
        };
    }
    
    startAutoIndex() {
        console.log('🔄 Starting auto-indexer');
        console.log(`   Update interval: ${this.updateInterval / 1000}s`);
        
        // Initial index
        this.buildIndex();
        
        // Periodic updates
        const interval = setInterval(() => {
            console.log('\n⏰ Running scheduled index update...');
            this.buildIndex();
        }, this.updateInterval);
        
        return interval;
    }
}

// CLI interface
async function runIndexer() {
    console.log('🦀 HEAD-CRAB Memory Indexer');
    console.log('===========================\n');
    
    const indexer = new MemoryIndexer();
    await indexer.init();
    
    const command = process.argv[2];
    
    if (command === 'build') {
        await indexer.buildIndex();
        const stats = await indexer.getStats();
        console.log('\n📊 Index Statistics:');
        Object.entries(stats).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        
    } else if (command === 'search') {
        const query = process.argv.slice(3).join(' ');
        if (!query) {
            console.log('Usage: node memory-indexer.js search <query>');
            return;
        }
        
        console.log(`🔍 Searching for: "${query}"`);
        const results = await indexer.search(query);
        
        if (results.length === 0) {
            console.log('No results found.');
        } else {
            console.log(`\n📄 Found ${results.length} results:\n`);
            for (const result of results) {
                const meta = indexer.indexes.metadata[result.file];
                console.log(`   ${result.file} (score: ${result.score})`);
                if (meta) {
                    console.log(`     Size: ${(meta.size / 1024).toFixed(1)}KB, Modified: ${new Date(meta.modified).toLocaleDateString()}`);
                }
            }
        }
        
    } else if (command === 'auto') {
        indexer.startAutoIndex();
        console.log('\n🚀 Auto-indexer running. Press Ctrl+C to stop.');
        
        // Keep process running
        process.on('SIGINT', () => {
            console.log('\n⏹️  Stopping auto-indexer...');
            process.exit(0);
        });
        
    } else {
        console.log('Commands:');
        console.log('  build              - Build/rebuild the index');
        console.log('  search <query>     - Search memories');
        console.log('  auto               - Start auto-indexing service');
        console.log('\nExamples:');
        console.log('  node memory-indexer.js build');
        console.log('  node memory-indexer.js search "github api"');
        console.log('  node memory-indexer.js auto');
    }
}

module.exports = { MemoryIndexer };

if (require.main === module) {
    runIndexer();
}