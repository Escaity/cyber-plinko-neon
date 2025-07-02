// スロットクラス - サイバーパンクスタイル
class Slot {
    constructor(x, y, width, points, index = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = CONFIG.SLOT.HEIGHT;
        this.points = points;
        this.index = index;

        // ビジュアル設定
        this.baseColor = Utils.Color.getSlotColorByPoints(points);
        this.currentColor = this.baseColor;
        this.glowColor = this.baseColor;
        this.glowIntensity = 0.5;

        // アニメーション状態
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.isActivated = false;
        this.activationTime = 0;
        this.activationDuration = CONFIG.SLOT.EFFECT_DURATION;

        // スコア統計
        this.hitCount = 0;
        this.totalScore = 0;
        this.lastHitTime = 0;
        this.consecutiveHits = 0;

        // 視覚効果
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.borderWidth = 2;
        this.targetBorderWidth = 2;
        this.rippleEffects = [];

        // 特殊効果
        this.isJackpot = points >= 1000;
        this.comboMultiplier = 1.0;
        this.energyLevel = 0;
        this.maxEnergyLevel = 100;

        // パーティクル生成位置
        this.particleSpawnPoints = this.generateParticleSpawnPoints();
    }

    /**
     * パーティクル生成ポイントの計算
     */
    generateParticleSpawnPoints() {
        const points = [];
        const count = 5;

        for (let i = 0; i < count; i++) {
            points.push({
                x: this.x + (this.width / count) * i + (this.width / count / 2),
                y: this.y + this.height / 2
            });
        }

        return points;
    }

    /**
     * 更新処理
     */
    update(deltaTime = 1) {
        // パルス効果の更新
        this.updatePulseEffect(deltaTime);

        // アクティベーション状態の更新
        this.updateActivationState();

        // ビジュアル効果の更新
        this.updateVisualEffects(deltaTime);

        // リップルエフェクトの更新
        this.updateRippleEffects();

        // エネルギーレベルの更新
        this.updateEnergyLevel();
    }

    /**
     * パルス効果の更新
     */
    updatePulseEffect(deltaTime) {
        this.pulsePhase += 0.03 * deltaTime;

        // 得点の高さに応じたパルス強度
        const scoreRatio = this.points / Math.max(...CONFIG.SLOT.POINTS);
        const basePulse = (Math.sin(this.pulsePhase) + 1) * 0.5;

        this.glowIntensity = 0.3 + basePulse * 0.4 * scoreRatio;
    }

    /**
     * アクティベーション状態の更新
     */
    updateActivationState() {
        if (this.isActivated) {
            this.activationTime++;

            // アクティベーション中の効果
            const progress = this.activationTime / this.activationDuration;
            const pulseIntensity = Math.sin(progress * Math.PI * 6);

            this.targetScale = 1.0 + pulseIntensity * 0.05;
            this.targetBorderWidth = 2 + Math.abs(pulseIntensity) * 3;
            this.glowIntensity = 0.8 + Math.abs(pulseIntensity) * 0.2;

            // 色の変化
            this.currentColor = Utils.Color.adjustBrightness(this.baseColor, 1 + Math.abs(pulseIntensity) * 0.3);

            // アクティベーション終了
            if (this.activationTime >= this.activationDuration) {
                this.deactivate();
            }
        } else {
            this.currentColor = this.baseColor;
            this.targetScale = 1.0;
            this.targetBorderWidth = 2;
        }
    }

    /**
     * ビジュアル効果の更新
     */
    updateVisualEffects(deltaTime) {
        // スムーズなスケール変化
        this.scale = Utils.Math.lerp(this.scale, this.targetScale, 0.2);
        this.borderWidth = Utils.Math.lerp(this.borderWidth, this.targetBorderWidth, 0.3);

        // 連続ヒット時の特殊効果
        if (this.consecutiveHits > 2) {
            this.comboMultiplier = 1 + (this.consecutiveHits - 2) * 0.5;
        } else {
            this.comboMultiplier = 1.0;
        }
    }

    /**
     * リップルエフェクトの更新
     */
    updateRippleEffects() {
        this.rippleEffects = this.rippleEffects.filter(ripple => {
            ripple.radius += ripple.speed;
            ripple.alpha -= ripple.decay;
            ripple.y -= 1; // 上向きに移動
            return ripple.alpha > 0 && ripple.radius < this.width;
        });
    }

    /**
     * エネルギーレベルの更新
     */
    updateEnergyLevel() {
        // エネルギーの自然減衰
        this.energyLevel = Math.max(0, this.energyLevel - 0.5);

        // 高エネルギー時の特殊効果
        if (this.energyLevel > 80) {
            this.createEnergyOverflowEffect();
        }
    }

