// 修正版ボールクラス - プール統合とリセット処理強化
class Ball extends PhysicsEntity {
    constructor(x, y, options = {}) {
        super(x, y, {
            radius: CONFIG.BALL.RADIUS,
            mass: 1,
            bounce: CONFIG.PHYSICS.BOUNCE,
            friction: CONFIG.PHYSICS.FRICTION,
            gravity: CONFIG.PHYSICS.GRAVITY,
            collisionGroup: 'ball',
            collisionMask: ['ball', 'peg', 'slot'],
            ...options
        });

        this.type = 'ball';
        this.color = Utils.Color.generateRandomCyberColor();
        this.baseColor = this.color;
        this.glowColor = this.color;
        this.glowIntensity = CONFIG.BALL.GLOW_INTENSITY;

        // ビジュアル効果
        this.trail = [];
        this.maxTrailLength = CONFIG.BALL.TRAIL_LENGTH;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.energyLevel = 1.0; // エネルギーレベル（0-1）

        // アニメーション
        this.rotationAngle = 0;
        this.rotationSpeed = 0;
        this.scale = 1.0;
        this.targetScale = 1.0;

        // 特殊効果
        this.isCharged = false;
        this.chargeLevel = 0;
        this.lastCollisionTime = 0;
        this.collisionCount = 0;

        // プール管理用フラグ
        this.isPooled = false;

        // サウンドと振動（将来の拡張用）
        this.soundEnabled = CONFIG.AUDIO.ENABLE_SOUND;

        // 初期速度のランダム化
        this.vx += (Math.random() - 0.5) * CONFIG.BALL.RANDOM_VELOCITY_RANGE;
    }

    /**
     * 更新処理
     */
    update(deltaTime = 1) {
        if (!this.isActive) return;

        // 基底クラスの物理更新
        // super.update(deltaTime);

        // トレイル更新
        this.updateTrail();

        // ビジュアル効果更新
        this.updateVisualEffects(deltaTime);

        // 回転更新
        this.updateRotation(deltaTime);

        // エネルギーレベル更新
        this.updateEnergyLevel();

        // スロット判定
        this.checkSlotCollision();

        // 画面外チェック
        this.checkOutOfBounds();
    }

    /**
     * トレイル更新
     */
    updateTrail() {
        if (!CONFIG.EFFECTS.ENABLE_TRAILS) return;

        // 現在位置をトレイルに追加
        this.trail.push({
            x: this.x,
            y: this.y,
            time: Date.now(),
            alpha: 1.0
        });

        // 古いトレイルポイントを削除
        while (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }

        // アルファ値の更新
        this.trail.forEach((point, index) => {
            point.alpha = index / this.trail.length;
        });
    }

    /**
     * ビジュアル効果の更新
     */
    updateVisualEffects(deltaTime) {
        // パルス効果
        this.pulsePhase += 0.1 * deltaTime;
        const pulseIntensity = (Math.sin(this.pulsePhase) + 1) * 0.5;
        this.glowIntensity = CONFIG.BALL.GLOW_INTENSITY * (0.7 + pulseIntensity * 0.3);

        // 速度に基づく色変化
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedFactor = Math.min(speed / 10, 1);

        if (speedFactor > 0.5) {
            // 高速時は色を変更
            this.color = Utils.Color.adjustBrightness(this.baseColor, 1 + speedFactor * 0.5);
        } else {
            this.color = this.baseColor;
        }

        // スケールアニメーション
        this.scale = Utils.Math.lerp(this.scale, this.targetScale, 0.1);

        // チャージエフェクト
        if (this.isCharged) {
            this.chargeLevel = Math.min(this.chargeLevel + 0.02, 1.0);
        } else {
            this.chargeLevel = Math.max(this.chargeLevel - 0.05, 0);
        }
    }

