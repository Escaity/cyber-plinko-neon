// 入力処理システム
class InputHandler {
    constructor() {
        this.inputState = {
            mouse: {
                x: 0,
                y: 0,
                isPressed: false,
                isDown: false,
                lastClickTime: 0,
                dragStartX: 0,
                dragStartY: 0,
                isDragging: false
            },
            keyboard: {
                pressedKeys: new Set(),
                lastKeyTime: new Map()
            },
            touch: {
                touches: new Map(),
                lastTouchTime: 0,
                gestureScale: 1,
                gestureRotation: 0
            },
            gamepad: {
                connected: false,
                index: -1,
                lastButtonState: []
            }
        };

        // 入力イベントの設定
        this.eventHandlers = new Map();
        this.inputBuffer = [];
        this.maxBufferSize = 10;

        // デバウンス設定
        this.debounceTime = 100; // ms
        this.lastActionTime = 0;

        // 連続入力防止
        this.rapidInputThreshold = 50; // ms
        this.rapidInputCount = 0;
        this.maxRapidInputs = 10;

        this.initialize();
    }

    /**
     * 入力システムの初期化
     */
    initialize() {
        this.setupMouseEvents();
        this.setupKeyboardEvents();
        this.setupTouchEvents();
        this.setupGamepadEvents();
        this.setupWindowEvents();

        console.log('🎮 Input system initialized');
    }

