// ペグクラス - サイバーパンクスタイル
class Peg extends StaticPhysicsEntity {
    constructor(x, y, options = {}) {
        super(x, y, {
            radius: CONFIG.PEG.RADIUS,
            collisionGroup: 'peg',
            collisionMask: ['ball'],
            ...options
        });

        this.type = 'peg';
        this.baseColor = CONFIG.COLORS.PEG_IDLE;
        this.activeColor = CONFIG.COLORS.PEG_ACTIVE;
        this.currentColor = this.baseColor;

        // アニメーション状態
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.glowIntensity = 0.5;
        this.isActivated = false;
        this.activationTime = 0;
        this.activationDuration = 30; // フレーム数

        // ヒット統計
        this.hitCount = 0;
        this.lastHitTime = 0;
        this.consecutiveHits = 0;

        // 特殊効果
        this.energyLevel = 0;
        this.maxEnergyLevel = 100;
        this.energyDecayRate = 0.5;

        // ビジュアル効果
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.rotationAngle = 0;
        this.rippleEffect = [];

        // サウンド設定
        this.soundEnabled = CONFIG.AUDIO.ENABLE_SOUND;
        this.pitchVariation = Math.random() * 0.4 + 0.8; // 0.8-1.2
    }

    /**
     * 更新処理
     */
    update(deltaTime = 1) {
        // パルス効果の更新
        this.updatePulseEffect(deltaTime);

        // アクティベーション状態の更新
        this.updateActivationState();

        // エネルギーレベルの更新
        this.updateEnergyLevel();

        // ビジュアル効果の更新
        this.updateVisualEffects(deltaTime);

        // リップルエフェクトの更新
        this.updateRippleEffects();
    }

    /**
     * パルス効果の更新
     */
    updatePulseEffect(deltaTime) {
        this.pulsePhase += CONFIG.PEG.GLOW_PULSE_SPEED * deltaTime;

        // エネルギーレベルに基づくパルス強度
        const energyFactor = this.energyLevel / this.maxEnergyLevel;
        const basePulse = (Math.sin(this.pulsePhase) + 1) * 0.5;

        this.glowIntensity = 0.3 + basePulse * 0.4 + energyFactor * 0.3;
    }

    /**
     * アクティベーション状態の更新
     */
    updateActivationState() {
        if (this.isActivated) {
            this.activationTime++;

            // アクティベーション中の色変化
            const progress = this.activationTime / this.activationDuration;
            this.currentColor = this.activeColor;
            this.targetScale = 1.0 + Math.sin(progress * Math.PI * 4) * 0.1;

            // アクティベーション終了
            if (this.activationTime >= this.activationDuration) {
                this.deactivate();
            }
        } else {
            this.currentColor = this.baseColor;
            this.targetScale = 1.0;
        }
    }

    /**
     * エネルギーレベルの更新
     */
    updateEnergyLevel() {
        // エネルギーの自然減衰
        this.energyLevel = Math.max(0, this.energyLevel - this.energyDecayRate);

        // 色の調整
        const energyRatio = this.energyLevel / this.maxEnergyLevel;
        if (energyRatio > 0.1) {
            this.currentColor = Utils.Color.adjustBrightness(this.baseColor, 1 + energyRatio);
        }
    }

    /**
     * ビジュアル効果の更新
     */
    updateVisualEffects(deltaTime) {
        // スケールのスムーズ変化
        this.scale = Utils.Math.lerp(this.scale, this.targetScale, 0.2);

        // 回転（エネルギーがある場合）
        if (this.energyLevel > 10) {
            this.rotationAngle += 0.02 * (this.energyLevel / this.maxEnergyLevel);
        }

        // 連続ヒット時の特殊効果
        if (this.consecutiveHits > 3) {
            this.createSpecialEffect();
        }
    }

    /**
     * リップルエフェクトの更新
     */
    updateRippleEffects() {
        this.rippleEffect = this.rippleEffect.filter(ripple => {
            ripple.radius += ripple.speed;
            ripple.alpha -= ripple.decay;
            return ripple.alpha > 0 && ripple.radius < 50;
        });
    }

