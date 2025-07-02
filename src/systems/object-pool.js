// 修正版オブジェクトプールシステム - エラー修正とデバッグ強化
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10, maxSize = 100) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;

        // プール管理
        this.available = [];
        this.inUse = new Set();
        this.objectRegistry = new WeakMap(); // オブジェクトの出所を追跡

        // 統計情報
        this.stats = {
            created: 0,
            acquired: 0,
            released: 0,
            poolHits: 0,
            poolMisses: 0,
            maxInUse: 0,
            releaseErrors: 0 // エラーカウントを追加
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
            this.objectRegistry.set(obj, 'pooled'); // プール由来としてマーク
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
                console.warn('Pool corruption detected: object already in use', obj);
                // 新しいオブジェクトを作成
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
        // nullチェック
        if (!obj) {
            console.warn('Attempting to release null/undefined object');
            this.stats.releaseErrors++;
            return false;
        }

        // 使用中でないオブジェクトの返却チェック
        if (!this.inUse.has(obj)) {
            const origin = this.objectRegistry.get(obj);
            console.warn('Attempting to release object not in use', {
                object: obj,
                origin: origin || 'unknown',
                currentInUse: this.inUse.size,
                availableCount: this.available.length
            });
            this.stats.releaseErrors++;
            return false;
        }

        // 使用中リストから削除
        this.inUse.delete(obj);

        // プールサイズ制限チェック
        if (this.available.length < this.maxSize) {
            // 重複チェック
            if (this.available.includes(obj)) {
                console.warn('Object already in available pool', obj);
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

        // 使用中リストから強制削除
        this.inUse.delete(obj);

        // 利用可能リストからも削除（重複防止）
        const index = this.available.indexOf(obj);
        if (index !== -1) {
            this.available.splice(index, 1);
        }

        // プールサイズに余裕があれば追加
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
        console.warn('Repairing pool...');

        // 重複削除
        this.available = [...new Set(this.available)];

        // 使用中と利用可能の重複解決
        this.available = this.available.filter(obj => !this.inUse.has(obj));

        console.log('Pool repaired:', {
            available: this.available.length,
            inUse: this.inUse.size
        });
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

        // 統計リセット（累積統計は保持）
        const totalStats = { ...this.stats };
        this.stats = {
            created: totalStats.created,
            acquired: totalStats.acquired,
            released: totalStats.released,
            poolHits: totalStats.poolHits,
            poolMisses: totalStats.poolMisses,
            maxInUse: totalStats.maxInUse,
            releaseErrors: totalStats.releaseErrors
        };
    }

    /**
     * プールサイズの調整
     */
    resize(newSize) {
        if (newSize < this.available.length) {
            // サイズ縮小 - 余分なオブジェクトを削除
            const removed = this.available.splice(newSize);
            removed.forEach(obj => this.objectRegistry.delete(obj));
        } else if (newSize > this.available.length) {
            // サイズ拡張
            const additionalCount = newSize - this.available.length;
            this.preallocate(additionalCount);
        }

        this.maxSize = newSize;
    }
}

// パーティクル専用プール（修正版）
class ParticlePool extends ObjectPool {
    constructor(initialSize = 100, maxSize = 200) {
        super(
            // 作成関数
            (x = 0, y = 0, options = {}) => new Particle(x, y, options),

            // リセット関数
            (particle, x = 0, y = 0, options = {}) => {
                // パーティクルの状態をリセット
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

                // パーティクル固有のフラグをリセット
                particle.isPooled = true;
                particle.isActive = true;
            },

            initialSize,
            maxSize
        );
    }

    /**
     * パーティクルの一括管理（安全性強化版）
     */
    updateAndCleanup(particleArray) {
        if (!Array.isArray(particleArray)) {
            console.warn('Invalid particle array provided to updateAndCleanup');
            return [];
        }

        const active = [];
        const toRelease = [];

        // パーティクルの更新と分類
        particleArray.forEach(particle => {
            if (!particle) {
                console.warn('Null particle found in array');
                return;
            }

            try {
                if (particle.update && particle.update()) {
                    active.push(particle);
                } else {
                    // 非アクティブなパーティクルをリリース対象に
                    if (particle.isPooled && this.inUse.has(particle)) {
                        toRelease.push(particle);
                    }
                }
            } catch (error) {
                console.error('Error updating particle:', error);
                // エラーが発生したパーティクルもリリース対象に
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
                // エラーが発生した場合は強制リリースを試行
                this.forceRelease(particle);
            }
        });

        // 定期的な整合性チェック
        if (this.stats.frameCount % 300 === 0) { // 5秒ごと
            this.validateIntegrity();
        }

        return active;
    }
}

// ボール専用プール（修正版）
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

                // ボール固有のフラグをリセット
                ball.isPooled = true;
            },

            initialSize,
            maxSize
        );
    }

    /**
     * ボールの一括クリーンアップ（安全性強化版）
     */
    cleanupInactiveBalls(ballArray) {
        if (!Array.isArray(ballArray)) {
            console.warn('Invalid ball array provided to cleanupInactiveBalls');
            return [];
        }

        const cleaned = [];
        const toRelease = [];

        ballArray.forEach(ball => {
            if (!ball) {
                console.warn('Null ball found in array');
                return;
            }

            if (ball.isActive) {
                cleaned.push(ball);
            } else {
                // 非アクティブなボールをリリース対象に
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
                    console.warn('Failed to release ball, attempting force release');
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

// プールマネージャー（修正版）
class PoolManager {
    constructor() {
        this.pools = new Map();

        // 標準プールの初期化
        this.initializeStandardPools();

        // パフォーマンス監視
        this.performanceMonitor = {
            lastCleanup: Date.now(),
            cleanupInterval: 5000, // 5秒ごとにクリーンアップ
            totalMemorySaved: 0,
            lastIntegrityCheck: Date.now(),
            integrityCheckInterval: 10000 // 10秒ごとに整合性チェック
        };

        console.log('🏊 Pool Manager initialized with error handling');
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
                particle.isPooled = true;
                particle.isActive = true;
            },
            50, 100
        ));
    }

    /**
     * 定期クリーンアップ（整合性チェック付き）
     */
    performPeriodicCleanup() {
        const now = Date.now();

        // 通常のクリーンアップ
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
                console.warn(`Pool integrity issues detected in ${name} pool`);
                totalIssues++;
            }
        });

        if (totalIssues > 0) {
            console.warn(`Total pools with issues: ${totalIssues}`);
        }
    }

    /**
     * プールサイズの最適化
     */
    optimizePoolSize(pool, poolName) {
        const stats = pool.getStats();
        const hitRate = parseFloat(stats.hitRate);
        const errorRate = parseFloat(stats.errorRate);

        // エラー率が高い場合は警告
        if (errorRate > 5) {
            console.warn(`High error rate in ${poolName} pool: ${errorRate}%`);
        }

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
     * 緊急メモリクリーンアップ（修正版）
     */
    emergencyCleanup() {
        console.warn('🚨 Emergency cleanup initiated');

        let cleaned = 0;

        this.pools.forEach((pool, name) => {
            const stats = pool.getStats();

            // 整合性チェックを実行
            pool.validateIntegrity();

            // 使用中でないオブジェクトを大幅に削減
            const targetSize = Math.max(5, Math.floor(stats.inUseCount * 0.5));
            const originalSize = stats.availableCount;

            pool.resize(targetSize);

            const newStats = pool.getStats();
            cleaned += (originalSize - newStats.availableCount);

            console.warn(`Emergency cleanup for ${name}: ${originalSize} -> ${newStats.availableCount}`);
        });

        console.warn(`Emergency cleanup completed: ${cleaned} objects removed`);
        return cleaned;
    }

    /**
     * パフォーマンス情報の取得（エラー情報付き）
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
            nextCleanup: this.performanceMonitor.lastCleanup + this.performanceMonitor.cleanupInterval,
            lastIntegrityCheck: this.performanceMonitor.lastIntegrityCheck
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