#!/usr/bin/env node

/**
 * GitHub OAuth App Client with Rate Limiting
 * Simpler authentication using OAuth tokens
 */

const https = require('https');
const fs = require('fs').promises;
const { RateLimiter } = require('./rate-limiter.js');

class GitHubOAuthClient {
    constructor(options = {}) {
        this.token = options.token || process.env.GITHUB_TOKEN;
        this.clientId = options.clientId || process.env.GITHUB_CLIENT_ID;
        this.clientSecret = options.clientSecret || process.env.GITHUB_CLIENT_SECRET;
        
        // Rate limiting configuration
        this.rateLimitRetries = options.rateLimitRetries || 3;
        this.rateLimitDelay = options.rateLimitDelay || 60000;
        this.backoffMultiplier = options.backoffMultiplier || 2;
        
        // Rate limit tracking
        this.rateLimitRemaining = null;
        this.rateLimitReset = null;
        this.rateLimitLimit = null;
        
        // Initialize rate limiter
        this.rateLimiter = new RateLimiter({
            maxRequests: 30,
            windowMs: 60000,
            cacheTimeout: 300000
        });
    }

    /**
     * Make HTTP request with automatic retry on rate limit
     */
    async request(method, path, data = null, retryCount = 0) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: path,
                method: method,
                headers: {
                    'User-Agent': 'HEAD-CRAB-OAuth',
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            };

            // Add authentication
            if (this.token) {
                options.headers['Authorization'] = `Bearer ${this.token}`;
            } else if (this.clientId && this.clientSecret) {
                // Basic auth for OAuth App
                const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
                options.headers['Authorization'] = `Basic ${auth}`;
            }

            if (data) {
                const payload = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = Buffer.byteLength(payload);
            }

