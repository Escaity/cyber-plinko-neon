// パフォーマンス監視とオプティマイゼーション
class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        this.frameTimeHistory = [];
        this.maxHistoryLength = 60;

        // パフォーマンス統計
        this.stats = {
            averageFPS: 60,
            minFPS: 60,
            maxFPS: 60,
            frameTime: 16.67,
            updateTime: 0,
            renderTime: 0,
            collisionTime: 0
        };

        // 適応的品質設定
        this.qualityLevel = 1.0; // 0.1 - 1.0
        this.qualityAdjustTimer = 0;
        this.performanceThresholds = {
            lowFPS: 30,
            targetFPS: 55,
            highFPS: 58
        };
    }

    // フレーム開始
    startFrame() {
        this.frameStartTime = performance.now();
        this.frameCount++;
    }

    // フレーム終了とFPS計算
    endFrame() {
        const currentTime = performance.now();
        const frameTime = currentTime - this.frameStartTime;

        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > this.maxHistoryLength) {
            this.frameTimeHistory.shift();
        }

        // FPS更新（1秒ごと）
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastTime));
            this.updateStats();
            this.adjustQuality();

            this.frameCount = 0;
            this.lastTime = currentTime;

            // UI更新
            Utils.DOM.setText('fps', this.fps);
        }
    }

    // 処理時間の測定
    measureTime(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();

        this.stats[`${name}Time`] = end - start;
        return result;
    }

    // 統計の更新
    updateStats() {
        if (this.frameTimeHistory.length === 0) return;

        const avgFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
        this.stats.frameTime = avgFrameTime;
        this.stats.averageFPS = 1000 / avgFrameTime;
        this.stats.minFPS = Math.min(this.stats.minFPS, this.fps);
        this.stats.maxFPS = Math.max(this.stats.maxFPS, this.fps);
    }

    // 適応的品質調整
    adjustQuality() {
        this.qualityAdjustTimer++;

        // 3秒ごとに品質調整をチェック
        if (this.qualityAdjustTimer < 180) return;
        this.qualityAdjustTimer = 0;

        const currentFPS = this.stats.averageFPS;

        if (currentFPS < this.performanceThresholds.lowFPS) {
            // パフォーマンス低下 - 品質を下げる
            this.decreaseQuality();
        } else if (currentFPS > this.performanceThresholds.highFPS && this.qualityLevel < 1.0) {
            // パフォーマンス良好 - 品質を上げる
            this.increaseQuality();
        }
    }

    // 品質を下げる
    decreaseQuality() {
        const oldQuality = this.qualityLevel;
        this.qualityLevel = Math.max(0.1, this.qualityLevel - 0.1);

        if (this.qualityLevel !== oldQuality) {
            this.applyQualitySettings();
            console.log(`Quality decreased to ${(this.qualityLevel * 100).toFixed(0)}%`);
        }
    }

    // 品質を上げる
    increaseQuality() {
        const oldQuality = this.qualityLevel;
        this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.1);

        if (this.qualityLevel !== oldQuality) {
            this.applyQualitySettings();
            console.log(`Quality increased to ${(this.qualityLevel * 100).toFixed(0)}%`);
        }
    }

    // 品質設定の適用
    applyQualitySettings() {
        // パーティクル数の調整
        CONFIG.PERFORMANCE.MAX_PARTICLES = Math.floor(200 * this.qualityLevel);

        // ボール数の調整
        CONFIG.GAME.MAX_BALLS_ON_SCREEN = Math.floor(50 * this.qualityLevel);

        // エフェクトの調整
        CONFIG.EFFECTS.ENABLE_TRAILS = this.qualityLevel > 0.5;
        CONFIG.EFFECTS.ENABLE_GLOW = this.qualityLevel > 0.3;
        CONFIG.EFFECTS.EXPLOSION_PARTICLES = Math.floor(20 * this.qualityLevel);

        // 更新頻度の調整
        CONFIG.PERFORMANCE.UPDATE_FREQUENCY = this.qualityLevel > 0.7 ? 1 : 2;
    }

    // パフォーマンス情報の取得
    getPerformanceInfo() {
        return {
            fps: this.fps,
            averageFPS: Math.round(this.stats.averageFPS),
            quality: `${(this.qualityLevel * 100).toFixed(0)}%`,
            frameTime: `${this.stats.frameTime.toFixed(2)}ms`,
            memory: Utils.Performance.getMemoryUsage()
        };
    }

    // メモリ使用量の監視
    monitorMemory() {
        const memory = Utils.Performance.getMemoryUsage();
        if (memory && memory.used > memory.limit * 0.8) {
            console.warn('High memory usage detected:', memory);
            this.decreaseQuality();
            return true;
        }
        return false;
    }

    // パフォーマンス警告
    checkPerformanceWarnings() {
        if (this.fps < this.performanceThresholds.lowFPS) {
            console.warn(`Low FPS detected: ${this.fps}`);
        }

        if (this.stats.frameTime > 33) { // 30fps以下
            console.warn(`High frame time: ${this.stats.frameTime.toFixed(2)}ms`);
        }

        this.monitorMemory();
    }

    // デバッグ情報の表示
    drawDebugInfo(ctx, x, y) {
        if (!CONFIG.DEBUG.SHOW_FPS) return;

        const info = this.getPerformanceInfo();
        const lines = [
            `FPS: ${info.fps} (Avg: ${info.averageFPS})`,
            `Quality: ${info.quality}`,
            `Frame: ${info.frameTime}`,
            `Memory: ${info.memory ? `${info.memory.used}MB` : 'N/A'}`
        ];

        ctx.save();
        ctx.font = '12px Share Tech Mono';
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        ctx.textAlign = 'left';

        lines.forEach((line, index) => {
            ctx.fillText(line, x, y + index * 15);
        });

        ctx.restore();
    }
}