    /**
     * マウスイベントの設定
     */
    setupMouseEvents() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        // マウス移動
        canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        // マウスボタン
        canvas.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });

        canvas.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });

        // マウスホイール
        canvas.addEventListener('wheel', (e) => {
            this.handleMouseWheel(e);
        });

        // コンテキストメニューの無効化
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // マウス離脱時の処理
        canvas.addEventListener('mouseleave', () => {
            this.inputState.mouse.isPressed = false;
            this.inputState.mouse.isDown = false;
            this.inputState.mouse.isDragging = false;
        });
    }

    /**
     * キーボードイベントの設定
     */
    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });

        // フォーカス喪失時のキー状態リセット
        window.addEventListener('blur', () => {
            this.inputState.keyboard.pressedKeys.clear();
        });
    }

    /**
     * タッチイベントの設定
     */
    setupTouchEvents() {
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return;

        canvas.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        });

        canvas.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        });

        canvas.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        });

        canvas.addEventListener('touchcancel', (e) => {
            this.handleTouchCancel(e);
        });

        // ジェスチャーイベント
        canvas.addEventListener('gesturestart', (e) => {
            this.handleGestureStart(e);
        });

        canvas.addEventListener('gesturechange', (e) => {
            this.handleGestureChange(e);
        });

        canvas.addEventListener('gestureend', (e) => {
            this.handleGestureEnd(e);
        });
    }

    /**
     * ゲームパッドイベントの設定
     */
    setupGamepadEvents() {
        window.addEventListener('gamepadconnected', (e) => {
            this.handleGamepadConnected(e);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            this.handleGamepadDisconnected(e);
        });
    }

    /**
     * ウィンドウイベントの設定
     */
    setupWindowEvents() {
        // ページ可視性変更
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.resetInputState();
            }
        });

        // ウィンドウフォーカス
        window.addEventListener('focus', () => {
            this.resetInputState();
        });

        window.addEventListener('blur', () => {
            this.resetInputState();
        });
    }

    /**
     * マウス移動処理
     */
    handleMouseMove(e) {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();

        this.inputState.mouse.x = e.clientX - rect.left;
        this.inputState.mouse.y = e.clientY - rect.top;

        // ドラッグ判定
        if (this.inputState.mouse.isDown) {
            const dragThreshold = 5;
            const dx = this.inputState.mouse.x - this.inputState.mouse.dragStartX;
            const dy = this.inputState.mouse.y - this.inputState.mouse.dragStartY;

            if (Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
                this.inputState.mouse.isDragging = true;
            }
        }

        // ゲーム状態更新
        GameState.updateMousePosition(this.inputState.mouse.x, this.inputState.mouse.y);

        // イベント発火
        this.fireEvent('mousemove', {
            x: this.inputState.mouse.x,
            y: this.inputState.mouse.y,
            isDragging: this.inputState.mouse.isDragging
        });
    }

    /**
     * マウスダウン処理
     */
    handleMouseDown(e) {
        e.preventDefault();

        this.inputState.mouse.isDown = true;
        this.inputState.mouse.isPressed = true;
        this.inputState.mouse.dragStartX = this.inputState.mouse.x;
        this.inputState.mouse.dragStartY = this.inputState.mouse.y;
        this.inputState.mouse.isDragging = false;

        // 連続クリック判定
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - this.inputState.mouse.lastClickTime;

        if (timeSinceLastClick < this.rapidInputThreshold) {
            this.rapidInputCount++;
            if (this.rapidInputCount > this.maxRapidInputs) {
                console.warn('Rapid clicking detected, throttling input');
                return;
            }
        } else {
            this.rapidInputCount = 0;
        }

        this.inputState.mouse.lastClickTime = currentTime;

        // イベント発火
        this.fireEvent('mousedown', {
            x: this.inputState.mouse.x,
            y: this.inputState.mouse.y,
            button: e.button
        });
    }

    /**
     * マウスアップ処理
     */
    handleMouseUp(e) {
        e.preventDefault();

        const wasPressed = this.inputState.mouse.isPressed;
        const wasDragging = this.inputState.mouse.isDragging;

        this.inputState.mouse.isDown = false;
        this.inputState.mouse.isPressed = false;
        this.inputState.mouse.isDragging = false;

        // クリック判定（ドラッグではない場合）
        if (wasPressed && !wasDragging) {
            this.handleClick(e);
        }

        // イベント発火
        this.fireEvent('mouseup', {
            x: this.inputState.mouse.x,
            y: this.inputState.mouse.y,
            button: e.button,
            wasClick: wasPressed && !wasDragging
        });
    }

    /**
     * クリック処理
     */
    handleClick(e) {
        if (!this.canPerformAction()) return;

        // デバウンス制御
        const currentTime = Date.now();
        if (currentTime - this.lastActionTime < this.debounceTime) {
            return;
        }

        this.lastActionTime = currentTime;

        // ボール投下
        if (GameState.ballCount > 0 && !GameState.isPaused && !GameState.isGameOver) {
            this.performBallDrop();
        }

        // イベント発火
        this.fireEvent('click', {
            x: this.inputState.mouse.x,
            y: this.inputState.mouse.y
        });
    }

    /**
     * マウスホイール処理
     */
    handleMouseWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 1 : -1;

        // 将来の拡張用（ズーム機能など）
        this.fireEvent('wheel', { delta });
    }

    /**
     * キーダウン処理
     */
    handleKeyDown(e) {
        const key = e.code;
        const currentTime = Date.now();

        // 既に押されている場合はリピート
        if (this.inputState.keyboard.pressedKeys.has(key)) {
            const lastKeyTime = this.inputState.keyboard.lastKeyTime.get(key) || 0;
            if (currentTime - lastKeyTime < 100) { // 100ms以内はリピート扱い
                return;
            }
        }

        this.inputState.keyboard.pressedKeys.add(key);
        this.inputState.keyboard.lastKeyTime.set(key, currentTime);

        // ゲーム操作の処理
        this.handleGameKeyPress(e);

        // イベント発火
        this.fireEvent('keydown', { code: key, key: e.key });
    }

    /**
     * キーアップ処理
     */
    handleKeyUp(e) {
        const key = e.code;

        this.inputState.keyboard.pressedKeys.delete(key);
        this.inputState.keyboard.lastKeyTime.delete(key);

        // イベント発火
        this.fireEvent('keyup', { code: key, key: e.key });
    }

    /**
     * ゲーム用キー処理
     */
    handleGameKeyPress(e) {
        if (!this.canPerformAction()) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.performBallDrop();
                break;

            case 'KeyP':
                e.preventDefault();
                GameState.pauseGame();
                break;

            case 'KeyR':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.confirmGameReset();
                }
                break;

            case 'Escape':
                e.preventDefault();
                if (!GameState.isPaused) {
                    GameState.pauseGame();
                }
                break;

            case 'ArrowLeft':
                e.preventDefault();
                this.moveDropPosition(-20);
                break;

            case 'ArrowRight':
                e.preventDefault();
                this.moveDropPosition(20);
                break;
        }
    }

    /**
     * 投下位置の移動
     */
    moveDropPosition(deltaX) {
        const newX = Utils.Math.clamp(
            GameState.mouseX + deltaX,
            0,
            CONFIG.GAME.CANVAS_WIDTH
        );
        GameState.updateMousePosition(newX, GameState.mouseY);
    }

    /**
     * タッチ開始処理
     */
    handleTouchStart(e) {
        e.preventDefault();

        const currentTime = Date.now();
        this.inputState.touch.lastTouchTime = currentTime;

        for (const touch of e.changedTouches) {
            this.inputState.touch.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startTime: currentTime
            });
        }

        // 最初のタッチでマウス位置を更新
        if (e.touches.length === 1) {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];

            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            GameState.updateMousePosition(x, y);
        }

        // イベント発火
        this.fireEvent('touchstart', {
            touches: Array.from(e.touches),
            changedTouches: Array.from(e.changedTouches)
        });
    }

    /**
     * タッチ移動処理
     */
    handleTouchMove(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const touchData = this.inputState.touch.touches.get(touch.identifier);
            if (touchData) {
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
            }
        }

        // シングルタッチでマウス位置を更新
        if (e.touches.length === 1) {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const touch = e.touches[0];

            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            GameState.updateMousePosition(x, y);
        }

        // イベント発火
        this.fireEvent('touchmove', {
            touches: Array.from(e.touches),
            changedTouches: Array.from(e.changedTouches)
        });
    }

    /**
     * タッチ終了処理
     */
    handleTouchEnd(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            const touchData = this.inputState.touch.touches.get(touch.identifier);

            if (touchData) {
                const duration = Date.now() - touchData.startTime;

                // タップ判定（短時間のタッチ）
                if (duration < 300 && e.touches.length === 0) {
                    this.performBallDrop();
                }

                this.inputState.touch.touches.delete(touch.identifier);
            }
        }

        // イベント発火
        this.fireEvent('touchend', {
            touches: Array.from(e.touches),
            changedTouches: Array.from(e.changedTouches)
        });
    }

    /**
     * タッチキャンセル処理
     */
    handleTouchCancel(e) {
        for (const touch of e.changedTouches) {
            this.inputState.touch.touches.delete(touch.identifier);
        }

        this.fireEvent('touchcancel', {
            changedTouches: Array.from(e.changedTouches)
        });
    }

    /**
     * ジェスチャー開始
     */
    handleGestureStart(e) {
        e.preventDefault();
        this.inputState.touch.gestureScale = e.scale;
        this.inputState.touch.gestureRotation = e.rotation;
    }

    /**
     * ジェスチャー変更
     */
    handleGestureChange(e) {
        e.preventDefault();
        this.inputState.touch.gestureScale = e.scale;
        this.inputState.touch.gestureRotation = e.rotation;

        // 将来の拡張用（ズーム・回転）
    }

    /**
     * ジェスチャー終了
     */
    handleGestureEnd(e) {
        e.preventDefault();
        // ジェスチャー完了処理
    }

    /**
     * ゲームパッド接続
     */
    handleGamepadConnected(e) {
        console.log(`🎮 Gamepad connected: ${e.gamepad.id}`);
        this.inputState.gamepad.connected = true;
        this.inputState.gamepad.index = e.gamepad.index;
        this.inputState.gamepad.lastButtonState = new Array(e.gamepad.buttons.length).fill(false);
    }

    /**
     * ゲームパッド切断
     */
    handleGamepadDisconnected(e) {
        console.log(`🎮 Gamepad disconnected: ${e.gamepad.id}`);
        this.inputState.gamepad.connected = false;
        this.inputState.gamepad.index = -1;
        this.inputState.gamepad.lastButtonState = [];
    }

    /**
     * ゲームパッド状態更新
     */
    updateGamepadState() {
        if (!this.inputState.gamepad.connected) return;

        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.inputState.gamepad.index];

        if (!gamepad) return;

        // ボタン状態の更新
        gamepad.buttons.forEach((button, index) => {
            const wasPressed = this.inputState.gamepad.lastButtonState[index];
            const isPressed = button.pressed;

            if (isPressed && !wasPressed) {
                this.handleGamepadButtonPress(index);
            }

            this.inputState.gamepad.lastButtonState[index] = isPressed;
        });

        // アナログスティックの処理
        this.handleGamepadAxes(gamepad.axes);
    }

    /**
     * ゲームパッドボタン処理
     */
    handleGamepadButtonPress(buttonIndex) {
        if (!this.canPerformAction()) return;

        switch (buttonIndex) {
            case 0: // A ボタン
            case 1: // B ボタン
                this.performBallDrop();
                break;

            case 9: // Start ボタン
                GameState.pauseGame();
                break;

            case 8: // Select ボタン
                this.confirmGameReset();
                break;
        }
    }

    /**
     * ゲームパッドアナログスティック処理
     */
    handleGamepadAxes(axes) {
        if (axes.length >= 2) {
            const leftStickX = axes[0];
            const deadzone = 0.2;

            if (Math.abs(leftStickX) > deadzone) {
                const movement = leftStickX * 5; // 移動速度
                this.moveDropPosition(movement);
            }
        }
    }

    /**
     * ボール投下実行
     */
    performBallDrop() {
        if (!this.canPerformAction()) return;
        if (GameState.ballCount <= 0 || GameState.isPaused || GameState.isGameOver) {
            return;
        }

        // デバウンス制御
        const currentTime = Date.now();
        if (currentTime - this.lastActionTime < this.debounceTime) {
            return;
        }

        this.lastActionTime = currentTime;

        // プールからボールを取得
        const ballPool = window.poolManager?.getPool('ball');
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

            // 入力バッファに記録
            this.addToInputBuffer('ballDrop', {
                x: GameState.mouseX,
                y: CONFIG.BALL.INITIAL_Y,
                timestamp: currentTime
            });

            // フィードバック
            this.provideFeedback('ballDrop');
        }
    }

    /**
     * ゲームリセット確認
     */
    confirmGameReset() {
        if (GameState.isGameOver || confirm('ゲームをリセットしますか？')) {
            GameInitializer.resetGame();
            this.fireEvent('gameReset');
        }
    }

    /**
     * アクション実行可能性チェック
     */
    canPerformAction() {
        // 連続入力制限チェック
        const currentTime = Date.now();
        if (this.rapidInputCount > this.maxRapidInputs) {
            if (currentTime - this.inputState.mouse.lastClickTime < 1000) {
                return false;
            } else {
                this.rapidInputCount = 0; // リセット
            }
        }

        return true;
    }

    /**
     * 入力バッファに追加
     */
    addToInputBuffer(action, data) {
        this.inputBuffer.push({
            action,
            data,
            timestamp: Date.now()
        });

        // バッファサイズ制限
        if (this.inputBuffer.length > this.maxBufferSize) {
            this.inputBuffer.shift();
        }
    }

    /**
     * フィードバック提供
     */
    provideFeedback(action) {
        switch (action) {
            case 'ballDrop':
                // 視覚的フィードバック
                if (window.screenShake) {
                    window.screenShake.shake(1, 5);
                }

                // 触覚フィードバック（モバイル）
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                break;
        }
    }

    /**
     * イベント登録
     */
    addEventListener(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
    }

    /**
     * イベント削除
     */
    removeEventListener(eventType, handler) {
        if (this.eventHandlers.has(eventType)) {
            const handlers = this.eventHandlers.get(eventType);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * イベント発火
     */
    fireEvent(eventType, data = {}) {
        if (this.eventHandlers.has(eventType)) {
            this.eventHandlers.get(eventType).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in event handler for ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * 入力状態のリセット
     */
    resetInputState() {
        this.inputState.mouse.isPressed = false;
        this.inputState.mouse.isDown = false;
        this.inputState.mouse.isDragging = false;
        this.inputState.keyboard.pressedKeys.clear();
        this.inputState.keyboard.lastKeyTime.clear();
        this.inputState.touch.touches.clear();
        this.rapidInputCount = 0;
    }

    /**
     * 入力状態の取得
     */
    getInputState() {
        return {
            mouse: { ...this.inputState.mouse },
            keyboard: {
                pressedKeys: Array.from(this.inputState.keyboard.pressedKeys),
                keyCount: this.inputState.keyboard.pressedKeys.size
            },
            touch: {
                touchCount: this.inputState.touch.touches.size,
                lastTouchTime: this.inputState.touch.lastTouchTime
            },
            gamepad: { ...this.inputState.gamepad }
        };
    }

    /**
     * 入力統計の取得
     */
    getInputStats() {
        return {
            bufferSize: this.inputBuffer.length,
            rapidInputCount: this.rapidInputCount,
            lastActionTime: this.lastActionTime,
            eventHandlerCount: Array.from(this.eventHandlers.values())
                .reduce((total, handlers) => total + handlers.length, 0)
        };
    }

    /**
     * デバッグ情報の描画
     */
    drawDebugInfo(ctx) {
        if (!CONFIG.DEBUG.SHOW_FPS) return;

        const inputState = this.getInputState();
        const inputStats = this.getInputStats();

        const debugLines = [
            `Mouse: ${inputState.mouse.x.toFixed(0)}, ${inputState.mouse.y.toFixed(0)}`,
            `Keys: ${inputState.keyboard.keyCount}`,
            `Touches: ${inputState.touch.touchCount}`,
            `Buffer: ${inputStats.bufferSize}/${this.maxBufferSize}`,
            `Rapid: ${inputStats.rapidInputCount}/${this.maxRapidInputs}`
        ];

        ctx.save();
        ctx.font = '10px Share Tech Mono';
        ctx.fillStyle = CONFIG.COLORS.SECONDARY;
        ctx.textAlign = 'right';

        debugLines.forEach((line, index) => {
            ctx.fillText(line, CONFIG.GAME.CANVAS_WIDTH - 10, 50 + index * 12);
        });

        ctx.restore();
    }

    /**
     * 更新処理
     */
    update() {
        // ゲームパッド状態の更新
        this.updateGamepadState();

        // 古い入力バッファエントリの削除
        const now = Date.now();
        this.inputBuffer = this.inputBuffer.filter(entry =>
            now - entry.timestamp < 5000 // 5秒より古いエントリを削除
        );

        // 連続入力カウンターのリセット
        if (now - this.inputState.mouse.lastClickTime > 2000) {
            this.rapidInputCount = 0;
        }
    }

    /**
     * 破棄処理
     */
    destroy() {
        // イベントリスナーの削除
        this.eventHandlers.clear();
        this.inputBuffer = [];
        this.resetInputState();

        console.log('🎮 Input system destroyed');
    }
}

// 入力ヘルパー関数
const InputUtils = {
    /**
     * キーコードから表示名への変換
     */
    getKeyDisplayName(code) {
        const keyNames = {
            'Space': 'スペース',
            'KeyP': 'P',
            'KeyR': 'R',
            'Escape': 'ESC',
            'ArrowLeft': '←',
            'ArrowRight': '→',
            'ArrowUp': '↑',
            'ArrowDown': '↓'
        };

        return keyNames[code] || code;
    },

    /**
     * マウスボタンから表示名への変換
     */
    getMouseButtonName(button) {
        const buttonNames = {
            0: '左クリック',
            1: '中クリック',
            2: '右クリック'
        };

        return buttonNames[button] || `ボタン${button}`;
    },

    /**
     * タッチジェスチャーの判定
     */
    detectGesture(touches, lastTouches) {
        if (touches.length === 2 && lastTouches.length === 2) {
            // ピンチジェスチャーの検出
            const currentDistance = this.getTouchDistance(touches[0], touches[1]);
            const lastDistance = this.getTouchDistance(lastTouches[0], lastTouches[1]);

            const scale = currentDistance / lastDistance;

            if (scale > 1.1) return 'pinchOut';
            if (scale < 0.9) return 'pinchIn';
        }

        return null;
    },

    /**
     * 2点間の距離計算
     */
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * ブラウザの入力サポート判定
     */
    checkInputSupport() {
        return {
            mouse: 'onmousedown' in window,
            touch: 'ontouchstart' in window,
            gamepad: 'getGamepads' in navigator,
            vibration: 'vibrate' in navigator,
            pointerEvents: 'onpointerdown' in window
        };
    }
};

// グローバル入力ハンドラーの初期化
window.inputHandler = null;