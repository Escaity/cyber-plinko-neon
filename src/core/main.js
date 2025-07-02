// メインエントリーポイント - Cyber Plinko v2.1
class CyberPlinkoGame {
    constructor() {
        this.isInitialized = false;
        this.isRunning = false;

        // コアシステム
        this.canvas = null;
        this.renderer = null;
        this.physicsEngine = null;
        this.gameLoop = null;
        this.inputHandler = null;
        this.performanceMonitor = null;

        // ロード状態
        this.loadingStage = 'initializing';
        this.loadingProgress = 0;

        // エラーハンドリング
        this.errorCount = 0;
        this.maxErrors = 5;
    }

    /**
     * ゲーム初期化
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Cyber Plinko v2.1...');

            // 初期化段階の実行
            await this.initializeCore();
            await this.initializeSystems();
            await this.initializeGameObjects();
            await this.startGameLoop();

            this.isInitialized = true;
            this.isRunning = true;

            console.log('✅ Cyber Plinko initialized successfully!');
            this.displaySuccessMessage();

            return true;

        } catch (error) {
            console.error('❌ Failed to initialize Cyber Plinko:', error);
            this.handleInitializationError(error);
            return false;
        }
    }

    /**
     * コアシステム初期化
     */
    async initializeCore() {
        this.updateLoadingProgress('Initializing core systems...', 10);

        // キャンバス取得
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            throw new Error('Game canvas not found');
        }

        // ブラウザ互換性チェック
        if (!GameInitializer.checkCompatibility()) {
            throw new Error('Browser compatibility check failed');
        }

        // 設定の調整
        adjustConfigForDevice();

        // ゲーム状態初期化
        GameState.initialize();