// フレームレート制御
class FrameRateController {
    constructor(targetFPS = 60) {
        this.targetFPS = targetFPS;
        this.targetFrameTime = 1000 / targetFPS;
        this.lastFrameTime = 0;
        this.frameTimeBuffer = [];
        this.maxBufferSize = 10;
    }

    // フレーム制御
    shouldUpdate(currentTime) {
        const elapsed = currentTime - this.lastFrameTime;

        if (elapsed >= this.targetFrameTime) {
            this.frameTimeBuffer.push(elapsed);
            if (this.frameTimeBuffer.length > this.maxBufferSize) {
                this.frameTimeBuffer.shift();
            }

            this.lastFrameTime = currentTime;
            return true;
        }

        return false;
    }

    // 適応的フレームレート調整
    adjustFrameRate(currentFPS) {
        if (currentFPS < this.targetFPS * 0.8) {
            // FPSが低い場合は目標を下げる
            this.targetFPS = Math.max(30, this.targetFPS - 5);
            this.targetFrameTime = 1000 / this.targetFPS;
        } else if (currentFPS > this.targetFPS * 1.1) {
            // FPSが高い場合は目標を上げる
            this.targetFPS = Math.min(60, this.targetFPS + 5);
            this.targetFrameTime = 1000 / this.targetFPS;
        }
    }

    // 平均フレーム時間の取得
    getAverageFrameTime() {
        if (this.frameTimeBuffer.length === 0) return this.targetFrameTime;

        const sum = this.frameTimeBuffer.reduce((a, b) => a + b, 0);
        return sum / this.frameTimeBuffer.length;
    }
}

// メモリプール（オブジェクトの再利用）
class MemoryPool {
    constructor(createFn, resetFn, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.inUse = new Set();

        // 初期オブジェクトの作成
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }

    // オブジェクトの取得
    acquire(...args) {
        let obj;

        if (this.pool.length > 0) {
            obj = this.pool.pop();
            this.resetFn(obj, ...args);
        } else {
            obj = this.createFn(...args);
        }

        this.inUse.add(obj);
        return obj;
    }

    // オブジェクトの返却
    release(obj) {
        if (this.inUse.has(obj)) {
            this.inUse.delete(obj);
            this.pool.push(obj);
            return true;
        }
        return false;
    }

    // プールの統計情報
    getStats() {
        return {
            poolSize: this.pool.length,
            inUse: this.inUse.size,
            total: this.pool.length + this.inUse.size
        };
    }

    // プールのクリア
    clear() {
        this.pool = [];
        this.inUse.clear();
    }
}

// バッチ処理システム
class BatchProcessor {
    constructor(batchSize = 50) {
        this.batchSize = batchSize;
        this.processingQueue = [];
    }

    // 処理をバッチに追加
    addToBatch(item) {
        this.processingQueue.push(item);
    }

    // バッチ処理の実行
    processBatch(processFn) {
        const itemsToProcess = this.processingQueue.splice(0, this.batchSize);

        if (itemsToProcess.length > 0) {
            processFn(itemsToProcess);
        }

        return this.processingQueue.length > 0; // まだ処理すべきアイテムがあるか
    }

    // キューのクリア
    clear() {
        this.processingQueue = [];
    }

    // キューサイズの取得
    getQueueSize() {
        return this.processingQueue.length;
    }
}