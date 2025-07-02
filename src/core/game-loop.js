// ゲームループシステム
class GameLoop {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;

        // タイミング管理
        this.targetFPS = CONFIG.GAME.TARGET_FPS;
        this.frameTime = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.accumulator = 0;
        this.maxFrameTime = 1000 / 20; // 20FPS minimum

        // フレーム制御
        this.frameCount = 0;
        this.skipFrames = 0;
        this.maxSkipFrames = 5;

        // システム参照
        this.renderer = null;
        this.physicsEngine = null;
        this.performanceMonitor = null;
        this.inputHandler = null;

        // 更新頻度制御
        this.updateFrequency = CONFIG.PERFORMANCE.UPDATE_FREQUENCY;
        this.updateCounter = 0;

        // ゲーム状態
        this.gameObjects = {
            balls: [],
            pegs: [],
            slots: []
        };

        // パフォーマンス統計
        this.performanceStats = {
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            physicsTime: 0,
            particleTime: 0,
            totalTime: 0
        };

        console.log('🔄 Game loop initialized');
    }

    /**
     * ゲームループの初期化
     */
    initialize(renderer, physicsEngine, performanceMonitor, inputHandler) {
        this.renderer = renderer;
        this.physicsEngine = physicsEngine;
        this.performanceMonitor = performanceMonitor;
        this.inputHandler = inputHandler;

        // ゲームオブジェクトの参照設定
        this.gameObjects.balls = GameState.balls;
        this.gameObjects.pegs = GameState.pegs;
        this.gameObjects.slots = GameState.slots;

        console.log('🎮 Game loop systems connected');
    }

    /**
     * ゲームループ開始
     */
    start() {
        if (this.isRunning) {
            console.warn('Game loop is already running');
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;

        console.log('▶️ Game loop started');
        this.loop();
    }

    /**
     * ゲームループ停止
     */
    stop() {
        this.isRunning = false;
        this.isPaused = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        console.log('⏹️ Game loop stopped');
    }

    /**
     * ゲームループ一時停止
     */
    pause() {
        this.isPaused = true;
        console.log('⏸️ Game loop paused');
    }

    /**
     * ゲームループ再開
     */
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.lastFrameTime = performance.now();
            console.log('▶️ Game loop resumed');
        }
    }

    /**
     * メインゲームループ
     */
    loop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const frameStartTime = currentTime;

        // パフォーマンス監視開始
        if (this.performanceMonitor) {
            this.performanceMonitor.startFrame();
        }

        // デルタタイム計算
        this.deltaTime = Math.min(currentTime - this.lastFrameTime, this.maxFrameTime);
        this.lastFrameTime = currentTime;

        // 一時停止チェック
        if (!this.isPaused && !GameState.isPaused) {
            // フレームスキップ制御
            if (this.shouldSkipFrame()) {
                this.skipFrames++;
                if (this.skipFrames < this.maxSkipFrames) {
                    this.scheduleNextFrame();
                    return;
                }
            }

            this.skipFrames = 0;

            // ゲーム更新
            this.update(this.deltaTime);
        }

        // レンダリング（一時停止中でも実行）
        this.render();

        // フレーム統計更新
        this.updateFrameStats(frameStartTime);

        // パフォーマンス監視終了
        if (this.performanceMonitor) {
            this.performanceMonitor.endFrame();
        }

        // 次フレームのスケジュール
        this.scheduleNextFrame();
    }

    /**
     * ゲーム状態更新
     */
    update(deltaTime) {
        const updateStartTime = performance.now();

        // 更新頻度制御
        this.updateCounter++;
        if (this.updateCounter % this.updateFrequency !== 0) {
            return;
        }

        // 入力処理
        if (this.inputHandler) {
            this.inputHandler.update();
        }

        // 物理演算
        this.updatePhysics(deltaTime);

        // ゲームオブジェクト更新
        this.updateGameObjects(deltaTime);

        // パーティクルシステム更新
        this.updateParticles(deltaTime);

        // エフェクト更新
        this.updateEffects(deltaTime);

        // ゲーム状態管理
        this.updateGameState(deltaTime);

        // オブジェクトプール管理
        this.updateObjectPools();

        // パフォーマンス統計
        this.performanceStats.updateTime = performance.now() - updateStartTime;
    }

    /**
     * 物理演算更新
     */
    updatePhysics(deltaTime) {
        if (!this.physicsEngine) return;

        const physicsStartTime = performance.now();

        // アクティブなオブジェクトのみを物理演算対象とする
        const activeObjects = [
            ...this.gameObjects.balls.filter(ball => ball.isActive),
            ...this.gameObjects.pegs.filter(peg => peg.isActive),
            ...this.gameObjects.slots.filter(slot => slot.isActive)
        ];

        // 物理演算実行
        this.physicsEngine.update(activeObjects, deltaTime);

        this.performanceStats.physicsTime = performance.now() - physicsStartTime;
    }

    /**
     * ゲームオブジェクト更新
     */
    updateGameObjects(deltaTime) {
        // ボールの更新
        this.updateBalls(deltaTime);

        // ペグの更新
        this.updatePegs(deltaTime);

        // スロットの更新
        this.updateSlots(deltaTime);

        // 非アクティブオブジェクトのクリーンアップ
        this.cleanupInactiveObjects();
    }

    /**
     * ボール更新
     */
    updateBalls(deltaTime) {
        for (let i = this.gameObjects.balls.length - 1; i >= 0; i--) {
            const ball = this.gameObjects.balls[i];

            if (ball.isActive) {
                ball.update(deltaTime);

                // 画面外チェック
                if (ball.y > CONFIG.GAME.CANVAS_HEIGHT + 100) {
                    this.removeBall(ball, i);
                }
            } else {
                this.removeBall(ball, i);
            }
        }
    }

    /**
     * ペグ更新
     */
    updatePegs(deltaTime) {
        this.gameObjects.pegs.forEach(peg => {
            if (peg.update) {
                peg.update(deltaTime);
            }
        });
    }

    /**
     * スロット更新
     */
    updateSlots(deltaTime) {
        this.gameObjects.slots.forEach(slot => {
            if (slot.update) {
                slot.update(deltaTime);
            }
        });
    }

    /**
     * ボール削除
     */
    removeBall(ball, index) {
        // プールに返却
        const ballPool = window.poolManager?.getPool('ball');
        if (ballPool) {
            ballPool.release(ball);
        }

        // 配列から削除
        this.gameObjects.balls.splice(index, 1);

        // ゲーム終了チェック
        if (GameState.ballCount <= 0 && this.gameObjects.balls.length === 0) {
            this.handleGameEnd();
        }
    }

    /**
     * パーティクル更新
     */
    updateParticles(deltaTime) {
        if (!window.particleSystem) return;

        const particleStartTime = performance.now();

        window.particleSystem.update();

        // プールを使用した最適化
        const particlePool = window.poolManager?.getPool('particle');
        if (particlePool) {
            window.particleSystem.particles = particlePool.updateAndCleanup(
                window.particleSystem.particles
            );
        }

        this.performanceStats.particleTime = performance.now() - particleStartTime;
    }

    /**
     * エフェクト更新
     */
    updateEffects(deltaTime) {
        // 画面揺れ
        if (window.screenShake) {
            window.screenShake.update();
        }

        // その他のエフェクト
        // ...
    }

    /**
     * ゲーム状態管理
     */
    updateGameState(deltaTime) {
        // パフォーマンス統計の更新
        GameState.updatePerformanceStats();

        // ゲーム終了条件のチェック
        this.checkGameEndConditions();

        // 自動保存（一定間隔）
        this.handleAutoSave();
    }

    /**
     * オブジェクトプール管理
     */
    updateObjectPools() {
        if (window.poolManager) {
            // 定期クリーンアップ
            window.poolManager.performPeriodicCleanup();

            // メモリ圧迫時の緊急クリーンアップ
            const memoryUsage = Utils.Performance.getMemoryUsage();
            if (memoryUsage && memoryUsage.used > memoryUsage.limit * 0.9) {
                window.poolManager.emergencyCleanup();
            }
        }
    }

    /**
     * 非アクティブオブジェクトのクリーンアップ
     */
    cleanupInactiveObjects() {
        // 低頻度でクリーンアップ実行
        if (this.frameCount % 300 === 0) { // 5秒ごと（60FPS想定）
            const initialBallCount = this.gameObjects.balls.length;

            // 非アクティブボールの削除
            GameState.cleanupInactiveBalls();

            const cleanedCount = initialBallCount - this.gameObjects.balls.length;
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} inactive balls`);
            }
        }
    }

    /**
     * レンダリング
     */
    render() {
        if (!this.renderer) return;

        const renderStartTime = performance.now();

        // メインレンダリング
        this.renderer.render();

        // デバッグ情報の描画
        if (CONFIG.DEBUG.SHOW_FPS) {
            this.drawDebugInfo();
        }

        this.performanceStats.renderTime = performance.now() - renderStartTime;
    }

    /**
     * デバッグ情報描画
     */
    drawDebugInfo() {
        const ctx = this.renderer.ctx;

        // 物理エンジンのデバッグ情報
        if (this.physicsEngine && this.physicsEngine.drawDebugInfo) {
            this.physicsEngine.drawDebugInfo(ctx);
        }

        // 入力ハンドラーのデバッグ情報
        if (this.inputHandler && this.inputHandler.drawDebugInfo) {
            this.inputHandler.drawDebugInfo(ctx);
        }

        // パフォーマンス統計
        this.drawPerformanceStats(ctx);
    }

    /**
     * パフォーマンス統計描画
     */
    drawPerformanceStats(ctx) {
        const stats = this.performanceStats;
        const lines = [
            `Frame: ${stats.frameTime.toFixed(1)}ms`,
            `Update: ${stats.updateTime.toFixed(1)}ms`,
            `Physics: ${stats.physicsTime.toFixed(1)}ms`,
            `Render: ${stats.renderTime.toFixed(1)}ms`,
            `Particles: ${stats.particleTime.toFixed(1)}ms`,
            `Objects: ${this.gameObjects.balls.length}B ${this.gameObjects.pegs.length}P`
        ];

        ctx.save();
        ctx.font = '10px Share Tech Mono';
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        ctx.textAlign = 'left';
        ctx.globalAlpha = 0.8;

        // 背景
        const bgWidth = 120;
        const bgHeight = lines.length * 12 + 10;
        ctx.fillStyle = Utils.Color.addAlpha('#000000', 0.7);
        ctx.fillRect(5, CONFIG.GAME.CANVAS_HEIGHT - bgHeight - 5, bgWidth, bgHeight);

        // テキスト
        ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        lines.forEach((line, index) => {
            ctx.fillText(line, 10, CONFIG.GAME.CANVAS_HEIGHT - bgHeight + 15 + index * 12);
        });

        ctx.restore();
    }

    /**
     * フレーム統計更新
     */
    updateFrameStats(frameStartTime) {
        this.frameCount++;
        this.performanceStats.frameTime = performance.now() - frameStartTime;
        this.performanceStats.totalTime += this.performanceStats.frameTime;

        // FPS計算
        if (this.performanceMonitor) {
            Utils.Performance.updateFPS();
        }
    }

    /**
     * フレームスキップ判定
     */
    shouldSkipFrame() {
        // パフォーマンス低下時のフレームスキップ
        const avgFrameTime = this.performanceStats.totalTime / this.frameCount;
        return avgFrameTime > this.frameTime * 1.5; // 目標の1.5倍を超えた場合
    }

    /**
     * 次フレームのスケジュール
     */
    scheduleNextFrame() {
        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        }
    }

    /**
     * ゲーム終了処理
     */
    handleGameEnd() {
        if (GameState.isGameOver) return;

        console.log('🎯 Game ended');
        GameState.endGame();

        // 終了エフェクト
        this.playGameEndEffects();
    }

    /**
     * ゲーム終了エフェクト
     */
    playGameEndEffects() {
        // 大きな爆発エフェクト
        if (window.particleSystem) {
            const centerX = CONFIG.GAME.CANVAS_WIDTH / 2;
            const centerY = CONFIG.GAME.CANVAS_HEIGHT / 2;

            window.particleSystem.createExplosion(
                centerX, centerY, CONFIG.COLORS.PRIMARY, 5.0
            );

            // 複数の小爆発
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const x = centerX + (Math.random() - 0.5) * 200;
                    const y = centerY + (Math.random() - 0.5) * 200;
                    window.particleSystem.createExplosion(x, y, CONFIG.COLORS.SECONDARY, 2.0);
                }, i * 300);
            }
        }

        // 画面揺れ
        if (window.screenShake) {
            window.screenShake.shake(8, 60);
        }
    }

    /**
     * ゲーム終了条件チェック
     */
    checkGameEndConditions() {
        // ボールが残っておらず、投下可能なボールもない場合
        if (GameState.ballCount <= 0 && this.gameObjects.balls.length === 0) {
            if (!GameState.isGameOver) {
                this.handleGameEnd();
            }
        }

        // パフォーマンス低下による強制終了
        if (this.performanceStats.frameTime > 100) { // 100ms = 10FPS以下
            console.warn('⚠️ Performance too low, considering game end');
        }
    }

    /**
     * 自動保存処理
     */
    handleAutoSave() {
        // 30秒ごとに自動保存
        if (this.frameCount % (30 * this.targetFPS) === 0) {
            GameState.saveGameData();
        }
    }

    /**
     * 品質調整
     */
    adjustQuality(qualityLevel) {
        // レンダリング品質調整
        if (this.renderer) {
            this.renderer.adjustQuality(qualityLevel);
        }

        // 更新頻度調整
        this.updateFrequency = qualityLevel > 0.7 ? 1 : 2;

        // パーティクル数調整
        CONFIG.PERFORMANCE.MAX_PARTICLES = Math.floor(200 * qualityLevel);

        console.log(`🎚️ Quality adjusted to ${(qualityLevel * 100).toFixed(0)}%`);
    }

    /**
     * フレームレート制限設定
     */
    setTargetFPS(fps) {
        this.targetFPS = Math.max(20, Math.min(120, fps));
        this.frameTime = 1000 / this.targetFPS;

        console.log(`🎯 Target FPS set to ${this.targetFPS}`);
    }

    /**
     * ゲームループ統計取得
     */
    getLoopStats() {
        const avgFrameTime = this.frameCount > 0 ?
            this.performanceStats.totalTime / this.frameCount : 0;

        return {
            frameCount: this.frameCount,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            targetFPS: this.targetFPS,
            averageFrameTime: avgFrameTime,
            currentFPS: avgFrameTime > 0 ? 1000 / avgFrameTime : 0,
            skipFrames: this.skipFrames,
            updateFrequency: this.updateFrequency,
            performance: { ...this.performanceStats },
            objectCounts: {
                balls: this.gameObjects.balls.length,
                pegs: this.gameObjects.pegs.length,
                slots: this.gameObjects.slots.length,
                particles: window.particleSystem ? window.particleSystem.getParticleCount() : 0
            }
        };
    }

    /**
     * 緊急停止
     */
    emergencyStop() {
        console.warn('🚨 Emergency stop triggered');

        this.stop();

        // エラー状態の表示
        const errorOverlay = document.createElement('div');
        errorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 0, 0.8);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Share Tech Mono', monospace;
            font-size: 18px;
            z-index: 10000;
            text-align: center;
        `;

        errorOverlay.innerHTML = `
            <div>
                <h2>⚠️ ゲームが緊急停止しました</h2>
                <p>パフォーマンスの問題が発生しました。</p>
                <button onclick="location.reload()" style="
                    background: white;
                    color: red;
                    border: none;
                    padding: 10px 20px;
                    font-family: inherit;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 20px;
                ">ページを再読み込み</button>
            </div>
        `;

        document.body.appendChild(errorOverlay);
    }

    /**
     * パフォーマンス監視
     */
    monitorPerformance() {
        // メモリ使用量チェック
        const memoryUsage = Utils.Performance.getMemoryUsage();
        if (memoryUsage && memoryUsage.used > memoryUsage.limit * 0.95) {
            console.warn('🧠 Memory usage critical:', memoryUsage);
            this.handleMemoryPressure();
        }

        // フレームレート監視
        const avgFrameTime = this.performanceStats.totalTime / this.frameCount;
        if (avgFrameTime > this.frameTime * 3) { // 目標の3倍を超えた場合
            console.warn('📉 Frame rate critically low');
            this.handleLowFrameRate();
        }
    }

    /**
     * メモリ圧迫時の処理
     */
    handleMemoryPressure() {
        // 緊急クリーンアップ
        if (window.poolManager) {
            window.poolManager.emergencyCleanup();
        }

        // パーティクル数削減
        if (window.particleSystem) {
            window.particleSystem.clear();
        }

        // 品質低下
        this.adjustQuality(0.3);

        console.log('🧹 Emergency memory cleanup performed');
    }

    /**
     * 低フレームレート時の処理
     */
    handleLowFrameRate() {
        // 更新頻度削減
        this.updateFrequency = Math.max(this.updateFrequency, 3);

        // エフェクト無効化
        CONFIG.EFFECTS.ENABLE_TRAILS = false;
        CONFIG.EFFECTS.ENABLE_GLOW = false;

        // パーティクル数削減
        CONFIG.PERFORMANCE.MAX_PARTICLES = 25;

        console.log('⚡ Low frame rate optimizations applied');
    }

    /**
     * デバッグコマンド
     */
    enableDebugMode() {
        // デバッグ用のグローバル関数を追加
        window.gameLoop = {
            stats: () => this.getLoopStats(),
            adjustQuality: (level) => this.adjustQuality(level),
            setFPS: (fps) => this.setTargetFPS(fps),
            emergencyStop: () => this.emergencyStop(),
            pause: () => this.pause(),
            resume: () => this.resume(),
            restart: () => {
                this.stop();
                setTimeout(() => this.start(), 100);
            }
        };

        console.log('🐛 Debug mode enabled. Use window.gameLoop for debugging.');
    }

    /**
     * リセット処理
     */
    reset() {
        // 統計リセット
        this.frameCount = 0;
        this.skipFrames = 0;
        this.updateCounter = 0;
        this.performanceStats = {
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            physicsTime: 0,
            particleTime: 0,
            totalTime: 0
        };

        // ゲームオブジェクト参照更新
        this.gameObjects.balls = GameState.balls;
        this.gameObjects.pegs = GameState.pegs;
        this.gameObjects.slots = GameState.slots;

        console.log('🔄 Game loop reset');
    }

    /**
     * 破棄処理
     */
    destroy() {
        this.stop();

        // 参照クリア
        this.renderer = null;
        this.physicsEngine = null;
        this.performanceMonitor = null;
        this.inputHandler = null;

        this.gameObjects = {
            balls: [],
            pegs: [],
            slots: []
        };

        console.log('💥 Game loop destroyed');
    }
}

// グローバルゲームループインスタンス
window.gameLoop = null;