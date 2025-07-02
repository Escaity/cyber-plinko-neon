// ゲーム初期化システム
const GameInitializer = {
    /**
     * ゲーム全体の初期化
     */
    async initialize() {
        console.log('🚀 Initializing Cyber Plinko...');

        try {
            // 段階的初期化
            await this.initializeCore();
            await this.initializeGameObjects();
            await this.initializeEffectSystems();
            await this.initializeUI();
            await this.finalizeSetup();

            console.log('✅ Cyber Plinko initialized successfully!');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize game:', error);
            this.handleInitializationError(error);
            return false;
        }
    },

    /**
     * コアシステムの初期化
     */
    async initializeCore() {
        // ゲーム状態の初期化
        GameState.initialize();

        // パフォーマンス監視の初期化
        window.performanceMonitor = new PerformanceMonitor();

        // オブジェクトプールの確認
        if (!window.poolManager) {
            window.poolManager = new PoolManager();
        }

        console.log('📊 Core systems initialized');
    },

    /**
     * ゲームオブジェクトの初期化
     */
    async initializeGameObjects() {
        // ペグの配置
        this.initializePegs();

        // スロットの配置
        this.initializeSlots();

        console.log(`🎯 Game objects initialized: ${GameState.pegs.length} pegs, ${GameState.slots.length} slots`);
    },

    /**
     * エフェクトシステムの初期化
     */
    async initializeEffectSystems() {
        // パーティクルシステム
        window.particleSystem = new ParticleSystem();

        // 画面揺れエフェクト
        window.screenShake = new ScreenShake();

        console.log('✨ Effect systems initialized');
    },

    /**
     * UI初期化
     */
    async initializeUI() {
        // 初期UI表示の更新
        this.updateInitialUI();

        // イベントハンドラーの設定
        this.setupEventHandlers();

        console.log('🖱️ UI initialized');
    },

    /**
     * 最終セットアップ
     */
    async finalizeSetup() {
        // パフォーマンス設定の最適化
        this.optimizePerformanceSettings();

        // ゲームループの準備完了状態に設定
        window.gameInitialized = true;

        console.log('🎮 Setup finalized');
    },

    /**
     * ペグの初期化
     */
    initializePegs() {
        GameState.pegs = [];

        const pegRows = CONFIG.PEG.ROWS;
        const pegCols = CONFIG.PEG.COLS;
        const startY = CONFIG.PEG.START_Y;
        const rowSpacing = CONFIG.PEG.ROW_SPACING;
        const colSpacing = CONFIG.PEG.COL_SPACING;

        for (let row = 0; row < pegRows; row++) {
            const pegsInRow = pegCols + (row % 2);
            const startX = (CONFIG.GAME.CANVAS_WIDTH - (pegsInRow - 1) * colSpacing) / 2;

            for (let col = 0; col < pegsInRow; col++) {
                const x = startX + col * colSpacing;
                const y = startY + row * rowSpacing;

                // 特殊ペグの配置（低確率）
                const peg = this.shouldCreateSpecialPeg(row, col) ?
                    this.createSpecialPeg(x, y, row, col) :
                    new Peg(x, y);

                GameState.pegs.push(peg);
            }
        }

        console.log(`Generated ${GameState.pegs.length} pegs`);
    },

    /**
     * 特殊ペグ生成判定
     */
    shouldCreateSpecialPeg(row, col) {
        // 下部ほど特殊ペグが出やすい
        const baseChance = 0.02; // 2%
        const rowBonus = row / CONFIG.PEG.ROWS * 0.03; // 最大3%追加
        const totalChance = baseChance + rowBonus;

        return Math.random() < totalChance;
    },

    /**
     * 特殊ペグの作成
     */
    createSpecialPeg(x, y, row, col) {
        const specialTypes = ['multiplier', 'magnet', 'bomb', 'teleport'];
        const weights = [0.4, 0.3, 0.2, 0.1]; // 確率重み

        const selectedType = this.weightedRandomSelect(specialTypes, weights);

        return new SpecialPeg(x, y, selectedType, {
            multiplier: selectedType === 'multiplier' ? Utils.Math.randomFloat(1.5, 3.0) : undefined,
            effectRadius: selectedType === 'magnet' ? 60 : 40,
            cooldown: 3000 + Math.random() * 2000 // 3-5秒
        });
    },

    /**
     * 重み付きランダム選択
     */
    weightedRandomSelect(items, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }

        return items[items.length - 1];
    },

    /**
     * スロットの初期化
     */
    initializeSlots() {
        GameState.slots = [];

        const slotCount = CONFIG.SLOT.COUNT;
        const slotWidth = CONFIG.GAME.CANVAS_WIDTH / slotCount;
        const slotY = CONFIG.GAME.CANVAS_HEIGHT - CONFIG.SLOT.HEIGHT;

        for (let i = 0; i < slotCount; i++) {
            const x = i * slotWidth;
            const points = CONFIG.SLOT.POINTS[i];

            const slot = new Slot(x, slotY, slotWidth, points, i);
            GameState.slots.push(slot);
        }

        console.log(`Generated ${GameState.slots.length} slots`);
    },

    /**
     * 初期UI更新
     */
    updateInitialUI() {
        // スコア表示
        Utils.DOM.setText('score', '0');
        Utils.DOM.setText('ballCount', CONFIG.GAME.INITIAL_BALL_COUNT);
        Utils.DOM.setText('fps', '60');

        // ゲーム状態の同期
        GameState.score = 0;
        GameState.ballCount = CONFIG.GAME.INITIAL_BALL_COUNT;
    },

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        // マウスイベント
        this.setupMouseEvents();

        // キーボードイベント
        this.setupKeyboardEvents();

        // ウィンドウイベント
        this.setupWindowEvents();

        // タッチイベント（モバイル対応）
        this.setupTouchEvents();
    },

    /**
     * マウスイベントの設定
     */
    setupMouseEvents() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        // マウス移動
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            GameState.updateMousePosition(x, y);
        });

        // マウスクリック
        canvas.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleBallDrop();
        });

        // マウス進入/退出
        canvas.addEventListener('mouseenter', () => {
            canvas.style.cursor = 'crosshair';
        });

        canvas.addEventListener('mouseleave', () => {
            canvas.style.cursor = 'default';
        });
    },

    /**
     * キーボードイベントの設定
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.handleBallDrop();
                    break;

                case 'KeyP':
                    e.preventDefault();
                    GameState.pauseGame();
                    break;

                case 'KeyR':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.handleGameReset();
                    }
                    break;

                case 'F11':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
            }
        });
    },

    /**
     * ウィンドウイベントの設定
     */
    setupWindowEvents() {
        // ページ離脱時の一時停止
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !GameState.isPaused) {
                GameState.pauseGame();
            }
        });

        // リサイズ対応
        window.addEventListener('resize', Utils.Performance.measurePerformance(() => {
            this.handleResize();
        }, 'Resize'));

        // ページアンロード時のデータ保存
        window.addEventListener('beforeunload', () => {
            GameState.saveGameData();
        });
    },

    /**
     * タッチイベントの設定
     */
    setupTouchEvents() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        // タッチ開始
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            GameState.updateMousePosition(x, y);
            GameState.isMousePressed = true;
        });

        // タッチ移動
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            GameState.updateMousePosition(x, y);
        });

        // タッチ終了
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (GameState.isMousePressed) {
                this.handleBallDrop();
            }
            GameState.isMousePressed = false;
        });
    },

    /**
     * ボール投下処理
     */
    handleBallDrop() {
        if (GameState.ballCount <= 0 || GameState.isPaused || GameState.isGameOver) {
            return;
        }

        // プールからボールを取得
        const ballPool = window.poolManager.getPool('ball');
        const ball = ballPool ? ballPool.acquire(
            GameState.mouseX,
            CONFIG.BALL.INITIAL_Y,
            {
                vx: (Math.random() - 0.5) * CONFIG.BALL.RANDOM_VELOCITY_RANGE,
                vy: 0
            }
        ) : new Ball(GameState.mouseX, CONFIG.BALL.INITIAL_Y);

        if (GameState.addBall(ball)) {
            GameState.decrementBallCount();

            // 投下エフェクト
            if (window.particleSystem) {
                window.particleSystem.createSparks(
                    GameState.mouseX,
                    CONFIG.BALL.INITIAL_Y,
                    3,
                    ball.color
                );
            }
        }
    },

    /**
     * ゲームリセット処理
     */
    handleGameReset() {
        const confirmed = confirm('ゲームをリセットしますか？');
        if (confirmed) {
            this.resetGame();
        }
    },

    /**
     * ゲームリセット
     */
    resetGame() {
        // ゲーム状態のリセット
        GameState.resetGame();

        // プールのクリーンアップ
        if (window.poolManager) {
            window.poolManager.resetAllPools();
        }

        // エフェクトシステムのリセット
        if (window.particleSystem) {
            window.particleSystem.clear();
        }

        if (window.screenShake) {
            window.screenShake.intensity = 0;
            window.screenShake.duration = 0;
        }

        console.log('🔄 Game reset completed');
    },

    /**
     * フルスクリーン切り替え
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('Could not enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.warn('Could not exit fullscreen:', err);
            });
        }
    },

    /**
     * リサイズ処理
     */
    handleResize() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        const container = canvas.parentElement;
        const containerRect = container.getBoundingClientRect();

        // アスペクト比を維持しながらリサイズ
        const aspectRatio = CONFIG.GAME.CANVAS_WIDTH / CONFIG.GAME.CANVAS_HEIGHT;
        let newWidth = containerRect.width - 40; // マージンを考慮
        let newHeight = newWidth / aspectRatio;

        if (newHeight > containerRect.height - 100) {
            newHeight = containerRect.height - 100;
            newWidth = newHeight * aspectRatio;
        }

        canvas.style.width = `${newWidth}px`;
        canvas.style.height = `${newHeight}px`;

        console.log(`Canvas resized to ${newWidth}x${newHeight}`);
    },

    /**
     * パフォーマンス設定の最適化
     */
    optimizePerformanceSettings() {
        // デバイス性能に基づく最適化
        const performance = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;

        // 低性能デバイスの場合
        if (performance <= 2 || memory <= 2) {
            CONFIG.PERFORMANCE.MAX_PARTICLES = 50;
            CONFIG.GAME.MAX_BALLS_ON_SCREEN = 20;
            CONFIG.EFFECTS.ENABLE_TRAILS = false;
            CONFIG.EFFECTS.ENABLE_GLOW = false;
            console.log('⚡ Low-performance optimizations applied');
        }

        // 中性能デバイスの場合
        else if (performance <= 4 || memory <= 4) {
            CONFIG.PERFORMANCE.MAX_PARTICLES = 100;
            CONFIG.GAME.MAX_BALLS_ON_SCREEN = 35;
            CONFIG.EFFECTS.EXPLOSION_PARTICLES = 15;
            console.log('⚡ Medium-performance optimizations applied');
        }

        // 高性能デバイスの場合
        else {
            console.log('⚡ High-performance mode enabled');
        }
    },

    /**
     * 初期化エラー処理
     */
    handleInitializationError(error) {
        console.error('Initialization failed:', error);

        // エラー表示
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ff0000;
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: 'Share Tech Mono', monospace;
            z-index: 9999;
            text-align: center;
        `;
        errorMessage.innerHTML = `
            <h3>⚠️ 初期化エラー</h3>
            <p>ゲームの読み込みに失敗しました。</p>
            <p>ページを再読み込みしてください。</p>
            <button onclick="location.reload()" style="
                background: white;
                color: #ff0000;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                font-family: inherit;
                cursor: pointer;
                margin-top: 10px;
            ">再読み込み</button>
        `;

        document.body.appendChild(errorMessage);
    },

    /**
     * プリロード処理
     */
    async preloadAssets() {
        // 将来の拡張用：画像、音声ファイルのプリロード
        const assets = [
            // 'assets/sounds/ball_hit.mp3',
            // 'assets/sounds/slot_hit.mp3',
            // 'assets/images/particles.png'
        ];

        const loadPromises = assets.map(asset => {
            return new Promise((resolve, reject) => {
                // アセット読み込み処理
                setTimeout(resolve, 10); // 現在は即座に完了
            });
        });

        try {
            await Promise.all(loadPromises);
            console.log('📦 Assets preloaded');
        } catch (error) {
            console.warn('⚠️ Some assets failed to load:', error);
        }
    },

    /**
     * デバッグモードの設定
     */
    setupDebugMode() {
        if (CONFIG.DEBUG.SHOW_FPS) {
            // デバッグコンソールの追加
            this.createDebugConsole();
        }

        // グローバルデバッグ関数の追加
        window.debugGame = {
            state: () => GameState.getCurrentState(),
            stats: () => GameState.getStatsSummary(),
            performance: () => window.performanceMonitor?.getPerformanceInfo(),
            pools: () => window.poolManager?.getPerformanceInfo(),
            reset: () => this.resetGame(),
            addBalls: (count = 5) => {
                for (let i = 0; i < count; i++) {
                    const x = Math.random() * CONFIG.GAME.CANVAS_WIDTH;
                    const ball = new Ball(x, CONFIG.BALL.INITIAL_Y);
                    GameState.addBall(ball);
                }
            }
        };

        console.log('🐛 Debug mode enabled. Use window.debugGame for debugging.');
    },

    /**
     * デバッグコンソールの作成
     */
    createDebugConsole() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 200px;
            background: rgba(0, 0, 0, 0.8);
            color: #00ff41;
            font-family: 'Share Tech Mono', monospace;
            font-size: 10px;
            padding: 10px;
            border: 1px solid #00ff41;
            border-radius: 5px;
            z-index: 1000;
            display: none;
        `;

        document.body.appendChild(debugPanel);

        // F12キーでデバッグパネル切り替え
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12') {
                e.preventDefault();
                const panel = document.getElementById('debugPanel');
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    },

    /**
     * バージョン情報の表示
     */
    displayVersionInfo() {
        console.log(`
╔══════════════════════════════════════╗
║         CYBER PLINKO v2.1            ║
║    Advanced Physics & Effects        ║
║                                      ║
║  Features:                           ║
║  • Ball-to-ball collision            ║
║  • Performance optimization          ║
║  • Cyberpunk visual design           ║
║  • Particle effects system          ║
║                                      ║
║  Press F12 for debug panel           ║
╚══════════════════════════════════════╝
        `);
    },

    /**
     * 互換性チェック
     */
    checkCompatibility() {
        const issues = [];

        // Canvas サポートチェック
        const canvas = document.createElement('canvas');
        if (!canvas.getContext || !canvas.getContext('2d')) {
            issues.push('Canvas 2D not supported');
        }

        // ローカルストレージチェック
        if (typeof Storage === 'undefined') {
            issues.push('Local Storage not supported');
        }

        // パフォーマンスAPIチェック
        if (!window.performance || !window.performance.now) {
            issues.push('Performance API not supported');
        }

        if (issues.length > 0) {
            console.warn('⚠️ Compatibility issues detected:', issues);
            return false;
        }

        console.log('✅ Browser compatibility check passed');
        return true;
    }
};

// グローバル関数（HTMLから呼び出し用）
function dropBall() {
    GameInitializer.handleBallDrop();
}

function resetGame() {
    GameInitializer.resetGame();
}