        this.updateLoadingProgress('Core systems ready', 20);
    }

    /**
     * システム初期化
     */
    async initializeSystems() {
        this.updateLoadingProgress('Setting up rendering system...', 30);

        // レンダラー初期化
        this.renderer = new Renderer(this.canvas);

        this.updateLoadingProgress('Setting up physics engine...', 40);

        // 物理エンジン初期化
        this.physicsEngine = new PhysicsEngine(
            this.canvas.width,
            this.canvas.height
        );

        this.updateLoadingProgress('Setting up performance monitor...', 50);

        // パフォーマンス監視初期化
        this.performanceMonitor = new PerformanceMonitor();
        window.performanceMonitor = this.performanceMonitor;

        this.updateLoadingProgress('Setting up input system...', 60);

        // 入力ハンドラー初期化
        this.inputHandler = new InputHandler();
        window.inputHandler = this.inputHandler;

        this.updateLoadingProgress('Setting up game loop...', 70);

        // ゲームループ初期化
        this.gameLoop = new GameLoop();
        this.gameLoop.initialize(
            this.renderer,
            this.physicsEngine,
            this.performanceMonitor,
            this.inputHandler
        );
        window.gameLoop = this.gameLoop;

        this.updateLoadingProgress('Systems ready', 80);
    }

    /**
     * ゲームオブジェクト初期化
     */
    async initializeGameObjects() {
        this.updateLoadingProgress('Creating game objects...', 85);

        // エフェクトシステム
        window.particleSystem = new ParticleSystem();
        window.screenShake = new ScreenShake();

        // ゲームオブジェクトの作成
        GameInitializer.initializePegs();
        GameInitializer.initializeSlots();

        // UI更新
        GameInitializer.updateInitialUI();

        this.updateLoadingProgress('Game objects created', 95);
    }

    /**
     * ゲームループ開始
     */
    async startGameLoop() {
        this.updateLoadingProgress('Starting game...', 100);

        // イベントハンドラーの設定
        this.setupEventHandlers();

        // デバッグモードの設定
        if (CONFIG.DEBUG.SHOW_FPS) {
            GameInitializer.setupDebugMode();
            this.gameLoop.enableDebugMode();
        }

        // ゲームループ開始
        this.gameLoop.start();

        // バージョン情報表示
        GameInitializer.displayVersionInfo();
    }

    /**
     * イベントハンドラーの設定
     */
    setupEventHandlers() {
        // ウィンドウイベント
        window.addEventListener('beforeunload', () => {
            this.shutdown();
        });

        // ページ可視性変更
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning) {
                this.pause();
            } else if (!document.hidden && !this.isRunning) {
                this.resume();
            }
        });

        // エラーハンドリング
        window.addEventListener('error', (event) => {
            this.handleRuntimeError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleRuntimeError(event.reason);
        });
    }

    /**
     * ロード進捗更新
     */
    updateLoadingProgress(message, progress) {
        this.loadingStage = message;
        this.loadingProgress = progress;

        console.log(`📊 ${progress}% - ${message}`);

        // UI更新（ローディング画面がある場合）
        const loadingElement = document.getElementById('loadingProgress');
        if (loadingElement) {
            loadingElement.textContent = `${progress}% - ${message}`;
        }
    }

    /**
     * 成功メッセージ表示
     */
    displaySuccessMessage() {
        // 一時的な成功通知を表示
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #00ff41, #00d4ff);
            color: #000;
            padding: 15px 25px;
            border-radius: 10px;
            font-family: 'Orbitron', monospace;
            font-weight: 700;
            z-index: 9999;
            animation: slideIn 0.5s ease-out;
            box-shadow: 0 4px 20px rgba(0, 255, 65, 0.3);
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🎮</span>
                <div>
                    <div style="font-size: 14px;">CYBER PLINKO</div>
                    <div style="font-size: 12px; opacity: 0.8;">システム起動完了</div>
                </div>
            </div>
        `;

        // アニメーション用CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // 3秒後に削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.5s ease-out reverse';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }
        }, 3000);
    }

    /**
     * ゲーム一時停止
     */
    pause() {
        if (this.gameLoop && this.isRunning) {
            this.gameLoop.pause();
            this.isRunning = false;
            console.log('⏸️ Game paused');
        }
    }

    /**
     * ゲーム再開
     */
    resume() {
        if (this.gameLoop && !this.isRunning) {
            this.gameLoop.resume();
            this.isRunning = true;
            console.log('▶️ Game resumed');
        }
    }

    /**
     * ゲームリセット
     */
    reset() {
        if (this.gameLoop) {
            this.gameLoop.reset();
        }

        GameState.resetGame();

        if (window.poolManager) {
            window.poolManager.resetAllPools();
        }

        if (window.particleSystem) {
            window.particleSystem.clear();
        }

        console.log('🔄 Game reset completed');
    }

    /**
     * ゲーム終了
     */
    shutdown() {
        console.log('🔌 Shutting down Cyber Plinko...');

        // データ保存
        GameState.saveGameData();

        // システム停止
        if (this.gameLoop) {
            this.gameLoop.stop();
        }

        if (this.inputHandler) {
            this.inputHandler.destroy();
        }

        if (this.physicsEngine) {
            this.physicsEngine.reset();
        }

        // リソースクリーンアップ
        if (window.poolManager) {
            window.poolManager.resetAllPools();
        }

        this.isRunning = false;
        this.isInitialized = false;

        console.log('👋 Cyber Plinko shutdown complete');
    }

    /**
     * 初期化エラーハンドリング
     */
    handleInitializationError(error) {
        console.error('Initialization Error:', error);

        // エラー表示UI
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #ff0040, #ff6600);
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-family: 'Share Tech Mono', monospace;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 8px 30px rgba(255, 0, 64, 0.5);
            max-width: 400px;
        `;

        errorContainer.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
            <h2 style="margin: 0 0 15px 0; font-size: 20px;">SYSTEM ERROR</h2>
            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.4;">
                ゲームの初期化中にエラーが発生しました。<br>
                ${error.message || 'Unknown error occurred'}
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="location.reload()" style="
                    background: white;
                    color: #ff0040;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-family: inherit;
                    font-weight: 700;
                    cursor: pointer;
                ">再読み込み</button>
                <button onclick="this.parentElement.parentElement.parentElement.removeChild(this.parentElement.parentElement)" style="
                    background: transparent;
                    color: white;
                    border: 2px solid white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-family: inherit;
                    font-weight: 700;
                    cursor: pointer;
                ">閉じる</button>
            </div>
        `;

        document.body.appendChild(errorContainer);
    }

    /**
     * 実行時エラーハンドリング
     */
    handleRuntimeError(error) {
        this.errorCount++;

        console.error(`Runtime Error #${this.errorCount}:`, error);

        // エラー回数制限
        if (this.errorCount >= this.maxErrors) {
            console.error('🚨 Too many errors, initiating emergency shutdown');

            if (this.gameLoop) {
                this.gameLoop.emergencyStop();
            }

            return;
        }

        // 軽微なエラーの場合は続行
        if (this.errorCount < 3) {
            console.warn('⚠️ Minor error occurred, continuing...');
            return;
        }

        // 中程度のエラーの場合はパフォーマンス低下
        console.warn('⚠️ Multiple errors detected, reducing performance...');

        if (this.gameLoop) {
            this.gameLoop.adjustQuality(0.5);
        }
    }

    /**
     * ゲーム状態の取得
     */
    getGameState() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            loadingStage: this.loadingStage,
            loadingProgress: this.loadingProgress,
            errorCount: this.errorCount,
            gameState: GameState.getCurrentState(),
            performance: this.performanceMonitor ? this.performanceMonitor.getPerformanceInfo() : null,
            loop: this.gameLoop ? this.gameLoop.getLoopStats() : null
        };
    }

    /**
     * デバッグ情報の取得
     */
    getDebugInfo() {
        return {
            version: '2.1',
            systems: {
                renderer: !!this.renderer,
                physics: !!this.physicsEngine,
                input: !!this.inputHandler,
                gameLoop: !!this.gameLoop,
                particleSystem: !!window.particleSystem,
                poolManager: !!window.poolManager
            },
            config: CONFIG,
            gameState: this.getGameState(),
            browser: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                memory: navigator.deviceMemory,
                cores: navigator.hardwareConcurrency,
                online: navigator.onLine
            }
        };
    }
}