    /**
     * ヒット処理
     */
    onHit(ball) {
        const currentTime = Date.now();
        this.hitCount++;
        this.lastHitTime = currentTime;

        // 連続ヒット判定
        if (currentTime - this.lastHitTime < 1000) {
            this.consecutiveHits++;
        } else {
            this.consecutiveHits = 1;
        }

        // エネルギー増加
        this.addEnergy(20);

        // アクティベーション
        this.activate();

        // リップルエフェクト
        this.createRippleEffect();

        // ボールにエフェクト適用
        this.applyEffectToBall(ball);

        // サウンド再生（将来の拡張）
        this.playHitSound();
    }

    /**
     * アクティベーション
     */
    activate() {
        this.isActivated = true;
        this.activationTime = 0;
        this.targetScale = 1.3;

        // パーティクル効果
        if (window.particleSystem) {
            window.particleSystem.createSparks(this.x, this.y, 3, this.activeColor);
        }
    }

    /**
     * ディアクティベーション
     */
    deactivate() {
        this.isActivated = false;
        this.activationTime = 0;
        this.targetScale = 1.0;
    }

    /**
     * エネルギー追加
     */
    addEnergy(amount) {
        this.energyLevel = Math.min(this.maxEnergyLevel, this.energyLevel + amount);
    }

    /**
     * リップルエフェクト作成
     */
    createRippleEffect() {
        this.rippleEffect.push({
            radius: this.radius,
            alpha: 1.0,
            speed: 2,
            decay: 0.05,
            color: this.currentColor
        });
    }

    /**
     * 特殊効果の作成
     */
    createSpecialEffect() {
        if (this.consecutiveHits > 5 && window.particleSystem) {
            // 大きな爆発エフェクト
            window.particleSystem.createExplosion(this.x, this.y, this.activeColor, 2.0);

            // 周囲のペグにエネルギー伝播
            this.propagateEnergyToNearbyPegs();

            this.consecutiveHits = 0; // リセット
        }
    }

    /**
     * 近隣ペグへのエネルギー伝播
     */
    propagateEnergyToNearbyPegs() {
        if (!window.GameState || !window.GameState.pegs) return;

        const propagationRadius = 80;

        window.GameState.pegs.forEach(peg => {
            if (peg === this) return;

            const distance = Utils.Math.calculateDistance(this.x, this.y, peg.x, peg.y);
            if (distance <= propagationRadius) {
                const energyAmount = Math.max(5, 15 * (1 - distance / propagationRadius));
                peg.addEnergy(energyAmount);

                // 伝播エフェクト
                if (window.particleSystem) {
                    window.particleSystem.createSparks(peg.x, peg.y, 2, this.activeColor);
                }
            }
        });
    }

    /**
     * ボールへのエフェクト適用
     */
    applyEffectToBall(ball) {
        // ボールの色を一時的に変更
        const originalColor = ball.color;
        ball.color = this.activeColor;

        setTimeout(() => {
            ball.color = originalColor;
        }, 200);

        // ボールにエネルギーボーナス
        if (this.energyLevel > 50) {
            ball.vx *= 1.1;
            ball.vy *= 1.1;
        }
    }

    /**
     * ヒットサウンド再生
     */
    playHitSound() {
        if (!this.soundEnabled) return;

        // Web Audio API使用（将来の実装）
        // const frequency = 440 * this.pitchVariation * (1 + this.energyLevel / 100);
        // AudioSystem.playTone(frequency, 0.1);
    }

    /**
     * 描画処理
     */
    draw(ctx) {
        if (!this.isActive) return;

        ctx.save();

        // リップルエフェクトの描画
        this.drawRippleEffects(ctx);

        // メインペグの描画
        this.drawMainPeg(ctx);

        // グローエフェクト
        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            this.drawGlowEffect(ctx);
        }

        // エネルギー表示
        if (this.energyLevel > 10) {
            this.drawEnergyEffect(ctx);
        }

        // デバッグ情報
        this.drawDebugInfo(ctx);

