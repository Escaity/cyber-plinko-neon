// ゲーム状態管理システム
const GameState = {
    // ゲームデータ
    score: 0,
    ballCount: CONFIG.GAME.INITIAL_BALL_COUNT,
    highScore: 0,
    totalBallsDropped: 0,

    // ゲームオブジェクト
    balls: [],
    pegs: [],
    slots: [],

    // 入力状態
    mouseX: CONFIG.GAME.CANVAS_WIDTH / 2,
    mouseY: 0,
    isMousePressed: false,

    // ゲーム状態
    gameState: 'playing', // 'playing', 'paused', 'gameOver', 'menu'
    isPaused: false,
    isGameOver: false,

    // 統計情報
    stats: {
        totalScore: 0,
        totalBalls: 0,
        averageScore: 0,
        bestRun: 0,
        sessionsPlayed: 0,
        totalPlayTime: 0,
        slotHitCounts: new Array(CONFIG.SLOT.COUNT).fill(0),
        startTime: Date.now()
    },

    // パフォーマンス追跡
    performance: {
        activeBallCount: 0,
        frameCount: 0,
        lastUpdate: Date.now()
    },

    /**
     * ゲーム状態の初期化
     */
    initialize() {
        this.loadGameData();
        this.resetGame();
        console.log('GameState initialized');
    },

    /**
     * スコア更新
     */
    updateScore(points) {
        this.score += points;
        this.stats.totalScore += points;

        // ハイスコア更新
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.stats.bestRun = this.score;
        }

        // 平均スコア計算
        if (this.stats.totalBalls > 0) {
            this.stats.averageScore = Math.round(this.stats.totalScore / this.stats.totalBalls);
        }

        // UI更新
        this.updateScoreDisplay();

        // スコアイベントの発火
        this.onScoreUpdate(points);
    },

    /**
     * スコア表示の更新
     */
    updateScoreDisplay() {
        Utils.DOM.setText('score', this.score.toLocaleString());

        // ハイスコア表示（将来の実装用）
        if (document.getElementById('highScore')) {
            Utils.DOM.setText('highScore', this.highScore.toLocaleString());
        }
    },

    /**
     * ボール数の減少
     */
    decrementBallCount() {
        this.ballCount--;
        this.totalBallsDropped++;
        this.stats.totalBalls++;

        Utils.DOM.setText('ballCount', this.ballCount);

        // ゲーム終了判定
        if (this.ballCount <= 0 && this.balls.length === 0) {
            this.endGame();
        }

        // パフォーマンス統計更新
        this.performance.activeBallCount = this.balls.filter(ball => ball.isActive).length;
    },

    /**
     * ボール追加
     */
    addBall(ball) {
        // 最大ボール数制限
        if (this.balls.length >= CONFIG.GAME.MAX_BALLS_ON_SCREEN) {
            console.warn('Maximum ball limit reached');
            return false;
        }

        this.balls.push(ball);
        this.performance.activeBallCount = this.balls.filter(ball => ball.isActive).length;
        return true;
    },

    /**
     * ボール削除
     */
    removeBall(ball) {
        const index = this.balls.indexOf(ball);
        if (index > -1) {
            this.balls.splice(index, 1);
            this.performance.activeBallCount = this.balls.filter(ball => ball.isActive).length;
            return true;
        }
        return false;
    },

    /**
     * 非アクティブなボールのクリーンアップ
     */
    cleanupInactiveBalls() {
        const initialLength = this.balls.length;
        this.balls = this.balls.filter(ball => ball.isActive);

        const removed = initialLength - this.balls.length;
        if (removed > 0) {
            this.performance.activeBallCount = this.balls.length;
        }

        return removed;
    },

    /**
     * スロットヒット記録
     */
    recordSlotHit(slotIndex, points) {
        if (slotIndex >= 0 && slotIndex < this.stats.slotHitCounts.length) {
            this.stats.slotHitCounts[slotIndex]++;
        }

        // スロットヒットイベント
        this.onSlotHit(slotIndex, points);
    },

    /**
     * ゲームリセット
     */
    resetGame() {
        this.score = 0;
        this.ballCount = CONFIG.GAME.INITIAL_BALL_COUNT;
        this.balls = [];
        this.isGameOver = false;
        this.isPaused = false;
        this.gameState = 'playing';

        // 統計リセット（セッション統計は保持）
        this.stats.startTime = Date.now();
        this.stats.sessionsPlayed++;

        // UI更新
        this.updateScoreDisplay();
        Utils.DOM.setText('ballCount', this.ballCount);

        // オブジェクトリセット
        this.resetGameObjects();

        console.log('Game reset');
    },

    /**
     * ゲームオブジェクトのリセット
     */
    resetGameObjects() {
        // ペグのリセット
        this.pegs.forEach(peg => {
            if (peg.reset) peg.reset();
        });

        // スロットのリセット
        this.slots.forEach(slot => {
            if (slot.reset) slot.reset();
        });

        // パーティクルシステムのクリア
        if (window.particleSystem) {
            window.particleSystem.clear();
        }
    },

    /**
     * ゲーム終了
     */
    endGame() {
        this.isGameOver = true;
        this.gameState = 'gameOver';

        // プレイ時間計算
        const playTime = Date.now() - this.stats.startTime;
        this.stats.totalPlayTime += playTime;

        // 統計更新
        this.updateGameStats();

        // データ保存
        this.saveGameData();

        // ゲーム終了イベント
        this.onGameEnd();

        console.log('Game ended. Final score:', this.score);
    },

    /**
     * ゲーム一時停止
     */
    pauseGame() {
        this.isPaused = !this.isPaused;
        this.gameState = this.isPaused ? 'paused' : 'playing';

        console.log('Game', this.isPaused ? 'paused' : 'resumed');
    },

    /**
     * 統計更新
     */
    updateGameStats() {
        // 最高スコア更新
        if (this.score > this.stats.bestRun) {
            this.stats.bestRun = this.score;
        }

        // 平均スコア計算
        if (this.stats.sessionsPlayed > 0) {
            this.stats.averageScore = Math.round(this.stats.totalScore / this.stats.sessionsPlayed);
        }
    },

    /**
     * ゲームデータの保存
     */
    saveGameData() {
        if (typeof Storage === 'undefined') return;

        const saveData = {
            highScore: this.highScore,
            stats: this.stats,
            version: '2.1'
        };

        try {
            localStorage.setItem('cyberPlinko_saveData', JSON.stringify(saveData));
        } catch (e) {
            console.warn('Could not save game data:', e);
        }
    },

    /**
     * ゲームデータの読み込み
     */
    loadGameData() {
        if (typeof Storage === 'undefined') return;

        try {
            const saveData = localStorage.getItem('cyberPlinko_saveData');
            if (saveData) {
                const data = JSON.parse(saveData);

                this.highScore = data.highScore || 0;

                // 統計データのマージ
                if (data.stats) {
                    Object.assign(this.stats, data.stats);
                }

                console.log('Game data loaded');
            }
        } catch (e) {
            console.warn('Could not load game data:', e);
        }
    },

    /**
     * マウス位置更新
     */
    updateMousePosition(x, y) {
        this.mouseX = Utils.Math.clamp(x, 0, CONFIG.GAME.CANVAS_WIDTH);
        this.mouseY = y;
    },

    /**
     * 現在のゲーム状態取得
     */
    getCurrentState() {
        return {
            score: this.score,
            ballCount: this.ballCount,
            highScore: this.highScore,
            gameState: this.gameState,
            isPaused: this.isPaused,
            isGameOver: this.isGameOver,
            activeBalls: this.balls.filter(ball => ball.isActive).length,
            totalBalls: this.balls.length,
            stats: { ...this.stats },
            performance: { ...this.performance }
        };
    },

    /**
     * パフォーマンス統計の更新
     */
    updatePerformanceStats() {
        this.performance.frameCount++;
        this.performance.lastUpdate = Date.now();
        this.performance.activeBallCount = this.balls.filter(ball => ball.isActive).length;
    },

    /**
     * デバッグ情報の取得
     */
    getDebugInfo() {
        return {
            gameState: this.gameState,
            balls: {
                total: this.balls.length,
                active: this.balls.filter(ball => ball.isActive).length,
                remaining: this.ballCount
            },
            objects: {
                pegs: this.pegs.length,
                slots: this.slots.length
            },
            performance: this.performance,
            memoryUsage: Utils.Performance.getMemoryUsage()
        };
    },

    // ===== イベントハンドラー =====

    /**
     * スコア更新イベント
     */
    onScoreUpdate(points) {
        // アニメーション効果などの実装用
        if (points >= 1000) {
            console.log('🎉 Big score!', points);
        }
    },

    /**
     * スロットヒットイベント
     */
    onSlotHit(slotIndex, points) {
        this.recordSlotHit(slotIndex, points);

        // 特別なスロットの処理
        if (points >= 1000) {
            console.log('💎 Jackpot hit!', points);
        }
    },

    /**
     * ゲーム終了イベント
     */
    onGameEnd() {
        // 終了時の特殊効果などの実装用
        console.log('📊 Game Statistics:', this.stats);
    },

    // ===== ユーティリティメソッド =====

    /**
     * ゲーム時間の取得
     */
    getPlayTime() {
        return Date.now() - this.stats.startTime;
    },

    /**
     * スコア効率の計算
     */
    getScoreEfficiency() {
        const playTimeSeconds = this.getPlayTime() / 1000;
        return playTimeSeconds > 0 ? Math.round(this.score / playTimeSeconds) : 0;
    },

    /**
     * 統計サマリーの取得
     */
    getStatsSummary() {
        return {
            currentScore: this.score,
            highScore: this.highScore,
            totalSessions: this.stats.sessionsPlayed,
            averageScore: this.stats.averageScore,
            totalPlayTime: this.stats.totalPlayTime,
            scoreEfficiency: this.getScoreEfficiency(),
            favoritSlot: this.getFavoriteSlot()
        };
    },

    /**
     * 最も多くヒットしたスロットの取得
     */
    getFavoriteSlot() {
        let maxHits = 0;
        let favoriteIndex = 0;

        this.stats.slotHitCounts.forEach((hits, index) => {
            if (hits > maxHits) {
                maxHits = hits;
                favoriteIndex = index;
            }
        });

        return {
            index: favoriteIndex,
            hits: maxHits,
            points: CONFIG.SLOT.POINTS[favoriteIndex]
        };
    },

    /**
     * データエクスポート
     */
    exportGameData() {
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '2.1',
            gameState: this.getCurrentState(),
            statistics: this.getStatsSummary()
        };

        return JSON.stringify(exportData, null, 2);
    },

    /**
     * 全データリセット
     */
    resetAllData() {
        this.highScore = 0;
        this.stats = {
            totalScore: 0,
            totalBalls: 0,
            averageScore: 0,
            bestRun: 0,
            sessionsPlayed: 0,
            totalPlayTime: 0,
            slotHitCounts: new Array(CONFIG.SLOT.COUNT).fill(0),
            startTime: Date.now()
        };

        // ローカルストレージもクリア
        if (typeof Storage !== 'undefined') {
            localStorage.removeItem('cyberPlinko_saveData');
        }

        console.log('All game data reset');
    }
};

// グローバルな状態変更の監視（デバッグ用）
if (CONFIG.DEBUG.LOG_PERFORMANCE) {
    const originalUpdateScore = GameState.updateScore;
    GameState.updateScore = function(points) {
        console.log(`Score updated: +${points} (Total: ${this.score + points})`);
        return originalUpdateScore.call(this, points);
    };
}