    /**
     * ボールヒット処理
     */
    onBallHit(ball) {
        const currentTime = Date.now();
        this.hitCount++;
        this.lastHitTime = currentTime;

        // 連続ヒット判定
        if (currentTime - this.lastHitTime < 2000) {
            this.consecutiveHits++;
        } else {
            this.consecutiveHits = 1;
        }

        // 実際の得点計算
        const finalScore = this.calculateFinalScore(ball);
        this.totalScore += finalScore;

        // エネルギー増加
        this.addEnergy(finalScore / 10);

        // アクティベーション
        this.activate();

        // エフェクト生成
        this.createHitEffects(ball, finalScore);

        return finalScore;
    }

    /**
     * 最終得点の計算
     */
    calculateFinalScore(ball) {
        let score = this.points;

        // ボールのマルチプライヤー適用
        if (ball.scoreMultiplier && ball.multiplierEndTime > Date.now()) {
            score *= ball.scoreMultiplier;
        }

        // スロットのコンボマルチプライヤー適用
        score *= this.comboMultiplier;

        // エネルギーボーナス
        const energyBonus = this.energyLevel > 50 ? 1.2 : 1.0;
        score *= energyBonus;

        return Math.floor(score);
    }

    /**
     * アクティベーション
     */
    activate() {
        this.isActivated = true;
        this.activationTime = 0;
    }

    /**
     * ディアクティベーション
     */
    deactivate() {
        this.isActivated = false;
        this.activationTime = 0;
        this.consecutiveHits = Math.max(0, this.consecutiveHits - 1);
    }

    /**
     * エネルギー追加
     */
    addEnergy(amount) {
        this.energyLevel = Math.min(this.maxEnergyLevel, this.energyLevel + amount);
    }

    /**
     * ヒットエフェクトの生成
     */
    createHitEffects(ball, finalScore) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // リップルエフェクト
        this.createRippleEffect();

        // パーティクルエフェクト
        if (window.particleSystem) {
            const intensity = Math.min(finalScore / 500, 3);
            window.particleSystem.createSlotHitEffect(centerX, centerY, finalScore, this.currentColor);

            // ジャックポット時の特殊エフェクト
            if (this.isJackpot) {
                this.createJackpotEffect(centerX, centerY);
            }
        }