        ctx.restore();
    }

    /**
     * リップルエフェクト描画
     */
    drawRippleEffects(ctx) {
        this.rippleEffect.forEach(ripple => {
            ctx.save();
            ctx.globalAlpha = ripple.alpha * 0.6;
            ctx.strokeStyle = ripple.color;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(this.x, this.y, ripple.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        });
    }

    /**
     * メインペグ描画
     */
    drawMainPeg(ctx) {
        const radius = this.radius * this.scale;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotationAngle);
        ctx.scale(this.scale, this.scale);

        // 影
        ctx.save();
        ctx.translate(1, 1);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // グラデーション
        const gradient = ctx.createRadialGradient(
            -radius * 0.3, -radius * 0.3, 0,
            0, 0, radius
        );
        gradient.addColorStop(0, Utils.Color.adjustBrightness(this.currentColor, 1.8));
        gradient.addColorStop(0.5, this.currentColor);
        gradient.addColorStop(1, Utils.Color.adjustBrightness(this.currentColor, 0.4));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // 境界線
        ctx.strokeStyle = Utils.Color.adjustBrightness(this.currentColor, 1.5);
        ctx.lineWidth = 1;
        ctx.stroke();

        // 内部パターン
        this.drawInternalPattern(ctx, radius);

        ctx.restore();
    }

    /**
     * 内部パターン描画
     */
    drawInternalPattern(ctx, radius) {
        ctx.save();
        ctx.strokeStyle = Utils.Color.addAlpha(this.currentColor, 0.8);
        ctx.lineWidth = 0.5;

        // 六角形パターン
        const sides = 6;
        const hexRadius = radius * 0.6;

        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
            const angle = (Math.PI * 2 / sides) * i;
            const x = Math.cos(angle) * hexRadius;
            const y = Math.sin(angle) * hexRadius;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // 中央ドット
        ctx.fillStyle = this.currentColor;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * グローエフェクト描画
     */
    drawGlowEffect(ctx) {
        const glowRadius = this.radius * this.scale * 3;

        ctx.save();
        ctx.globalAlpha = this.glowIntensity * 0.4;
        ctx.shadowColor = this.currentColor;
        ctx.shadowBlur = glowRadius;

        ctx.fillStyle = Utils.Color.addAlpha(this.currentColor, 0.1);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * this.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * エネルギーエフェクト描画
     */
    drawEnergyEffect(ctx) {
        const energyRatio = this.energyLevel / this.maxEnergyLevel;

        ctx.save();
        ctx.globalAlpha = energyRatio * 0.8;

        // エネルギーバー
        const barWidth = this.radius * 4;
        const barHeight = 2;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.radius * 2;

        // 背景
        ctx.fillStyle = Utils.Color.addAlpha('#ffffff', 0.2);
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // エネルギー
        ctx.fillStyle = this.currentColor;
        ctx.fillRect(barX, barY, barWidth * energyRatio, barHeight);

        ctx.restore();
    }

    /**
     * 統計情報の取得
     */
    getStats() {
        return {
            hitCount: this.hitCount,
            energyLevel: this.energyLevel,
            consecutiveHits: this.consecutiveHits,
            isActivated: this.isActivated
        };
    }

    /**
     * リセット
     */
    reset() {
        this.hitCount = 0;
        this.lastHitTime = 0;
        this.consecutiveHits = 0;
        this.energyLevel = 0;
        this.isActivated = false;
        this.activationTime = 0;
        this.scale = 1.0;
        this.targetScale = 1.0;
        this.rotationAngle = 0;
        this.rippleEffect = [];
        this.currentColor = this.baseColor;
    }
}

// 特殊ペグクラス（将来の拡張用）
class SpecialPeg extends Peg {
    constructor(x, y, specialType = 'multiplier', options = {}) {
        super(x, y, options);

        this.specialType = specialType;
        this.multiplier = options.multiplier || 2;
        this.specialColor = this.getSpecialColor();
        this.baseColor = this.specialColor;
        this.currentColor = this.specialColor;

        // 特殊効果
        this.effectRadius = options.effectRadius || 30;
        this.cooldownTime = options.cooldown || 3000; // ms
        this.lastActivation = 0;
        this.isOnCooldown = false;
    }

    /**
     * 特殊タイプに応じた色を取得
     */
    getSpecialColor() {
        switch (this.specialType) {
            case 'multiplier':
                return CONFIG.COLORS.WARNING;
            case 'magnet':
                return CONFIG.COLORS.ACCENT;
            case 'bomb':
                return '#ff0040';
            case 'teleport':
                return '#40ff00';
            default:
                return CONFIG.COLORS.PRIMARY;
        }
    }

    /**
     * 特殊効果の発動
     */
    activateSpecialEffect(ball) {
        const currentTime = Date.now();

        if (this.isOnCooldown || currentTime - this.lastActivation < this.cooldownTime) {
            return false;
        }

        this.lastActivation = currentTime;
        this.isOnCooldown = true;

        switch (this.specialType) {
            case 'multiplier':
                this.activateMultiplier(ball);
                break;
            case 'magnet':
                this.activateMagnet(ball);
                break;
            case 'bomb':
                this.activateBomb(ball);
                break;
            case 'teleport':
                this.activateTeleport(ball);
                break;
        }

        // クールダウン終了
        setTimeout(() => {
            this.isOnCooldown = false;
        }, this.cooldownTime);

        return true;
    }

    /**
     * マルチプライヤー効果
     */
    activateMultiplier(ball) {
        // ボールに一時的な得点倍率を付与
        ball.scoreMultiplier = this.multiplier;
        ball.multiplierEndTime = Date.now() + 5000; // 5秒間有効

        // ビジュアルエフェクト
        if (window.particleSystem) {
            window.particleSystem.createExplosion(this.x, this.y, this.specialColor, 1.5);
        }
    }

    /**
     * 磁石効果
     */
    activateMagnet(ball) {
        // 周囲のボールを引き寄せる
        if (window.GameState && window.GameState.balls) {
            window.GameState.balls.forEach(otherBall => {
                if (otherBall === ball || !otherBall.isActive) return;

                const distance = Utils.Math.calculateDistance(this.x, this.y, otherBall.x, otherBall.y);
                if (distance <= this.effectRadius) {
                    const force = 2 / Math.max(distance, 1);
                    const angle = Math.atan2(this.y - otherBall.y, this.x - otherBall.x);

                    otherBall.vx += Math.cos(angle) * force;
                    otherBall.vy += Math.sin(angle) * force;
                }
            });
        }
    }

    /**
     * 爆弾効果
     */
    activateBomb(ball) {
        const explosionForce = 5;

        // 周囲のボールを吹き飛ばす
        if (window.GameState && window.GameState.balls) {
            window.GameState.balls.forEach(otherBall => {
                if (!otherBall.isActive) return;

                const distance = Utils.Math.calculateDistance(this.x, this.y, otherBall.x, otherBall.y);
                if (distance <= this.effectRadius) {
                    const force = explosionForce / Math.max(distance, 1);
                    const angle = Math.atan2(otherBall.y - this.y, otherBall.x - this.x);

                    otherBall.vx += Math.cos(angle) * force;
                    otherBall.vy += Math.sin(angle) * force;
                }
            });
        }

        // 大きな爆発エフェクト
        if (window.particleSystem) {
            window.particleSystem.createExplosion(this.x, this.y, this.specialColor, 3.0);
        }

        if (window.screenShake) {
            window.screenShake.shake(5, 30);
        }
    }

    /**
     * テレポート効果
     */
    activateTeleport(ball) {
        // ランダムな位置にテレポート
        const newX = Utils.Math.randomFloat(ball.radius, CONFIG.GAME.CANVAS_WIDTH - ball.radius);
        const newY = Utils.Math.randomFloat(100, CONFIG.GAME.CANVAS_HEIGHT * 0.6);

        // テレポートエフェクト
        if (window.particleSystem) {
            window.particleSystem.createExplosion(ball.x, ball.y, this.specialColor, 1.0);
            window.particleSystem.createExplosion(newX, newY, this.specialColor, 1.0);
        }

        ball.x = newX;
        ball.y = newY;
        ball.vx *= 0.5; // 速度を半減
        ball.vy *= 0.5;
    }

    /**
     * ヒット処理（オーバーライド）
     */
    onHit(ball) {
        super.onHit(ball);

        // 特殊効果の発動を試行
        this.activateSpecialEffect(ball);
    }

    /**
     * 描画処理（オーバーライド）
     */
    draw(ctx) {
        super.draw(ctx);

        // クールダウン表示
        if (this.isOnCooldown) {
            this.drawCooldownIndicator(ctx);
        }

        // 効果範囲の表示（デバッグ時）
        if (CONFIG.DEBUG.SHOW_COLLISION_BOXES) {
            this.drawEffectRadius(ctx);
        }
    }

    /**
     * クールダウンインジケーター描画
     */
    drawCooldownIndicator(ctx) {
        const currentTime = Date.now();
        const elapsed = currentTime - this.lastActivation;
        const progress = elapsed / this.cooldownTime;

        ctx.save();
        ctx.globalAlpha = 0.7;

        // 円形プログレスバー
        const radius = this.radius * 1.5;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * progress);

        ctx.strokeStyle = Utils.Color.addAlpha(this.specialColor, 0.5);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, startAngle, endAngle);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * 効果範囲の表示
     */
    drawEffectRadius(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = this.specialColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.effectRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}