// 高性能レンダリングシステム
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // レンダリング設定
        this.enableAntialiasing = true;
        this.enableImageSmoothing = true;
        this.pixelRatio = window.devicePixelRatio || 1;

        // パフォーマンス設定
        this.cullingEnabled = true;
        this.frustumCulling = {
            left: -50,
            right: this.width + 50,
            top: -50,
            bottom: this.height + 50
        };

        // レンダリング統計
        this.stats = {
            frameCount: 0,
            renderTime: 0,
            drawnObjects: 0,
            culledObjects: 0,
            lastFrameTime: 0
        };

        // エフェクト管理
        this.postProcessing = {
            enabled: CONFIG.EFFECTS.ENABLE_GLOW,
            bloom: false,
            screenDistortion: false
        };

        // バッファリング
        this.bufferCanvas = document.createElement('canvas');
        this.bufferCtx = this.bufferCanvas.getContext('2d');
        this.bufferCanvas.width = this.width;
        this.bufferCanvas.height = this.height;

        // レンダリング層
        this.layers = {
            background: [],
            game: [],
            effects: [],
            ui: []
        };

        this.setupCanvas();
    }

    /**
     * キャンバス初期設定
     */
    setupCanvas() {
        // 高DPI対応
        if (this.pixelRatio !== 1) {
            this.canvas.width = this.width * this.pixelRatio;
            this.canvas.height = this.height * this.pixelRatio;
            this.canvas.style.width = this.width + 'px';
            this.canvas.style.height = this.height + 'px';
            this.ctx.scale(this.pixelRatio, this.pixelRatio);
        }

        // レンダリング品質設定
        this.ctx.imageSmoothingEnabled = this.enableImageSmoothing;
        if (this.ctx.imageSmoothingQuality) {
            this.ctx.imageSmoothingQuality = 'high';
        }
    }

    /**
     * メインレンダリング処理
     */
    render() {
        const startTime = performance.now();

        // カリング領域のリセット
        this.stats.drawnObjects = 0;
        this.stats.culledObjects = 0;

        // キャンバスクリア
        this.clear();

        // 背景描画
        this.drawBackground();

        // 画面揺れ効果の適用
        if (window.screenShake) {
            window.screenShake.apply(this.ctx);
        }

        // ゲームオブジェクトの描画
        this.drawGameObjects();

        // パーティクルエフェクトの描画
        this.drawParticleEffects();

        // UI要素の描画
        this.drawUI();

        // 画面揺れ効果のリセット
        if (window.screenShake) {
            window.screenShake.reset(this.ctx);
        }

        // ポストプロセシング
        if (this.postProcessing.enabled) {
            this.applyPostProcessing();
        }

        // デバッグ情報
        if (CONFIG.DEBUG.SHOW_FPS) {
            this.drawDebugInfo();
        }

        // 統計更新
        this.stats.renderTime = performance.now() - startTime;
        this.stats.frameCount++;
        this.stats.lastFrameTime = startTime;
    }

    /**
     * キャンバスクリア
     */
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    /**
     * 背景描画
     */
    drawBackground() {
        // グラデーション背景
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, CONFIG.COLORS.BACKGROUND_START);
        gradient.addColorStop(0.5, '#0d1b2a');
        gradient.addColorStop(1, CONFIG.COLORS.BACKGROUND_END);

        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // サイバーグリッド効果
        this.drawCyberGrid();

        // スキャンライン効果
        this.drawScanlines();
    }

    /**
     * サイバーグリッド描画
     */
    drawCyberGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = Utils.Color.addAlpha(CONFIG.COLORS.PRIMARY, 0.03);
        this.ctx.lineWidth = 0.5;

        const gridSize = 25;
        const time = Date.now() * 0.001;

        // 縦線
        for (let x = 0; x <= this.width; x += gridSize) {
            const offset = Math.sin(time + x * 0.01) * 2;
            this.ctx.globalAlpha = 0.1 + Math.sin(time + x * 0.005) * 0.05;

            this.ctx.beginPath();
            this.ctx.moveTo(x + offset, 0);
            this.ctx.lineTo(x + offset, this.height);
            this.ctx.stroke();
        }

        // 横線
        for (let y = 0; y <= this.height; y += gridSize) {
            const offset = Math.sin(time + y * 0.01) * 2;
            this.ctx.globalAlpha = 0.1 + Math.sin(time + y * 0.005) * 0.05;

            this.ctx.beginPath();
            this.ctx.moveTo(0, y + offset);
            this.ctx.lineTo(this.width, y + offset);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    /**
     * スキャンライン効果
     */
    drawScanlines() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.02;
        this.ctx.fillStyle = CONFIG.COLORS.PRIMARY;

        const lineHeight = 2;
        const spacing = 4;

        for (let y = 0; y < this.height; y += spacing) {
            this.ctx.fillRect(0, y, this.width, lineHeight);
        }

        this.ctx.restore();
    }

    /**
     * ドロップライン描画
     */
    drawDropLine() {
        if (!GameState.mouseX) return;

        this.ctx.save();
        this.ctx.strokeStyle = CONFIG.COLORS.DROP_LINE;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 4]);

        // アニメーション効果
        const time = Date.now() * 0.005;
        this.ctx.lineDashOffset = time % 12;

        // グロー効果
        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            this.ctx.shadowColor = CONFIG.COLORS.PRIMARY;
            this.ctx.shadowBlur = 10;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(GameState.mouseX, 0);
        this.ctx.lineTo(GameState.mouseX, 60);
        this.ctx.stroke();

        // ターゲットマーカー
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.arc(GameState.mouseX, 30, 8, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * ゲームオブジェクト描画
     */
    drawGameObjects() {
        // ペグの描画
        if (GameState.pegs) {
            GameState.pegs.forEach(peg => {
                if (this.shouldRender(peg)) {
                    peg.draw(this.ctx);
                    this.stats.drawnObjects++;
                } else {
                    this.stats.culledObjects++;
                }
            });
        }

        // スロットの描画
        if (GameState.slots) {
            GameState.slots.forEach(slot => {
                if (this.shouldRender(slot)) {
                    slot.draw(this.ctx);
                    this.stats.drawnObjects++;
                } else {
                    this.stats.culledObjects++;
                }
            });
        }

        // ボールの描画
        if (GameState.balls) {
            GameState.balls.forEach(ball => {
                if (ball.isActive && this.shouldRender(ball)) {
                    ball.draw(this.ctx);
                    this.stats.drawnObjects++;
                } else {
                    this.stats.culledObjects++;
                }
            });
        }

        // ドロップライン
        this.drawDropLine();
    }

    /**
     * パーティクルエフェクト描画
     */
    drawParticleEffects() {
        if (window.particleSystem) {
            // パーティクルをZ順でソート（オプション）
            const particles = window.particleSystem.particles;

            particles.forEach(particle => {
                if (this.shouldRender(particle)) {
                    particle.draw(this.ctx);
                    this.stats.drawnObjects++;
                } else {
                    this.stats.culledObjects++;
                }
            });
        }
    }

    /**
     * UI要素描画
     */
    drawUI() {
        // ゲーム固有のUI要素（将来の拡張用）
        this.drawGameUI();
    }

    /**
     * ゲームUI描画
     */
    drawGameUI() {
        // パフォーマンス警告
        if (this.stats.renderTime > 20) { // 20ms以上かかった場合
            this.drawPerformanceWarning();
        }

        // コンボ表示（将来の実装）
        this.drawComboIndicator();
    }

    /**
     * パフォーマンス警告表示
     */
    drawPerformanceWarning() {
        this.ctx.save();
        this.ctx.fillStyle = Utils.Color.addAlpha(CONFIG.COLORS.WARNING, 0.8);
        this.ctx.font = '12px Share Tech Mono';
        this.ctx.textAlign = 'right';

        const warning = `⚠ High render time: ${this.stats.renderTime.toFixed(1)}ms`;
        this.ctx.fillText(warning, this.width - 10, 20);

        this.ctx.restore();
    }

    /**
     * コンボインジケーター
     */
    drawComboIndicator() {
        // 将来のコンボシステム用
    }

    /**
     * カリング判定
     */
    shouldRender(obj) {
        if (!this.cullingEnabled) return true;

        // 基本的な境界チェック
        if (obj.x + (obj.radius || obj.width || 0) < this.frustumCulling.left) return false;
        if (obj.x - (obj.radius || 0) > this.frustumCulling.right) return false;
        if (obj.y + (obj.radius || obj.height || 0) < this.frustumCulling.top) return false;
        if (obj.y - (obj.radius || 0) > this.frustumCulling.bottom) return false;

        return true;
    }

    /**
     * ポストプロセシング
     */
    applyPostProcessing() {
        if (this.postProcessing.bloom) {
            this.applyBloomEffect();
        }

        if (this.postProcessing.screenDistortion) {
            this.applyScreenDistortion();
        }
    }

    /**
     * ブルームエフェクト
     */
    applyBloomEffect() {
        // 高度なポストエフェクト（将来の実装）
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.globalAlpha = 0.3;

        // 軽いブルーム効果のシミュレーション
        this.ctx.filter = 'blur(2px)';
        this.ctx.drawImage(this.canvas, 0, 0);

        this.ctx.restore();
    }

    /**
     * 画面歪みエフェクト
     */
    applyScreenDistortion() {
        // CRTモニター風の歪み効果
        const time = Date.now() * 0.001;

        this.ctx.save();
        this.ctx.globalAlpha = 0.05;

        // 微細な歪み
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        // 歪み処理（重い処理のため簡略化）

        this.ctx.restore();
    }

    /**
     * デバッグ情報描画
     */
    drawDebugInfo() {
        if (!CONFIG.DEBUG.SHOW_FPS) return;

        const debugInfo = [
            `FPS: ${window.performanceMonitor ? window.performanceMonitor.fps : 'N/A'}`,
            `Render: ${this.stats.renderTime.toFixed(1)}ms`,
            `Objects: ${this.stats.drawnObjects}/${this.stats.drawnObjects + this.stats.culledObjects}`,
            `Culled: ${this.stats.culledObjects}`
        ];

        this.ctx.save();
        this.ctx.font = '10px Share Tech Mono';
        this.ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        this.ctx.textAlign = 'left';
        this.ctx.globalAlpha = 0.8;

        // 背景
        const bgHeight = debugInfo.length * 12 + 10;
        this.ctx.fillStyle = Utils.Color.addAlpha('#000000', 0.7);
        this.ctx.fillRect(5, 5, 150, bgHeight);

        // テキスト
        this.ctx.fillStyle = CONFIG.COLORS.PRIMARY;
        debugInfo.forEach((line, index) => {
            this.ctx.fillText(line, 10, 20 + index * 12);
        });

        this.ctx.restore();
    }

    /**
     * スクリーンショット撮影
     */
    captureScreenshot() {
        return this.canvas.toDataURL('image/png');
    }

    /**
     * レンダリング品質の調整
     */
    adjustQuality(qualityLevel) {
        // 0.1 - 1.0の範囲で品質を調整
        this.enableAntialiasing = qualityLevel > 0.5;
        this.enableImageSmoothing = qualityLevel > 0.3;
        this.cullingEnabled = qualityLevel < 0.8;
        this.postProcessing.enabled = qualityLevel > 0.7 && CONFIG.EFFECTS.ENABLE_GLOW;

        this.ctx.imageSmoothingEnabled = this.enableImageSmoothing;
    }

    /**
     * レンダリング統計の取得
     */
    getRenderStats() {
        return {
            ...this.stats,
            averageRenderTime: this.stats.frameCount > 0 ? this.stats.renderTime / this.stats.frameCount : 0,
            cullingEfficiency: this.stats.drawnObjects + this.stats.culledObjects > 0 ?
                (this.stats.culledObjects / (this.stats.drawnObjects + this.stats.culledObjects) * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * レンダラーのリセット
     */
    reset() {
        this.stats = {
            frameCount: 0,
            renderTime: 0,
            drawnObjects: 0,
            culledObjects: 0,
            lastFrameTime: 0
        };

        this.clear();
    }

    /**
     * リサイズ処理
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;

        // カリング領域の更新
        this.frustumCulling = {
            left: -50,
            right: width + 50,
            top: -50,
            bottom: height + 50
        };

        this.setupCanvas();
    }
}