    /**
     * 回転の更新
     */
    updateRotation(deltaTime) {
        // 速度に基づく回転
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.rotationSpeed = speed * 0.1;
        this.rotationAngle += this.rotationSpeed * deltaTime;

        // 角度の正規化
        this.rotationAngle = Utils.Math.normalizeAngle(this.rotationAngle);
    }

    /**
     * エネルギーレベルの更新
     */
    updateEnergyLevel() {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.energyLevel = Math.min(speed / CONFIG.PHYSICS.MAX_VELOCITY, 1.0);

        // 低エネルギー時の処理
        if (this.energyLevel < 0.1 && this.y > CONFIG.GAME.CANVAS_HEIGHT - 100) {
            this.targetScale = 0.8; // 小さくなる
        } else {
            this.targetScale = 1.0;
        }
    }

    /**
     * スロット衝突判定
     */
    checkSlotCollision() {
        if (this.y > CONFIG.GAME.CANVAS_HEIGHT - CONFIG.SLOT.HEIGHT - 20) {
            const slotIndex = Math.floor(this.x / (CONFIG.GAME.CANVAS_WIDTH / CONFIG.SLOT.COUNT));

            if (slotIndex >= 0 && slotIndex < CONFIG.SLOT.COUNT && window.GameState) {
                const points = CONFIG.SLOT.POINTS[slotIndex];
                const slotColor = Utils.Color.getSlotColorByPoints(points);

                // 得点エフェクト
                this.createSlotHitEffect(points, slotColor);

                // 得点更新
                window.GameState.updateScore(points);

                // ボールを非アクティブ化
                this.destroy();
            }
        }
    }

    /**
     * 画面外チェック
     */
    checkOutOfBounds() {
        if (this.y > CONFIG.GAME.CANVAS_HEIGHT + 50) {
            this.destroy();
        }
    }

    /**
     * スロットヒットエフェクト
     */
    createSlotHitEffect(points, color) {
        if (window.particleSystem) {
            const intensity = Math.min(points / 500, 3);
            window.particleSystem.createSlotHitEffect(this.x, this.y, points, color);
        }

        if (window.screenShake) {
            const shakeIntensity = Math.min(points / 1000, 1) * 3;
            window.screenShake.shake(shakeIntensity, 20);
        }
    }

    /**
     * 衝突時の処理
     */
    onCollision(other) {
        this.lastCollisionTime = Date.now();
        this.collisionCount++;

        // 衝突エフェクト
        this.targetScale = 1.2; // 一時的に大きくなる

        // エネルギーチャージ
        if (other.type === 'peg') {
            this.isCharged = true;
            setTimeout(() => { this.isCharged = false; }, 500);
        }

        // パーティクルエフェクト
        if (window.particleSystem) {
            window.particleSystem.createTrail(this.x, this.y, this.color, this.radius * 0.8);
        }
    }

    /**
     * 特殊能力の発動
     */
    activateSpecialAbility() {
        if (this.collisionCount >= 5 && !this.isCharged) {
            // マルチボール効果（将来の拡張）
            this.createMultiBall();
            this.collisionCount = 0;
        }
    }

    /**
     * マルチボール生成
     */
    createMultiBall() {
        if (window.GameState && window.GameState.balls.length < CONFIG.GAME.MAX_BALLS_ON_SCREEN) {
            const angle1 = Math.random() * Math.PI * 2;
            const angle2 = angle1 + Math.PI;
            const speed = 3;

            // プールからボールを取得
            const ballPool = window.poolManager?.getPool('ball');

            let ball1, ball2;

            if (ballPool) {
                ball1 = ballPool.acquire(this.x, this.y, {
                    vx: Math.cos(angle1) * speed,
                    vy: Math.sin(angle1) * speed
                });
                ball2 = ballPool.acquire(this.x, this.y, {
                    vx: Math.cos(angle2) * speed,
                    vy: Math.sin(angle2) * speed
                });
            } else {
                ball1 = new Ball(this.x, this.y, {
                    vx: Math.cos(angle1) * speed,
                    vy: Math.sin(angle1) * speed
                });
                ball2 = new Ball(this.x, this.y, {
                    vx: Math.cos(angle2) * speed,
                    vy: Math.sin(angle2) * speed
                });
            }

            window.GameState.addBall(ball1);
            window.GameState.addBall(ball2);

            // エフェクト
            if (window.particleSystem) {
                window.particleSystem.createExplosion(this.x, this.y, this.color, 1.5);
            }
        }
    }