        // 画面揺れ
        if (window.screenShake) {
            const shakeIntensity = Math.min(finalScore / 1000, 1) * 4;
            window.screenShake.shake(shakeIntensity, 25);
        }
    }

    /**
     * リップルエフェクトの生成
     */
    createRippleEffect() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        this.rippleEffects.push({
            x: centerX,
            y: centerY,
            radius: 0,
            alpha: 1.0,
            speed: 3,
            decay: 0.03,
            color: this.currentColor
        });
    }

    /**
     * ジャックポットエフェクト
     */
    createJackpotEffect(x, y) {
        if (!window.particleSystem) return;

        // 大規模爆発
        window.particleSystem.createExplosion(x, y, this.currentColor, 4.0);

        // 複数のパーティクル生成ポイントから同時発射
        this.particleSpawnPoints.forEach((point, index) => {
            setTimeout(() => {
                window.particleSystem.createExplosion(point.x, point.y, this.currentColor, 2.0);
            }, index * 100);
        });

        // 連続画面揺れ
        if (window.screenShake) {
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    window.screenShake.shake(3, 15);
                }, i * 200);
            }
        }
    }

    /**
     * エネルギーオーバーフロー効果
     */
    createEnergyOverflowEffect() {
        if (Math.random() < 0.1 && window.particleSystem) { // 10%の確率で発動
            const centerX = this.x + this.width / 2;
            const centerY = this.y;

            window.particleSystem.createSparks(centerX, centerY, 8, this.currentColor);
        }
    }

    /**
     * 描画処理
     */
    draw(ctx) {
        ctx.save();

        // リップルエフェクトの描画
        this.drawRippleEffects(ctx);

        // メインスロットの描画
        this.drawMainSlot(ctx);

        // グローエフェクト
        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            this.drawGlowEffect(ctx);
        }

        // エネルギーレベル表示
        if (this.energyLevel > 20) {
            this.drawEnergyIndicator(ctx);
        }

        // コンボマルチプライヤー表示
        if (this.comboMultiplier > 1) {
            this.drawComboIndicator(ctx);
        }

        ctx.restore();
    }

    /**
     * リップルエフェクト描画
     */
    drawRippleEffects(ctx) {
        this.rippleEffects.forEach(ripple => {
            ctx.save();
            ctx.globalAlpha = ripple.alpha * 0.7;
            ctx.strokeStyle = ripple.color;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        });
    }

    /**
     * メインスロット描画
     */
    drawMainSlot(ctx) {
        const x = this.x;
        const y = this.y;
        const width = this.width * this.scale;
        const height = this.height * this.scale;

        // 影
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 3, y + 3, width, height);
        ctx.restore();

        // グラデーション背景
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, Utils.Color.adjustBrightness(this.currentColor, 0.8));
        gradient.addColorStop(0.5, this.currentColor);
        gradient.addColorStop(1, Utils.Color.adjustBrightness(this.currentColor, 0.4));

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, width, height);

        // 境界線
        ctx.strokeStyle = Utils.Color.adjustBrightness(this.currentColor, 1.5);
        ctx.lineWidth = this.borderWidth;
        ctx.strokeRect(x, y, width, height);

        // 内部パターン
        this.drawInternalPattern(ctx, x, y, width, height);

        // 得点テキスト
        this.drawScoreText(ctx, x, y, width, height);
    }

    /**
     * 内部パターン描画
     */
    drawInternalPattern(ctx, x, y, width, height) {
        ctx.save();
        ctx.strokeStyle = Utils.Color.addAlpha(this.currentColor, 0.4);
        ctx.lineWidth = 1;

        // 垂直線
        const lineCount = 4;
        for (let i = 1; i < lineCount; i++) {
            const lineX = x + (width / lineCount) * i;
            ctx.beginPath();
            ctx.moveTo(lineX, y + height * 0.2);
            ctx.lineTo(lineX, y + height * 0.8);
            ctx.stroke();
        }

        // 水平線
        const midY = y + height / 2;
        ctx.beginPath();
        ctx.moveTo(x + width * 0.1, midY);
        ctx.lineTo(x + width * 0.9, midY);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * 得点テキスト描画
     */
    drawScoreText(ctx, x, y, width, height) {
        ctx.save();

        // テキストの設定
        const fontSize = Math.min(width / 6, 18);
        ctx.font = `bold ${fontSize}px Orbitron`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = x + width / 2;
        const centerY = y + height / 2;

        // テキストの影
        ctx.fillStyle = '#000000';
        ctx.globalAlpha = 0.5;
        ctx.fillText(this.points.toString(), centerX + 1, centerY + 1);

        // メインテキスト
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = Utils.Color.adjustBrightness(this.currentColor, 2.0);

        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            ctx.shadowColor = this.currentColor;
            ctx.shadowBlur = 8;
        }

        ctx.fillText(this.points.toString(), centerX, centerY);

        ctx.restore();
    }

    /**
     * グローエフェクト描画
     */
    drawGlowEffect(ctx) {
        ctx.save();
        ctx.globalAlpha = this.glowIntensity * 0.3;
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 20;

        ctx.fillStyle = Utils.Color.addAlpha(this.glowColor, 0.1);
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.restore();
    }

    /**
     * エネルギーインジケーター描画
     */
    drawEnergyIndicator(ctx) {
        const energyRatio = this.energyLevel / this.maxEnergyLevel;

        ctx.save();
        ctx.globalAlpha = 0.8;

        // エネルギーバー
        const barWidth = this.width * 0.8;
        const barHeight = 3;
        const barX = this.x + (this.width - barWidth) / 2;
        const barY = this.y - 8;

        // 背景
        ctx.fillStyle = Utils.Color.addAlpha('#ffffff', 0.2);
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // エネルギー
        ctx.fillStyle = this.currentColor;
        ctx.fillRect(barX, barY, barWidth * energyRatio, barHeight);

        ctx.restore();
    }

    /**
     * コンボインジケーター描画
     */
    drawComboIndicator(ctx) {
        ctx.save();

        const centerX = this.x + this.width / 2;
        const textY = this.y - 15;

        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = CONFIG.COLORS.WARNING;

        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            ctx.shadowColor = CONFIG.COLORS.WARNING;
            ctx.shadowBlur = 5;
        }

        ctx.fillText(`x${this.comboMultiplier.toFixed(1)}`, centerX, textY);

        ctx.restore();
    }

    /**
     * 統計情報の取得
     */
    getStats() {
        return {
            hitCount: this.hitCount,
            totalScore: this.totalScore,
            averageScore: this.hitCount > 0 ? Math.round(this.totalScore / this.hitCount) : 0,
            consecutiveHits: this.consecutiveHits,
            energyLevel: this.energyLevel,
            comboMultiplier: this.comboMultiplier
        };
    }

    /**
     * リセット
     */
    reset() {
        this.hitCount = 0;
        this.totalScore = 0;
        this.lastHitTime = 0;
        this.consecutiveHits = 0;
        this.isActivated = false;
        this.activationTime = 0;
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.borderWidth = 2;
        this.targetBorderWidth = 2;
        this.rippleEffects = [];
        this.comboMultiplier = 1.0;
        this.energyLevel = 0;
        this.currentColor = this.baseColor;
    }
}