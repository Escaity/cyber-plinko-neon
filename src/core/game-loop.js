// 再構築ゲームループ - シンプルで安定した実装
class GameLoop {
    constructor() {
        // 基本状態
        this.isRunning = false;
        this.isPaused = false;
        this.animationFrameId = null;

        // タイミング管理
        this.targetFPS = CONFIG.GAME.TARGET_FPS;
        this.lastFrameTime = 0;
        this.deltaTime = 0;
        this.frameCount = 0;

        // システム参照
        this.renderer = null;
        this.physicsEngine = null;
        this.performanceMonitor = null;
        this.inputHandler = null;

        // パフォーマンス統計
        this.stats = {
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            fps: 0,
            frameCount: 0
        };

        // エラーハンドリング
        this.errorCount = 0;
        this.maxErrors = 5;

        console.log('🔄 Game loop rebuilt and initialized');
    }

    /**
     * システム初期化
     */
    initialize(renderer, physicsEngine, performanceMonitor, inputHandler) {
        this.renderer = renderer;
        this.physicsEngine = physicsEngine;
        this.performanceMonitor = performanceMonitor;
        this.inputHandler = inputHandler;

        console.log('🎮 Game loop systems connected');
        return true;
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
        this.errorCount = 0;

        console.log('▶️ Game loop started');
        this.requestNextFrame();
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
     * メインループ
     */
    loop() {
        if (!this.isRunning) {
            return;
        }

        try {
            const currentTime = performance.now();
            this.deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;
            this.frameCount++;

            // パフォーマンス監視開始
            this.stats.frameTime = currentTime;

            // 一時停止チェック
            if (!this.isPaused && !this.isGamePaused()) {
                this.update(this.deltaTime);
            }

            // レンダリング
            this.render();

            // 統計更新
            this.updateStats(currentTime);

            // エラーリセット（正常フレーム）
            if (this.errorCount > 0) {
                this.errorCount = Math.max(0, this.errorCount - 1);
            }

        } catch (error) {
            this.handleError(error);
        }

        // 次フレーム予約
        this.requestNextFrame();
    }

    /**
     * ゲーム更新
     */
    update(deltaTime) {
        const updateStart = performance.now();

        try {
            // 入力処理
            this.updateInput();

            // 物理演算
            this.updatePhysics(deltaTime);

            // ゲームオブジェクト更新
            this.updateGameObjects(deltaTime);

            // パーティクル更新
            this.updateParticles();

            // エフェクト更新
            this.updateEffects();

            // ゲーム状態更新
            this.updateGameState();

        } catch (error) {
            console.error('Update error:', error);
            this.errorCount++;
        }

        this.stats.updateTime = performance.now() - updateStart;
    }

    /**
     * 入力更新
     */
    updateInput() {
        if (this.inputHandler && this.inputHandler.update) {
            this.inputHandler.update();
        }
    }

    /**
     * 物理更新
     */
    updatePhysics(deltaTime) {
        if (!this.physicsEngine) return;

        try {
            // アクティブオブジェクトを取得
            const objects = this.getActiveObjects();

            if (objects.length > 0) {
                this.physicsEngine.update(objects, deltaTime);
            }
        } catch (error) {
            console.error('Physics update error:', error);
        }
    }

    /**
     * アクティブオブジェクト取得
     */
    getActiveObjects() {
        const objects = [];

        try {
            // ボール
            if (GameState.balls && Array.isArray(GameState.balls)) {
                GameState.balls.forEach(ball => {
                    if (ball && ball.isActive) {
                        objects.push(ball);
                    }
                });
            }

            // ペグ
            if (GameState.pegs && Array.isArray(GameState.pegs)) {
                GameState.pegs.forEach(peg => {
                    if (peg && peg.isActive) {
                        objects.push(peg);
                    }
                });
            }

            // スロット
            if (GameState.slots && Array.isArray(GameState.slots)) {
                GameState.slots.forEach(slot => {
                    if (slot && slot.isActive) {
                        objects.push(slot);
                    }
                });
            }
        } catch (error) {
            console.error('Error getting active objects:', error);
        }

        return objects;
    }

    /**
     * ゲームオブジェクト更新
     */
    updateGameObjects(deltaTime) {
        try {
            // ボール更新
            this.updateBalls(deltaTime);

            // ペグ更新
            this.updatePegs(deltaTime);

            // スロット更新
            this.updateSlots(deltaTime);

            // クリーンアップ
            this.cleanupObjects();

        } catch (error) {
            console.error('Game objects update error:', error);
        }
    }

    /**
     * ボール更新
     */
    updateBalls(deltaTime) {
        if (!GameState.balls || !Array.isArray(GameState.balls)) {
            return;
        }

        for (let i = GameState.balls.length - 1; i >= 0; i--) {
            const ball = GameState.balls[i];

            if (!ball) {
                GameState.balls.splice(i, 1);
                continue;
            }

            try {
                if (ball.isActive) {
                    // ボール更新
                    if (ball.update) {
                        ball.update(deltaTime);
                    }

                    // 画面外チェック
                    if (ball.y > CONFIG.GAME.CANVAS_HEIGHT + 100) {
                        this.removeBall(ball, i);
                    }
                } else {
                    this.removeBall(ball, i);
                }
            } catch (error) {
                console.error('Ball update error:', error);
                this.removeBall(ball, i);
            }
        }
    }

    /**
     * ボール削除
     */
    removeBall(ball, index) {
        try {
            // プールに返却
            if (ball && ball.isPooled && window.poolManager) {
                const ballPool = window.poolManager.getPool('ball');
                if (ballPool) {
                    ballPool.release(ball);
                }
            }

            // 配列から削除
            GameState.balls.splice(index, 1);

            // ゲーム終了チェック
            if (GameState.ballCount <= 0 && GameState.balls.length === 0) {
                this.handleGameEnd();
            }

        } catch (error) {
            console.error('Error removing ball:', error);
            // 最低限の削除
            GameState.balls.splice(index, 1);
        }
    }

    /**
     * ペグ更新
     */
    updatePegs(deltaTime) {
        if (!GameState.pegs || !Array.isArray(GameState.pegs)) {
            return;
        }

        GameState.pegs.forEach(peg => {
            if (peg && peg.update) {
                try {
                    peg.update(deltaTime);
                } catch (error) {
                    console.error('Peg update error:', error);
                }
            }
        });
    }

    /**
     * スロット更新
     */
    updateSlots(deltaTime) {
        if (!GameState.slots || !Array.isArray(GameState.slots)) {
            return;
        }

        GameState.slots.forEach(slot => {
            if (slot && slot.update) {
                try {
                    slot.update(deltaTime);
                } catch (error) {
                    console.error('Slot update error:', error);
                }
            }
        });
    }

    /**
     * パーティクル更新
     */
    updateParticles() {
        if (window.particleSystem && window.particleSystem.update) {
            try {
                window.particleSystem.update();
            } catch (error) {
                console.error('Particle system error:', error);
            }
        }
    }

    /**
     * エフェクト更新
     */
    updateEffects() {
        try {
            // 画面揺れ
            if (window.screenShake && window.screenShake.update) {
                window.screenShake.update();
            }

            // プール管理
            if (window.poolManager && window.poolManager.performPeriodicCleanup) {
                window.poolManager.performPeriodicCleanup();
            }
        } catch (error) {
            console.error('Effects update error:', error);
        }
    }

    /**
     * ゲーム状態更新
     */
    updateGameState() {
        try {
            // パフォーマンス統計更新
            if (GameState.updatePerformanceStats) {
                GameState.updatePerformanceStats();
            }

            // 自動保存
            if (this.frameCount % (30 * 60) === 0) { // 30秒ごと
                if (GameState.saveGameData) {
                    GameState.saveGameData();
                }
            }
        } catch (error) {
            console.error('Game state update error:', error);
        }
    }

    /**
     * オブジェクトクリーンアップ
     */
    cleanupObjects() {
        // 定期的なクリーンアップ
        if (this.frameCount % 300 === 0) { // 5秒ごと
            try {
                if (GameState.cleanupInactiveBalls) {
                    GameState.cleanupInactiveBalls();
                }
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }
    }

    /**
     * レンダリング
     */
    render() {
        const renderStart = performance.now();

        try {
            if (this.renderer && this.renderer.render) {
                this.renderer.render();
            }

            // デバッグ情報
            if (CONFIG.DEBUG.SHOW_FPS) {
                this.drawDebugInfo();
            }

        } catch (error) {
            console.error('Render error:', error);
            this.errorCount++;
        }

        this.stats.renderTime = performance.now() - renderStart;
    }

    /**
     * デバッグ情報描画
     */
    drawDebugInfo() {
        if (!this.renderer || !this.renderer.ctx) return;

        try {
            const ctx = this.renderer.ctx;
            const stats = this.getLoopStats();

            const lines = [
                `FPS: ${stats.fps}`,
                `Frame: ${stats.frameTime.toFixed(1)}ms`,
                `Update: ${stats.updateTime.toFixed(1)}ms`,
                `Render: ${stats.renderTime.toFixed(1)}ms`,
                `Balls: ${GameState.balls ? GameState.balls.length : 0}`,
                `Errors: ${this.errorCount}`
            ];

            ctx.save();
            ctx.font = '10px Share Tech Mono';
            ctx.fillStyle = CONFIG.COLORS.PRIMARY;
            ctx.textAlign = 'left';
            ctx.globalAlpha = 0.8;

            // 背景
            const bgWidth = 120;
            const bgHeight = lines.length * 12 + 10;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(5, CONFIG.GAME.CANVAS_HEIGHT - bgHeight - 5, bgWidth, bgHeight);

            // テキスト
            ctx.fillStyle = CONFIG.COLORS.PRIMARY;
            lines.forEach((line, index) => {
                ctx.fillText(line, 10, CONFIG.GAME.CANVAS_HEIGHT - bgHeight + 15 + index * 12);
            });

            ctx.restore();
        } catch (error) {
            console.error('Debug info draw error:', error);
        }
    }

    /**
     * 統計更新
     */
    updateStats(currentTime) {
        this.stats.frameTime = currentTime - this.stats.frameTime;
        this.stats.frameCount = this.frameCount;

        // FPS計算（1秒ごと）
        if (this.frameCount % 60 === 0) {
            this.stats.fps = Math.round(1000 / (this.stats.frameTime || 16.67));

            // UI更新
            if (typeof Utils !== 'undefined' && Utils.DOM && Utils.DOM.setText) {
                Utils.DOM.setText('fps', this.stats.fps);
            }
        }
    }

    /**
     * エラーハンドリング
     */
    handleError(error) {
        this.errorCount++;
        console.error(`Game loop error #${this.errorCount}:`, error);

        if (this.errorCount >= this.maxErrors) {
            console.error('🚨 Too many errors, stopping game loop');
            this.emergencyStop();
        }
    }

    /**
     * 緊急停止
     */
    emergencyStop() {
        this.stop();

        // エラー表示
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: 'Share Tech Mono', monospace;
            text-align: center;
            z-index: 10000;
        `;

        errorDiv.innerHTML = `
            <h3>⚠️ ゲームエラー</h3>
            <p>システムエラーが発生しました。</p>
            <p>エラー数: ${this.errorCount}</p>
            <button onclick="location.reload()" style="
                background: white;
                color: red;
                border: none;
                padding: 10px 20px;
                margin-top: 10px;
                border-radius: 5px;
                cursor: pointer;
            ">再読み込み</button>
        `;

        document.body.appendChild(errorDiv);
    }

    /**
     * ゲーム終了処理
     */
    handleGameEnd() {
        if (GameState.isGameOver) return;

        console.log('🎯 Game ended');

        try {
            if (GameState.endGame) {
                GameState.endGame();
            }

            // 終了エフェクト
            this.playGameEndEffects();
        } catch (error) {
            console.error('Game end error:', error);
        }
    }

    /**
     * ゲーム終了エフェクト
     */
    playGameEndEffects() {
        try {
            if (window.particleSystem) {
                const centerX = CONFIG.GAME.CANVAS_WIDTH / 2;
                const centerY = CONFIG.GAME.CANVAS_HEIGHT / 2;
                window.particleSystem.createExplosion(centerX, centerY, CONFIG.COLORS.PRIMARY, 3.0);
            }

            if (window.screenShake) {
                window.screenShake.shake(5, 40);
            }
        } catch (error) {
            console.error('Game end effects error:', error);
        }
    }

    /**
     * ゲーム一時停止状態チェック
     */
    isGamePaused() {
        return GameState && (GameState.isPaused || GameState.isGameOver);
    }

    /**
     * 次フレーム要求
     */
    requestNextFrame() {
        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        }
    }

    /**
     * 品質調整
     */
    adjustQuality(qualityLevel) {
        try {
            // レンダリング品質
            if (this.renderer && this.renderer.adjustQuality) {
                this.renderer.adjustQuality(qualityLevel);
            }

            // パーティクル数
            CONFIG.PERFORMANCE.MAX_PARTICLES = Math.floor(200 * qualityLevel);

            console.log(`Quality adjusted to ${(qualityLevel * 100).toFixed(0)}%`);
        } catch (error) {
            console.error('Quality adjustment error:', error);
        }
    }

    /**
     * ゲームループ統計取得
     */
    getLoopStats() {
        return {
            frameCount: this.frameCount,
            fps: this.stats.fps,
            frameTime: this.stats.frameTime,
            updateTime: this.stats.updateTime,
            renderTime: this.stats.renderTime,
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            errorCount: this.errorCount,
            objectCounts: {
                balls: GameState.balls ? GameState.balls.length : 0,
                pegs: GameState.pegs ? GameState.pegs.length : 0,
                slots: GameState.slots ? GameState.slots.length : 0
            }
        };
    }

    /**
     * リセット
     */
    reset() {
        this.frameCount = 0;
        this.errorCount = 0;
        this.stats = {
            frameTime: 0,
            updateTime: 0,
            renderTime: 0,
            fps: 0,
            frameCount: 0
        };

        console.log('🔄 Game loop reset');
    }

    /**
     * 破棄
     */
    destroy() {
        this.stop();

        this.renderer = null;
        this.physicsEngine = null;
        this.performanceMonitor = null;
        this.inputHandler = null;

        console.log('💥 Game loop destroyed');
    }

    /**
     * デバッグコマンド有効化
     */
    enableDebugMode() {
        window.gameLoopDebug = {
            stats: () => this.getLoopStats(),
            pause: () => this.pause(),
            resume: () => this.resume(),
            stop: () => this.stop(),
            start: () => this.start(),
            adjustQuality: (level) => this.adjustQuality(level),
            forceError: () => { throw new Error('Debug: Forced error'); },
            reset: () => this.reset()
        };

        console.log('🐛 Debug mode enabled. Use window.gameLoopDebug');
    }
}

// グローバルゲームループインスタンス
window.gameLoop = null;

// 初期化ヘルパー
function initializeGameLoop() {
    if (window.gameLoop) {
        window.gameLoop.destroy();
    }

    window.gameLoop = new GameLoop();

    if (CONFIG.DEBUG.SHOW_FPS) {
        window.gameLoop.enableDebugMode();
    }

    return window.gameLoop;
}