// グローバル関数（HTMLから呼び出し用）
function dropBall() {
    if (window.inputHandler) {
        window.inputHandler.performBallDrop();
    }
}

function resetGame() {
    if (window.cyberPlinko) {
        window.cyberPlinko.reset();
    }
}

function pauseGame() {
    if (window.cyberPlinko) {
        if (window.cyberPlinko.isRunning) {
            window.cyberPlinko.pause();
        } else {
            window.cyberPlinko.resume();
        }
    }
}

// ページ読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🌐 DOM loaded, starting Cyber Plinko...');

    // グローバルインスタンスの作成
    window.cyberPlinko = new CyberPlinkoGame();

    // 初期化の実行
    const success = await window.cyberPlinko.initialize();

    if (!success) {
        console.error('Failed to start Cyber Plinko');
        return;
    }

    // デバッグモードの有効化
    if (CONFIG.DEBUG.SHOW_FPS) {
        // グローバルデバッグ関数の追加
        window.debug = {
            game: () => window.cyberPlinko.getDebugInfo(),
            state: () => GameState.getCurrentState(),
            performance: () => window.performanceMonitor?.getPerformanceInfo(),
            pools: () => window.poolManager?.getPerformanceInfo(),
            physics: () => window.cyberPlinko.physicsEngine?.getPhysicsStats(),

            // 制御関数
            pause: () => pauseGame(),
            reset: () => resetGame(),
            quality: (level) => window.gameLoop?.adjustQuality(level),
            fps: (target) => window.gameLoop?.setTargetFPS(target),

            // テスト関数
            addBalls: (count = 5) => {
                for (let i = 0; i < count; i++) {
                    const x = Math.random() * CONFIG.GAME.CANVAS_WIDTH;
                    const ball = new Ball(x, CONFIG.BALL.INITIAL_Y);
                    GameState.addBall(ball);
                }
            },

            explosion: (x, y, intensity = 3) => {
                if (window.particleSystem) {
                    window.particleSystem.createExplosion(x || 300, y || 350, CONFIG.COLORS.PRIMARY, intensity);
                }
            },

            shake: (intensity = 5, duration = 30) => {
                if (window.screenShake) {
                    window.screenShake.shake(intensity, duration);
                }
            }
        };

        console.log('🐛 Debug mode enabled. Use window.debug object for debugging.');
        console.log('Available commands:', Object.keys(window.debug));
    }

    // パフォーマンス監視の開始
    setInterval(() => {
        if (window.cyberPlinko && window.cyberPlinko.performanceMonitor) {
            window.cyberPlinko.performanceMonitor.checkPerformanceWarnings();
        }
    }, 5000); // 5秒ごと

    console.log('🎉 Cyber Plinko is ready to play!');
});

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.cyberPlinko) {
        window.cyberPlinko.shutdown();
    }
});

