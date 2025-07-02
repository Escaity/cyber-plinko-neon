// 軽量オブジェクトプールシステム
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10, maxSize = 50) { // サイズ削減
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;

        // プール管理
        this.available = [];
        this.inUse = new Set();
        this.objectRegistry = new WeakMap();

        // 統計情報
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            poolHits: 0,
            poolMisses: 0,
            maxInUse: 0,
            releaseErrors: 0
        };

        // 初期オブジェクトの作成
        this.preallocate(initialSize);
    }

    /**
     * 事前割り当て
     */
    preallocate(count) {
        for (let i = 0; i < count; i++) {
            const obj = this.createFn();
            this.available.push(obj);
            this.objectRegistry.set(obj, 'pooled');
            this.stats.created++;
        }
    }

    /**
     * オブジェクトの取得
     */
    acquire(...args) {
        this.stats.acquired++;

        let obj;

        if (this.available.length > 0) {
            // プールから再利用
            obj = this.available.pop();

            // 既に使用中でないことを確認
            if (this.inUse.has(obj)) {
                console.warn('Pool corruption detected: object already in use');
                obj = this.createFn(...args);
                this.objectRegistry.set(obj, 'direct');
                this.stats.created++;
                this.stats.poolMisses++;
            } else {
                this.resetFn(obj, ...args);
                this.stats.poolHits++;
            }
        } else {
            // 新規作成
            obj = this.createFn(...args);
            this.objectRegistry.set(obj, 'direct');
            this.stats.created++;
            this.stats.poolMisses++;
        }

        this.inUse.add(obj);
        this.stats.maxInUse = Math.max(this.stats.maxInUse, this.inUse.size);

        return obj;
    }

    /**
     * オブジェクトの返却（安全性強化版）
     */
    release(obj) {
        if (!obj) {
            this.stats.releaseErrors++;
            return false;
        }

        // 使用中でないオブジェクトの返却チェック
        if (!this.inUse.has(obj)) {
            this.stats.releaseErrors++;
            return false;
        }

        // 使用中リストから削除
        this.inUse.delete(obj);

        // プールサイズ制限チェック
        if (this.available.length < this.maxSize) {
            // 重複チェック
            if (this.available.includes(obj)) {
                this.stats.releaseErrors++;
                return false;
            }

            this.available.push(obj);
            this.stats.released++;
            return true;
        } else {
            // プールが満杯の場合は破棄
            this.objectRegistry.delete(obj);
            return false;
        }
    }

    /**
     * 強制リリース（エラー回復用）
     */
    forceRelease(obj) {
        if (!obj) return false;

        this.inUse.delete(obj);

        const index = this.available.indexOf(obj);
        if (index !== -1) {
            this.available.splice(index, 1);
        }

        if (this.available.length < this.maxSize) {
            this.available.push(obj);
            this.stats.released++;
            return true;
        }

        return false;
    }

    /**
     * プールの整合性チェック
     */
    validateIntegrity() {
        const issues = [];

        // 重複チェック
        const availableSet = new Set(this.available);
        if (availableSet.size !== this.available.length) {
            issues.push('Duplicate objects in available pool');
        }

        // 使用中と利用可能の重複チェック
        for (const obj of this.available) {
            if (this.inUse.has(obj)) {
                issues.push('Object exists in both available and inUse pools');
            }
        }

        if (issues.length > 0) {
            console.error('Pool integrity issues:', issues);
            this.repairPool();
        }

        return issues.length === 0;
    }

    /**
     * プールの修復
     */
    repairPool() {
        // 重複削除
        this.available = [...new Set(this.available)];

        // 使用中と利用可能の重複解決
        this.available = this.available.filter(obj => !this.inUse.has(obj));
    }

    /**
     * プールの統計情報
     */
    getStats() {
        return {
            ...this.stats,
            availableCount: this.available.length,
            inUseCount: this.inUse.size,
            totalObjects: this.available.length + this.inUse.size,
            hitRate: this.stats.acquired > 0 ?
                (this.stats.poolHits / this.stats.acquired * 100).toFixed(1) + '%' : '0%',
            errorRate: this.stats.acquired > 0 ?
                (this.stats.releaseErrors / this.stats.acquired * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * プールのクリア
     */
    clear() {
        this.available = [];
        this.inUse.clear();
        this.objectRegistry = new WeakMap();
    }

    /**
     * プールサイズの調整
     */
    resize(newSize) {
        if (newSize < this.available.length) {
            const removed = this.available.splice(newSize);
            removed.forEach(obj => this.objectRegistry.delete(obj));
        } else if (newSize > this.available.length) {
            const additionalCount = newSize - this.available.length;
            this.preallocate(additionalCount);
        }

        this.maxSize = newSize;
    }
}

// ボール専用プール（軽量化版）
class BallPool extends ObjectPool {
    constructor(initialSize = 10, maxSize = 30) { // サイズ削減
        super(
            // 作成関数
            (x = 0, y = 0, options = {}) => new Ball(x, y, options),

            // リセット関数
            (ball, x = 0, y = 0, options = {}) => {
                ball.reset(x, y);
                if (options.color) ball.color = options.color;
                if (options.vx !== undefined) ball.vx = options.vx;
                if (options.vy !== undefined) ball.vy = options.vy;
                ball.isPooled = true;
            },

            initialSize,
            maxSize
        );
    }

    /**
     * ボールの一括クリーンアップ
     */
    cleanupInactiveBalls(ballArray) {
        if (!Array.isArray(ballArray)) {
            return [];
        }

        const cleaned = [];
        const toRelease = [];

        ballArray.forEach(ball => {
            if (!ball) return;

            if (ball.isActive) {
                cleaned.push(ball);
            } else {
                if (ball.isPooled && this.inUse.has(ball)) {
                    toRelease.push(ball);
                }
            }
        });

        // 安全なリリース処理
        toRelease.forEach(ball => {
            try {
                const released = this.release(ball);
                if (!released) {
                    this.forceRelease(ball);
                }
            } catch (error) {
                console.error('Error releasing ball:', error);
                this.forceRelease(ball);
            }
        });

        return cleaned;
    }
}

// パーティクル専用プール（軽量化版）
class ParticlePool extends ObjectPool {
    constructor(initialSize = 30, maxSize = 60) { // サイズ削減
        super(
            // 作成関数
            (x = 0, y = 0, options = {}) => new Particle(x, y, options),

            // リセット関数
            (particle, x = 0, y = 0, options = {}) => {
                particle.reset(x, y, options);
                particle.isPooled = true;
            },

            initialSize,
            maxSize
        );
    }

    /**
     * パーティクルの一括管理
     */
    updateAndCleanup(particleArray) {
        if (!Array.isArray(particleArray)) {
            return [];
        }

        const active = [];
        const toRelease = [];

        particleArray.forEach(particle => {
            if (!particle) return;

            try {
                if (particle.update && particle.update()) {
                    active.push(particle);
                } else {
                    if (particle.isPooled && this.inUse.has(particle)) {
                        toRelease.push(particle);
                    }
                }
            } catch (error) {
                console.error('Error updating particle:', error);
                if (particle.isPooled && this.inUse.has(particle)) {
                    toRelease.push(particle);
                }
            }
        });

        // 安全なリリース処理
        toRelease.forEach(particle => {
            try {
                this.release(particle);
            } catch (error) {
                console.error('Error releasing particle:', error);
                this.forceRelease(particle);
            }
        });

        return active;
    }
}

// プールマネージャー（軽量化版）
class PoolManager {
    constructor() {
        this.pools = new Map();

        // 標準プールの初期化
        this.initializeStandardPools();

        // パフォーマンス監視
        this.performanceMonitor = {
            lastCleanup: Date.now(),
            cleanupInterval: 10000, // 10秒ごとに延長
            totalMemorySaved: 0,
            lastIntegrityCheck: Date.now(),
            integrityCheckInterval: 20000 // 20秒ごとに延長
        };

        console.log('🏊 Lightweight Pool Manager initialized');
    }

    /**
     * 標準プールの初期化（軽量化）
     */
    initializeStandardPools() {
        // ボールプール
        this.pools.set('ball', new BallPool(10, 25)); // サイズ削減

        // パーティクルプール
        this.pools.set('particle', new ParticlePool(20, 50)); // サイズ削減
    }

    /**
     * 定期クリーンアップ（軽量化）
     */
    performPeriodicCleanup() {
        const now = Date.now();

        // 通常のクリーンアップ
        if (now - this.performanceMonitor.lastCleanup >= this.performanceMonitor.cleanupInterval) {
            let totalCleaned = 0;

            this.pools.forEach((pool, name) => {
                const beforeCount = pool.getStats().totalObjects;

                // プールサイズの動的調整（軽量化）
                this.optimizePoolSize(pool, name);

                const afterCount = pool.getStats().totalObjects;
                totalCleaned += (beforeCount - afterCount);
            });

            this.performanceMonitor.lastCleanup = now;
            this.performanceMonitor.totalMemorySaved += totalCleaned;

            if (CONFIG.DEBUG.LOG_PERFORMANCE && totalCleaned > 0) {
                console.log(`Pool cleanup: ${totalCleaned} objects cleaned`);
            }
        }

        // 整合性チェック
        if (now - this.performanceMonitor.lastIntegrityCheck >= this.performanceMonitor.integrityCheckInterval) {
            this.validateAllPools();
            this.performanceMonitor.lastIntegrityCheck = now;
        }
    }

    /**
     * 全プールの整合性チェック
     */
    validateAllPools() {
        let totalIssues = 0;

        this.pools.forEach((pool, name) => {
            const isValid = pool.validateIntegrity();
            if (!isValid) {
                totalIssues++;
            }
        });

        if (totalIssues > 0) {
            console.warn(`Total pools with issues: ${totalIssues}`);
        }
    }

    /**
     * プールサイズの最適化（軽量化）
     */
    optimizePoolSize(pool, poolName) {
        const stats = pool.getStats();
        const hitRate = parseFloat(stats.hitRate);
        const errorRate = parseFloat(stats.errorRate);

        // エラー率が高い場合は警告
        if (errorRate > 10) {
            console.warn(`High error rate in ${poolName} pool: ${errorRate}%`);
        }

        // ヒット率が低い場合はプールサイズを縮小
        if (hitRate < 30 && stats.availableCount > 5) {
            const newSize = Math.max(5, Math.floor(stats.availableCount * 0.7));
            pool.resize(newSize);
        }

        // 使用中オブジェクトが多い場合はプールサイズを拡張
        else if (stats.inUseCount > stats.availableCount * 3) {
            const newSize = Math.min(pool.maxSize, stats.availableCount + 5);
            pool.resize(newSize);
        }
    }

    /**
     * 緊急メモリクリーンアップ（軽量化）
     */
    emergencyCleanup() {
        console.warn('🚨 Emergency cleanup initiated');

        let cleaned = 0;

        this.pools.forEach((pool, name) => {
            const stats = pool.getStats();

            // 整合性チェックを実行
            pool.validateIntegrity();

            // 使用中でないオブジェクトを大幅に削減
            const targetSize = Math.max(3, Math.floor(stats.inUseCount * 0.3));
            const originalSize = stats.availableCount;

            pool.resize(targetSize);

            const newStats = pool.getStats();
            cleaned += (originalSize - newStats.availableCount);

            console.warn(`Emergency cleanup for ${poolName}: ${originalSize} -> ${newStats.availableCount}`);
        });

        console.warn(`Emergency cleanup completed: ${cleaned} objects removed`);
        return cleaned;
    }

    /**
     * パフォーマンス情報の取得
     */
    getPerformanceInfo() {
        const allStats = this.getAllStats();
        let totalErrors = 0;

        Object.values(allStats).forEach(stats => {
            totalErrors += stats.releaseErrors || 0;
        });

        return {
            poolCount: this.pools.size,
            memoryUsage: this.getMemoryUsage(),
            allStats: allStats,
            totalErrors: totalErrors,
            lastCleanup: this.performanceMonitor.lastCleanup,
            nextCleanup: this.performanceMonitor.lastCleanup + this.performanceMonitor.cleanupInterval
        };
    }

    /**
     * 全プールの統計情報
     */
    getAllStats() {
        const stats = {};

        this.pools.forEach((pool, name) => {
            stats[name] = pool.getStats();
        });

        return stats;
    }

    /**
     * プールの取得
     */
    getPool(poolName) {
        return this.pools.get(poolName);
    }

    /**
     * 新しいプールの追加
     */
    addPool(name, pool) {
        this.pools.set(name, pool);
    }

    /**
     * プールの削除
     */
    removePool(name) {
        const pool = this.pools.get(name);
        if (pool) {
            pool.clear();
            this.pools.delete(name);
        }
    }

    /**
     * メモリ使用量の監視
     */
    getMemoryUsage() {
        let totalObjects = 0;
        let totalInUse = 0;
        let totalAvailable = 0;

        this.pools.forEach(pool => {
            const stats = pool.getStats();
            totalObjects += stats.totalObjects;
            totalInUse += stats.inUseCount;
            totalAvailable += stats.availableCount;
        });

        return {
            totalObjects,
            totalInUse,
            totalAvailable,
            memoryEfficiency: totalObjects > 0 ?
                (totalAvailable / totalObjects * 100).toFixed(1) + '%' : '0%',
            estimatedMemorySaved: this.performanceMonitor.totalMemorySaved
        };
    }

    /**
     * 全プールのリセット
     */
    resetAllPools() {
        this.pools.forEach(pool => pool.clear());
        this.performanceMonitor.totalMemorySaved = 0;

        console.log('All pools reset');
    }
}

// グローバルプールマネージャーの初期化
if (typeof window !== 'undefined') {
    window.poolManager = new PoolManager();
}