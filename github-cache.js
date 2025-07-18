#!/usr/bin/env node

/**
 * GitHub Data Cache for HEAD-CRAB
 * Caches frequently accessed repository data to reduce API calls
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class GitHubCache {
    constructor(options = {}) {
        this.cacheDir = options.cacheDir || path.join(__dirname, '.github-cache');
        this.ttl = options.ttl || 300000; // 5 minutes default TTL
        this.maxSize = options.maxSize || 100; // Max cache entries
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            evictions: 0
        };
    }
    
    /**
     * Initialize cache directory
     */
    async init() {
        await fs.mkdir(this.cacheDir, { recursive: true });
        await this.loadIndex();
    }
    
    /**
     * Generate cache key from request
     */
    generateKey(method, path, params = {}) {
        const data = `${method}:${path}:${JSON.stringify(params)}`;
        return crypto.createHash('md5').update(data).digest('hex');
    }
    
    /**
     * Get from cache
     */
    async get(method, path, params) {
        const key = this.generateKey(method, path, params);
        const filePath = path.join(this.cacheDir, `${key}.json`);
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const cached = JSON.parse(data);
            
            // Check if expired
            if (Date.now() - cached.timestamp > this.ttl) {
                await this.delete(key);
                this.stats.misses++;
                return null;
            }
            
            this.stats.hits++;
            console.log(`💾 Cache hit: ${method} ${path}`);
            return cached.data;
            
        } catch (error) {
            this.stats.misses++;
            return null;
        }
    }
    
    /**
     * Save to cache
     */
    async set(method, path, params, data) {
        const key = this.generateKey(method, path, params);
        const filePath = path.join(this.cacheDir, `${key}.json`);
        
        const cacheEntry = {
            key,
            method,
            path,
            params,
            data,
            timestamp: Date.now()
        };
        
        try {
            await fs.writeFile(filePath, JSON.stringify(cacheEntry, null, 2));
            this.stats.writes++;
            
            // Update index
            await this.updateIndex(key, { method, path, timestamp: cacheEntry.timestamp });
            
            // Check cache size
            await this.evictIfNeeded();
            
        } catch (error) {
            console.error('Cache write error:', error.message);
        }
    }
    
    /**
     * Delete from cache
     */
    async delete(key) {
        const filePath = path.join(this.cacheDir, `${key}.json`);
        try {
            await fs.unlink(filePath);
            await this.removeFromIndex(key);
        } catch (error) {
            // File doesn't exist
        }
    }
    
    /**
     * Clear entire cache
     */
    async clear() {
        try {
            const files = await fs.readdir(this.cacheDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.cacheDir, file));
                }
            }
            await this.saveIndex({});
            console.log('🧹 Cache cleared');
        } catch (error) {
            console.error('Cache clear error:', error.message);
        }
    }
    
    /**
     * Load cache index
     */
    async loadIndex() {
        const indexPath = path.join(this.cacheDir, 'index.json');
        try {
            const data = await fs.readFile(indexPath, 'utf8');
            this.index = JSON.parse(data);
        } catch (error) {
            this.index = {};
        }
    }
    
    /**
     * Save cache index
     */
    async saveIndex(index = this.index) {
        const indexPath = path.join(this.cacheDir, 'index.json');
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
    }
    
    /**
     * Update index entry
     */
    async updateIndex(key, info) {
        this.index[key] = info;
        await this.saveIndex();
    }
    
    /**
     * Remove from index
     */
    async removeFromIndex(key) {
        delete this.index[key];
        await this.saveIndex();
    }
    
    /**
     * Evict old entries if cache is full
     */
    async evictIfNeeded() {
        const entries = Object.entries(this.index);
        if (entries.length <= this.maxSize) return;
        
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Evict oldest entries
        const toEvict = entries.slice(0, entries.length - this.maxSize);
        for (const [key] of toEvict) {
            await this.delete(key);
            this.stats.evictions++;
        }
        
        console.log(`🗑️  Evicted ${toEvict.length} old cache entries`);
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const entries = Object.keys(this.index).length;
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
            : 0;
            
        return {
            entries,
            hits: this.stats.hits,
            misses: this.stats.misses,
            writes: this.stats.writes,
            evictions: this.stats.evictions,
            hitRate: `${hitRate}%`,
            sizeLimit: this.maxSize
        };
    }
    
    /**
     * Cache warming - preload common requests
     */
    async warmCache(client, endpoints) {
        console.log('🔥 Warming cache...');
        
        for (const endpoint of endpoints) {
            try {
                await client.request('GET', endpoint);
                console.log(`   ✅ Cached: ${endpoint}`);
            } catch (error) {
                console.log(`   ❌ Failed: ${endpoint}`);
            }
        }
        
        console.log('✅ Cache warming complete');
    }
}

// Integration test
async function testCache() {
    console.log('🧪 Testing GitHub Cache System\n');
    
    const cache = new GitHubCache({
        ttl: 10000, // 10 seconds for testing
        maxSize: 5
    });
    
    await cache.init();
    
    // Test basic operations
    console.log('1. Testing set/get operations:');
    await cache.set('GET', '/repos/test/repo', {}, { name: 'test-repo', stars: 100 });
    const cached = await cache.get('GET', '/repos/test/repo', {});
    console.log(`   ✅ Cache working: ${cached ? 'Yes' : 'No'}`);
    
    // Test cache stats
    console.log('\n2. Cache statistics:');
    const stats = cache.getStats();
    console.log(`   Entries: ${stats.entries}`);
    console.log(`   Hit rate: ${stats.hitRate}`);
    
    // Test eviction
    console.log('\n3. Testing eviction:');
    for (let i = 0; i < 10; i++) {
        await cache.set('GET', `/repos/test/repo${i}`, {}, { id: i });
    }
    const finalStats = cache.getStats();
    console.log(`   Entries after eviction: ${finalStats.entries}/${finalStats.sizeLimit}`);
    console.log(`   Evictions: ${finalStats.evictions}`);
    
    console.log('\n✅ Cache test complete!');
}

// Export for use in other modules
module.exports = { GitHubCache };

// Run test if called directly
if (require.main === module) {
    testCache();
}