// グローバルエラーハンドラー
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);

    if (window.cyberPlinko) {
        window.cyberPlinko.handleRuntimeError(event.error);
    }
});

// 未処理のPromise拒否
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);

    if (window.cyberPlinko) {
        window.cyberPlinko.handleRuntimeError(event.reason);
    }

    // デフォルトの拒否処理を防ぐ
    event.preventDefault();
});

// パフォーマンス監視用のタイマー
let performanceCheckInterval = null;

// 高度な初期化オプション
const AdvancedInitializer = {
    /**
     * カスタム設定での初期化
     */
    async initializeWithConfig(customConfig = {}) {
        // 設定のマージ
        Object.assign(CONFIG, customConfig);

        console.log('🔧 Custom configuration applied:', customConfig);

        // 通常の初期化を実行
        if (!window.cyberPlinko) {
            window.cyberPlinko = new CyberPlinkoGame();
        }

        return await window.cyberPlinko.initialize();
    },

    /**
     * プリセット設定
     */
    presets: {
        // 高性能モード
        highPerformance: {
            PERFORMANCE: {
                MAX_PARTICLES: 300,
                UPDATE_FREQUENCY: 1,
                ENABLE_OBJECT_POOLING: true
            },
            EFFECTS: {
                ENABLE_TRAILS: true,
                ENABLE_GLOW: true,
                EXPLOSION_PARTICLES: 30
            },
            GAME: {
                MAX_BALLS_ON_SCREEN: 60
            }
        },

        // 低性能モード
        lowPerformance: {
            PERFORMANCE: {
                MAX_PARTICLES: 50,
                UPDATE_FREQUENCY: 2,
                ENABLE_OBJECT_POOLING: true
            },
            EFFECTS: {
                ENABLE_TRAILS: false,
                ENABLE_GLOW: false,
                EXPLOSION_PARTICLES: 5
            },
            GAME: {
                MAX_BALLS_ON_SCREEN: 15
            }
        },

        // デバッグモード
        debug: {
            DEBUG: {
                SHOW_FPS: true,
                SHOW_COLLISION_BOXES: true,
                SHOW_VELOCITY_VECTORS: true,
                LOG_PERFORMANCE: true
            },
            PERFORMANCE: {
                MAX_PARTICLES: 100
            }
        }
    }
};