    /**
     * 描画処理
     */
    draw(ctx) {
        if (!this.isActive) return;

        ctx.save();

        // トレイルの描画
        this.drawTrail(ctx);

        // メインボールの描画
        this.drawMainBall(ctx);

        // グローエフェクト
        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            this.drawGlowEffect(ctx);
        }

        // チャージエフェクト
        if (this.chargeLevel > 0) {
            this.drawChargeEffect(ctx);
        }

        // デバッグ情報
        this.drawDebugInfo(ctx);

        ctx.restore();
    }

    /**
     * トレイル描画
     */
    drawTrail(ctx) {
        if (!CONFIG.EFFECTS.ENABLE_TRAILS || this.trail.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < this.trail.length; i++) {
            const prev = this.trail[i - 1];
            const curr = this.trail[i];

            const alpha = curr.alpha * 0.6;
            const width = (this.radius * 0.5) * alpha;

            ctx.globalAlpha = alpha;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = width;

            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * メインボール描画
     */
    drawMainBall(ctx) {
        const radius = this.radius * this.scale;

        // 影
        ctx.save();
        ctx.translate(this.x + 2, this.y + 2);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // メインボール
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);
        ctx.scale(this.scale, this.scale);

        // グラデーション
        const gradient = ctx.createRadialGradient(
            -radius * 0.3, -radius * 0.3, 0,
            0, 0, radius
        );
        gradient.addColorStop(0, Utils.Color.adjustBrightness(this.color, 1.5));
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, Utils.Color.adjustBrightness(this.color, 0.6));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // 境界線
        ctx.strokeStyle = Utils.Color.adjustBrightness(this.color, 1.2);
        ctx.lineWidth = 1;
        ctx.stroke();

        // 内部デザイン（回路パターン）
        this.drawCircuitPattern(ctx, radius);

        ctx.restore();
    }

    /**
     * 回路パターンの描画
     */
    drawCircuitPattern(ctx, radius) {
        ctx.save();
        ctx.strokeStyle = Utils.Color.addAlpha(this.color, 0.8);
        ctx.lineWidth = 0.5;

        // 十字パターン
        ctx.beginPath();
        ctx.moveTo(-radius * 0.6, 0);
        ctx.lineTo(radius * 0.6, 0);
        ctx.moveTo(0, -radius * 0.6);
        ctx.lineTo(0, radius * 0.6);
        ctx.stroke();

        // 円形パターン
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
        ctx.stroke();

        // ドット
        const dots = 8;
        for (let i = 0; i < dots; i++) {
            const angle = (Math.PI * 2 / dots) * i;
            const x = Math.cos(angle) * radius * 0.5;
            const y = Math.sin(angle) * radius * 0.5;

            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * グローエフェクト描画
     */
    drawGlowEffect(ctx) {
        const glowRadius = this.radius * this.scale * 2;

        ctx.save();
        ctx.globalAlpha = this.glowIntensity * 0.5;
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = glowRadius;

        ctx.fillStyle = Utils.Color.addAlpha(this.glowColor, 0.1);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * this.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * チャージエフェクト描画
     */
    drawChargeEffect(ctx) {
        const chargeRadius = this.radius * this.scale * (1 + this.chargeLevel);

        ctx.save();
        ctx.globalAlpha = this.chargeLevel * 0.7;

        // 電気のようなエフェクト
        const spikes = 12;
        ctx.strokeStyle = CONFIG.COLORS.SECONDARY;
        ctx.lineWidth = 2;

        ctx.beginPath();
        for (let i = 0; i < spikes; i++) {
            const angle = (Math.PI * 2 / spikes) * i;
            const innerRadius = chargeRadius * 0.8;
            const outerRadius = chargeRadius * (0.9 + Math.random() * 0.3);

            const x1 = this.x + Math.cos(angle) * innerRadius;
            const y1 = this.y + Math.sin(angle) * innerRadius;
            const x2 = this.x + Math.cos(angle) * outerRadius;
            const y2 = this.y + Math.sin(angle) * outerRadius;

            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();

        ctx.restore();
    }

    /**
     * 状態のリセット（プール用・強化版）
     */
    reset(x, y) {
        // 位置とベクトルのリセット
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.vx = (Math.random() - 0.5) * CONFIG.BALL.RANDOM_VELOCITY_RANGE;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;

        // 状態フラグのリセット
        this.isActive = true;
        this.canCollide = true;

        // ビジュアル要素のリセット
        this.trail = [];
        this.collisionCount = 0;
        this.isCharged = false;
        this.chargeLevel = 0;
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.rotationAngle = 0;
        this.rotationSpeed = 0;
        this.energyLevel = 1.0;

        // 色のリセット
        this.color = Utils.Color.generateRandomCyberColor();
        this.baseColor = this.color;
        this.glowColor = this.color;
        this.glowIntensity = CONFIG.BALL.GLOW_INTENSITY;

        // パルス効果のリセット
        this.pulsePhase = Math.random() * Math.PI * 2;

        // 時間関連のリセット
        this.lastCollisionTime = 0;
        this.age = 0;

        // プール用フラグの設定
        this.isPooled = true;

        console.log('Ball reset for pool reuse');
    }

    /**
     * ボールの破棄（プール対応版）
     */
    destroy() {
        this.isActive = false;

        // 消失エフェクト
        if (window.particleSystem) {
            window.particleSystem.createExplosion(this.x, this.y, this.color, 0.8);
        }

        // プール由来のボールの場合は、GameStateから削除する際にプールに返却される
        // 直接プールに返却はしない（二重解放を防ぐため）
    }

    /**
     * 状態の取得（デバッグ用）
     */
    getState() {
        return {
            ...super.getState(),
            color: this.color,
            energyLevel: this.energyLevel,
            collisionCount: this.collisionCount,
            isCharged: this.isCharged,
            isPooled: this.isPooled,
            trail: this.trail.length,
            rotationAngle: this.rotationAngle
        };
    }

    /**
     * プール統計情報の取得
     */
    getPoolInfo() {
        return {
            isPooled: this.isPooled,
            canBePooled: true,
            resetCount: this.resetCount || 0,
            poolOrigin: this.isPooled ? 'pool' : 'direct'
        };
    }

    /**
     * デバッグ情報描画（拡張版）
     */
    drawDebugInfo(ctx) {
        if (!CONFIG.DEBUG.SHOW_COLLISION_BOXES) return;

        super.drawDebugInfo(ctx);

        // プール情報の表示
        if (CONFIG.DEBUG.LOG_PERFORMANCE) {
            ctx.save();
            ctx.font = '8px monospace';
            ctx.fillStyle = this.isPooled ? 'lime' : 'orange';
            ctx.textAlign = 'center';
            ctx.fillText(
                this.isPooled ? 'P' : 'D',
                this.x,
                this.y + this.radius + 15
            );
            ctx.restore();
        }
    }

    /**
     * エラーハンドリング強化
     */
    safeUpdate(deltaTime = 1) {
        try {
            this.update(deltaTime);
            return true;
        } catch (error) {
            console.error('Error updating ball:', error);
            console.error('Ball state:', this.getState());

            // エラーが発生した場合はボールを非アクティブ化
            this.isActive = false;
            return false;
        }
    }

    /**
     * 安全な描画処理
     */
    safeDraw(ctx) {
        try {
            this.draw(ctx);
            return true;
        } catch (error) {
            console.error('Error drawing ball:', error);
            console.error('Ball state:', this.getState());
            return false;
        }
    }

    /**
     * メモリ使用量の推定
     */
    getMemoryFootprint() {
        const baseSize = 200; // 基本オブジェクトサイズ(bytes)
        const trailSize = this.trail.length * 24; // トレイルデータ
        const colorSize = 50; // 色情報

        return baseSize + trailSize + colorSize;
    }

    /**
     * パフォーマンス最適化用の軽量更新
     */
    lightweightUpdate(deltaTime = 1) {
        // 最小限の更新のみ実行
        super.updatePosition(deltaTime);

        // 重い処理をスキップ
        // - トレイル更新なし
        // - 詳細なビジュアル効果なし
        // - 基本的な物理演算のみ

        this.checkOutOfBounds();
        this.checkSlotCollision();
    }

    /**
     * 品質レベルに応じた更新
     */
    qualityUpdate(deltaTime = 1, qualityLevel = 1.0) {
        if (qualityLevel > 0.7) {
            // 高品質更新
            this.update(deltaTime);
        } else if (qualityLevel > 0.3) {
            // 中品質更新（一部エフェクト削減）
            super.update(deltaTime);
            this.updateVisualEffects(deltaTime);
            this.checkSlotCollision();
            this.checkOutOfBounds();
        } else {
            // 低品質更新（最小限）
            this.lightweightUpdate(deltaTime);
        }
    }

    /**
     * ボールの複製（デバッグ・テスト用）
     */
    clone() {
        const clonedBall = new Ball(this.x, this.y, {
            vx: this.vx,
            vy: this.vy,
            color: this.color
        });

        // 追加プロパティのコピー
        clonedBall.energyLevel = this.energyLevel;
        clonedBall.collisionCount = this.collisionCount;
        clonedBall.isCharged = this.isCharged;

        return clonedBall;
    }

    /**
     * ボールの正常性チェック
     */
    validate() {
        const issues = [];

        // 位置の正常性
        if (isNaN(this.x) || isNaN(this.y)) {
            issues.push('Invalid position coordinates');
        }

        // 速度の正常性
        if (isNaN(this.vx) || isNaN(this.vy)) {
            issues.push('Invalid velocity values');
        }

        // 速度の異常値チェック
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > CONFIG.PHYSICS.MAX_VELOCITY * 2) {
            issues.push('Velocity exceeds safe limits');
        }

        // スケールの正常性
        if (isNaN(this.scale) || this.scale <= 0) {
            issues.push('Invalid scale value');
        }

        // 色の正常性
        if (!this.color || typeof this.color !== 'string') {
            issues.push('Invalid color value');
        }

        return {
            isValid: issues.length === 0,
            issues: issues
        };
    }

    /**
     * 自動修復機能
     */
    autoRepair() {
        const validation = this.validate();

        if (!validation.isValid) {
            console.warn('Auto-repairing ball:', validation.issues);

            // 位置の修復
            if (isNaN(this.x)) this.x = CONFIG.GAME.CANVAS_WIDTH / 2;
            if (isNaN(this.y)) this.y = CONFIG.BALL.INITIAL_Y;

            // 速度の修復
            if (isNaN(this.vx)) this.vx = 0;
            if (isNaN(this.vy)) this.vy = 0;

            // 速度制限
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > CONFIG.PHYSICS.MAX_VELOCITY) {
                const scale = CONFIG.PHYSICS.MAX_VELOCITY / speed;
                this.vx *= scale;
                this.vy *= scale;
            }

            // スケールの修復
            if (isNaN(this.scale) || this.scale <= 0) this.scale = 1.0;

            // 色の修復
            if (!this.color || typeof this.color !== 'string') {
                this.color = Utils.Color.generateRandomCyberColor();
                this.baseColor = this.color;
            }

            console.log('Ball auto-repair completed');
            return true;
        }

        return false;
    }
}