            const req = https.request(options, (res) => {
                let body = '';
                
                // Extract rate limit headers
                this.rateLimitRemaining = parseInt(res.headers['x-ratelimit-remaining'] || '0');
                this.rateLimitReset = parseInt(res.headers['x-ratelimit-reset'] || '0');
                this.rateLimitLimit = parseInt(res.headers['x-ratelimit-limit'] || '0');
                
                res.on('data', chunk => body += chunk);
                res.on('end', async () => {
                    try {
                        const result = body ? JSON.parse(body) : {};
                        
                        // Handle rate limiting
                        if (res.statusCode === 403 && res.headers['x-ratelimit-remaining'] === '0') {
                            if (retryCount < this.rateLimitRetries) {
                                const resetTime = this.rateLimitReset * 1000;
                                const now = Date.now();
                                const waitTime = resetTime > now ? resetTime - now + 1000 : this.rateLimitDelay;
                                
                                console.log(`⏳ Rate limited. Waiting ${Math.ceil(waitTime/1000)}s... (attempt ${retryCount + 1}/${this.rateLimitRetries})`);
                                console.log(`   Reset time: ${new Date(resetTime).toLocaleString()}`);
                                
                                await this.sleep(waitTime);
                                
                                // Retry the request
                                return resolve(await this.request(method, path, data, retryCount + 1));
                            } else {
                                reject(new Error(`Rate limit exceeded after ${this.rateLimitRetries} retries`));
                            }
                        } else if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(result);
                        } else {
                            reject(new Error(`GitHub API error: ${res.statusCode} - ${result.message || body}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }

    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current rate limit status
     */
    async getRateLimit() {
        const response = await this.request('GET', '/rate_limit');
        return response;
    }

    /**
     * Check rate limit before making requests
     */
    async checkRateLimit() {
        if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 10) {
            console.log(`⚠️  Low rate limit: ${this.rateLimitRemaining} remaining`);
            
            if (this.rateLimitRemaining === 0 && this.rateLimitReset) {
                const waitTime = (this.rateLimitReset * 1000) - Date.now();
                if (waitTime > 0) {
                    console.log(`⏳ Waiting ${Math.ceil(waitTime/1000)}s for rate limit reset...`);
                    await this.sleep(waitTime + 1000);
                }
            }
        }
    }

    /**
     * Create or update file with rate limit handling
     */
    async createOrUpdateFile(owner, repo, path, content, message) {
        await this.checkRateLimit();
        
        const encodedContent = Buffer.from(content).toString('base64');
        const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
        
        try {
            // Check if file exists
            let sha;
            try {
                const existing = await this.request('GET', apiPath);
                sha = existing.sha;
            } catch (error) {
                // File doesn't exist, that's ok
            }
            
            const data = {
                message: message,
                content: encodedContent,
                sha: sha
            };
            
            const result = await this.request('PUT', apiPath, data);
            console.log(`✅ ${sha ? 'Updated' : 'Created'}: ${path}`);
            return result;
        } catch (error) {
            console.error(`❌ Failed to upload ${path}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Batch process multiple files
     */
    async batchUploadFiles(owner, repo, files, concurrency = 3) {
        console.log(`📤 Uploading ${files.length} files to ${owner}/${repo}...`);
        
        const results = [];
        const errors = [];
        
        // Process in chunks
        for (let i = 0; i < files.length; i += concurrency) {
            const chunk = files.slice(i, i + concurrency);
            
            // Check rate limit before each chunk
            await this.checkRateLimit();
            
            const chunkPromises = chunk.map(async (file) => {
                try {
                    const result = await this.createOrUpdateFile(
                        owner,
                        repo,
                        file.path,
                        file.content,
                        file.message || `Update ${file.path}`
                    );
                    results.push({ success: true, path: file.path, result });
                } catch (error) {
                    errors.push({ success: false, path: file.path, error: error.message });
                }
            });
            
            await Promise.all(chunkPromises);
            
            // Show progress
            console.log(`Progress: ${Math.min(i + concurrency, files.length)}/${files.length} files processed`);
            
            // Add delay between chunks if needed
            if (this.rateLimitRemaining < 50 && i + concurrency < files.length) {
                console.log('⏸️  Pausing between chunks to avoid rate limit...');
                await this.sleep(2000);
            }
        }
        
        return { results, errors };
    }

    /**
     * Test authentication and show rate limit
     */
    async testAuth() {
        try {
            console.log('🔄 Testing GitHub authentication...');
            
            // Get authenticated user
            const user = await this.request('GET', '/user');
            console.log(`✅ Authenticated as: ${user.login}`);
            console.log(`   Name: ${user.name || 'N/A'}`);
            console.log(`   Type: ${user.type}`);
            
            // Get rate limit
            const rateLimit = await this.getRateLimit();
            console.log(`\n📊 Rate Limit Status:`);
            console.log(`   Limit: ${rateLimit.rate.limit} requests/hour`);
            console.log(`   Remaining: ${rateLimit.rate.remaining}`);
            console.log(`   Reset: ${new Date(rateLimit.rate.reset * 1000).toLocaleString()}`);
            
            if (rateLimit.rate.remaining < 100) {
                console.log(`\n⚠️  Warning: Low rate limit remaining!`);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Authentication failed: ${error.message}`);
            return false;
        }
    }
}

/**
 * Sync directory to GitHub with rate limiting
 */
async function syncDirectory(client, owner, repo, localPath, remotePath = '') {
    const path = require('path');
    const entries = await fs.readdir(localPath, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
        const localFilePath = path.join(localPath, entry.name);
        const remoteFilePath = remotePath ? `${remotePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            const subFiles = await syncDirectory(client, owner, repo, localFilePath, remoteFilePath);
            files.push(...subFiles);
        } else {
            try {
                const content = await fs.readFile(localFilePath, 'utf8');
                files.push({
                    path: remoteFilePath,
                    content: content,
                    message: `Update ${entry.name}`
                });
            } catch (error) {
                console.error(`⚠️  Skipping ${localFilePath}: ${error.message}`);
            }
        }
    }
    
    return files;
}

// Example usage
async function main() {
    console.log('🦀 GitHub OAuth Client with Rate Limiting');
    console.log('========================================\n');

    // Check for authentication
    if (!process.env.GITHUB_TOKEN) {
        console.error('❌ Missing GITHUB_TOKEN environment variable!');
        console.log('\nTo create a personal access token:');
        console.log('1. Go to https://github.com/settings/tokens');
        console.log('2. Click "Generate new token (classic)"');
        console.log('3. Select scopes: repo, workflow (if needed)');
        console.log('4. Generate and copy the token');
        console.log('5. Run: export GITHUB_TOKEN="your_token"');
        process.exit(1);
    }

    const client = new GitHubOAuthClient({
        token: process.env.GITHUB_TOKEN
    });

    // Test authentication
    const authOk = await client.testAuth();
    if (!authOk) {
        process.exit(1);
    }

    // Example operations
    if (process.argv.includes('--sync')) {
        const owner = process.env.GITHUB_USER || 'garmir';
        const repo = process.env.GITHUB_REPO || '0xANATHEMA';
        const localPath = '/Volumes/Data/usr/local/head-crab';
        
        console.log(`\n📂 Scanning directory: ${localPath}`);
        const files = await syncDirectory(client, owner, repo, localPath);
        
        console.log(`\n📄 Found ${files.length} files to sync`);
        
        const { results, errors } = await client.batchUploadFiles(owner, repo, files);
        
        console.log(`\n✅ Sync complete!`);
        console.log(`   Successful: ${results.length}`);
        console.log(`   Failed: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n❌ Failed files:');
            errors.forEach(e => console.log(`   - ${e.path}: ${e.error}`));
        }
        
        // Final rate limit check
        const finalRateLimit = await client.getRateLimit();
        console.log(`\n📊 Final rate limit: ${finalRateLimit.rate.remaining}/${finalRateLimit.rate.limit}`);
    }
}

module.exports = { GitHubOAuthClient, syncDirectory };

if (require.main === module) {
    main();
}