// 便利関数
const GameUtils = {
    /**
     * スクリーンショット撮影
     */
    captureScreenshot() {
        if (window.cyberPlinko && window.cyberPlinko.renderer) {
            return window.cyberPlinko.renderer.captureScreenshot();
        }
        return null;
    },

    /**
     * ゲーム統計の取得
     */
    getGameStats() {
        return {
            session: GameState.getStatsSummary(),
            performance: window.performanceMonitor?.getPerformanceInfo(),
            pools: window.poolManager?.getPerformanceInfo(),
            game: window.cyberPlinko?.getGameState()
        };
    },

    /**
     * 設定のエクスポート
     */
    exportConfig() {
        return JSON.stringify(CONFIG, null, 2);
    },

    /**
     * 設定のインポート
     */
    importConfig(configString) {
        try {
            const newConfig = JSON.parse(configString);
            Object.assign(CONFIG, newConfig);
            console.log('⚙️ Configuration imported successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to import configuration:', error);
            return false;
        }
    },

    /**
     * パフォーマンス報告書の生成
     */
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            browser: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                memory: navigator.deviceMemory,
                cores: navigator.hardwareConcurrency
            },
            config: CONFIG,
            stats: this.getGameStats(),
            errors: window.cyberPlinko?.errorCount || 0
        };

        return JSON.stringify(report, null, 2);
    }
};

// コンソール出力用のスタイリング
const ConsoleStyles = {
    title: 'color: #00ff41; font-size: 16px; font-weight: bold;',
    success: 'color: #00ff41; font-weight: bold;',
    warning: 'color: #ff6600; font-weight: bold;',
    error: 'color: #ff0040; font-weight: bold;',
    info: 'color: #00d4ff;',
    debug: 'color: #bc13fe;'
};

// ウェルカムメッセージ
console.log('%c╔══════════════════════════════════════╗', ConsoleStyles.title);
console.log('%c║         CYBER PLINKO v2.1            ║', ConsoleStyles.title);
console.log('%c║    Advanced Physics & Effects        ║', ConsoleStyles.info);
console.log('%c║                                      ║', ConsoleStyles.info);
console.log('%c║  🚀 Loading complete!                ║', ConsoleStyles.success);
console.log('%c║  🎮 Ready to play                    ║', ConsoleStyles.success);
console.log('%c║  🐛 Debug mode available             ║', ConsoleStyles.debug);
console.log('%c║                                      ║', ConsoleStyles.info);
console.log('%c╚══════════════════════════════════════╝', ConsoleStyles.title);

// 機能説明
if (CONFIG.DEBUG.SHOW_FPS) {
    console.log('%cAvailable Debug Commands:', ConsoleStyles.info);
    console.log('%c• window.debug - Debug utilities', ConsoleStyles.debug);
    console.log('%c• GameUtils - Game utilities', ConsoleStyles.debug);
    console.log('%c• AdvancedInitializer - Advanced setup', ConsoleStyles.debug);
    console.log('%c• CONFIG - Game configuration', ConsoleStyles.debug);
}

// グローバル参照の設定
window.GameUtils = GameUtils;
window.AdvancedInitializer = AdvancedInitializer;
window.ConsoleStyles = ConsoleStyles;

// 開発用ホットキー
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+D でデバッグパネル表示
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        const debugPanel = document.getElementById('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
        }
    }

    // Ctrl+Shift+S でスクリーンショット
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        const screenshot = GameUtils.captureScreenshot();
        if (screenshot) {
            const link = document.createElement('a');
            link.download = `cyber-plinko-${Date.now()}.png`;
            link.href = screenshot;
            link.click();
            console.log('📸 Screenshot saved');
        }
    }

    // Ctrl+Shift+R でパフォーマンス報告書
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
        e.preventDefault();
        const report = GameUtils.generatePerformanceReport();
        console.log('📊 Performance Report:', report);

        // ダウンロード
        const blob = new Blob([report], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `plinko-performance-${Date.now()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
});

console.log('%cHotkeys enabled:', ConsoleStyles.info);
console.log('%c• Ctrl+Shift+D - Toggle debug panel', ConsoleStyles.debug);
console.log('%c• Ctrl+Shift+S - Take screenshot', ConsoleStyles.debug);
console.log('%c• Ctrl+Shift+R - Generate performance report', ConsoleStyles.debug);