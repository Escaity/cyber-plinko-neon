// オブジェクトプールシステム - パフォーマンス最適化
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10, maxSize = 100) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;

        // プール管理
        this.available = [];
        this.inUse = new Set();

        // 統計情報
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            poolHits: 0,
            poolMisses: 0,
            maxInUse: 0
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
            this.resetFn(obj, ...args);
            this.stats.poolHits++;
        } else {
            // 新規作成
            obj = this.createFn(...args);
            this.stats.created++;
            this.stats.poolMisses++;
        }

        this.inUse.add(obj);
        this.stats.maxInUse = Math.max(this.stats.maxInUse, this.inUse.size);

        return obj;
    }

    /**
     * オブジェクトの返却
     */
    release(obj) {
        if (!this.inUse.has(obj)) {
            console.warn('Attempting to release object not in use');
            return false;
        }

        this.inUse.delete(obj);

        // プールサイズ制限チェック
        if (this.available.length < this.maxSize) {
            this.available.push(obj);
            this.stats.released++;
            return true;
        } else {
            // プールが満杯の場合は破棄
            return false;
        }
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
                (this.stats.poolHits / this.stats.acquired * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * プールのクリア
     */
    clear() {
        this.available = [];
        this.inUse.clear();

        // 統計リセット（累積統計は保持）
        const totalStats = { ...this.stats };
        this.stats = {
            created: totalStats.created,
            acquired: totalStats.acquired,
            released: totalStats.released,
            poolHits: totalStats.poolHits,
            poolMisses: totalStats.poolMisses,
            maxInUse: totalStats.maxInUse
        };
    }

    /**
     * プールサイズの調整
     */
    resize(newSize) {
        if (newSize < this.available.length) {
            // サイズ縮小
            this.available.splice(newSize);
        } else if (newSize > this.available.length) {
            // サイズ拡張
            const additionalCount = newSize - this.available.length;
            this.preallocate(additionalCount);
        }

        this.maxSize = newSize;
    }
}

// ボール専用プール
class BallPool extends ObjectPool {
    constructor(initialSize = 15, maxSize = 50) {
        super(
            // 作成関数
            (x = 0, y = 0, options = {}) => new Ball(x, y, options),

            // リセット関数
            (ball, x = 0, y = 0, options = {}) => {
                ball.reset(x, y);
                // 追加オプションの適用
                if (options.color) ball.color = options.color;
                if (options.vx !== undefined) ball.vx = options.vx;
                if (options.vy !== undefined) ball.vy = options.vy;
            },

            initialSize,
            maxSize
        );
    }

    /**
     * ボールの一括クリーンアップ
     */
    cleanupInactiveBalls(ballArray) {
        const cleaned = [];
        const toRelease = [];

        ballArray.forEach(ball => {
            if (ball.isActive) {
                cleaned.push(ball);
            } else {
                toRelease.push(ball);
            }
        });

        // 非アクティブなボールをプールに返却
        toRelease.forEach(ball => this.release(ball));

        return cleaned;
    }
}

// パーティクル専用プール
class ParticlePool extends ObjectPool {
    constructor(initialSize = 100, maxSize = 200) {
        super(
            // 作成関数
            (x = 0, y = 0, options = {}) => new Particle(x, y, options),

            // リセット関数
            (particle, x = 0, y = 0, options = {}) => {
                particle.x = x;
                particle.y = y;
                particle.vx = options.vx || Utils.Math.randomFloat(-2, 2);
                particle.vy = options.vy || Utils.Math.randomFloat(-3, -1);
                particle.life = options.life || CONFIG.EFFECTS.PARTICLE_LIFETIME;
                particle.maxLife = particle.life;
                particle.size = options.size || Utils.Math.randomFloat(1, 3);
                particle.color = options.color || Utils.Array.randomElement(CONFIG.COLORS.PARTICLE_COLORS);
                particle.alpha = 1;
                particle.gravity = options.gravity || 0.1;
                particle.friction = options.friction || 0.98;
                particle.glow = options.glow !== false;
                particle.type = options.type || 'default';
            },

            initialSize,
            maxSize
        );
    }

    /**
     * パーティクルの一括管理
     */
    updateAndCleanup(particleArray) {
        const active = [];
        const toRelease = [];

        particleArray.forEach(particle => {
            if (particle.update()) {
                active.push(particle);
            } else {
                toRelease.push(particle);
            }
        });

        // 非アクティブなパーティクルをプールに返却
        toRelease.forEach(particle => this.release(particle));

        return active;
    }
}

// プールマネージャー - 全プールの統合管理
class PoolManager {
    constructor() {
        this.pools = new Map();

        // 標準プールの初期化
        this.initializeStandardPools();

        // パフォーマンス監視
        this.performanceMonitor = {
            lastCleanup: Date.now(),
            cleanupInterval: 5000, // 5秒ごとにクリーンアップ
            totalMemorySaved: 0
        };
    }

    /**
     * 標準プールの初期化
     */
    initializeStandardPools() {
        // ボールプール
        this.pools.set('ball', new BallPool(15, 50));

        // パーティクルプール
        this.pools.set('particle', new ParticlePool(100, 200));

        // トレイルパーティクルプール
        this.pools.set('trail', new ObjectPool(
            (x, y, options) => new TrailParticle(x, y, options),
            (particle, x, y, options) => {
                particle.x = x;
                particle.y = y;
                particle.baseSize = options.size || 2;
                particle.life = CONFIG.BALL.TRAIL_LENGTH;
                particle.maxLife = particle.life;
                particle.color = options.color || CONFIG.COLORS.PRIMARY;
                particle.alpha = 1;
            },
            50, 100
        ));
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
     * 定期クリーンアップ
     */
    performPeriodicCleanup() {
        const now = Date.now();

        if (now - this.performanceMonitor.lastCleanup >= this.performanceMonitor.cleanupInterval) {
            let totalCleaned = 0;

            this.pools.forEach((pool, name) => {
                const beforeCount = pool.getStats().totalObjects;

                // プールサイズの動的調整
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
    }

    /**
     * プールサイズの最適化
     */
    optimizePoolSize(pool, poolName) {
        const stats = pool.getStats();
        const hitRate = parseFloat(stats.hitRate);

        // ヒット率が低い場合はプールサイズを縮小
        if (hitRate < 50 && stats.availableCount > 10) {
            const newSize = Math.max(10, Math.floor(stats.availableCount * 0.8));
            pool.resize(newSize);
        }

        // 使用中オブジェクトが多い場合はプールサイズを拡張
        else if (stats.inUseCount > stats.availableCount * 2) {
            const newSize = Math.min(pool.maxSize, stats.availableCount + 10);
            pool.resize(newSize);
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
     * パフォーマンス情報の取得
     */
    getPerformanceInfo() {
        return {
            poolCount: this.pools.size,
            memoryUsage: this.getMemoryUsage(),
            allStats: this.getAllStats(),
            lastCleanup: this.performanceMonitor.lastCleanup,
            nextCleanup: this.performanceMonitor.lastCleanup + this.performanceMonitor.cleanupInterval
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

    /**
     * 緊急メモリクリーンアップ
     */
    emergencyCleanup() {
        let cleaned = 0;

        this.pools.forEach((pool, name) => {
            const stats = pool.getStats();

            // 使用中でないオブジェクトを大幅に削減
            const targetSize = Math.max(5, Math.floor(stats.inUseCount * 0.5));
            pool.resize(targetSize);

            cleaned += (stats.availableCount - targetSize);
        });

        console.warn(`Emergency cleanup performed: ${cleaned} objects removed`);
        return cleaned;
    }
}

// グローバルプールマネージャーの初期化
window.poolManager = new PoolManager();