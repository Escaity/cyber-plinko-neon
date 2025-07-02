// 修正版パーティクルエフェクトシステム - プール統合とエラー修正
class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || Utils.Math.randomFloat(-2, 2);
        this.vy = options.vy || Utils.Math.randomFloat(-3, -1);
        this.life = options.life || CONFIG.EFFECTS.PARTICLE_LIFETIME;
        this.maxLife = this.life;
        this.size = options.size || Utils.Math.randomFloat(1, 3);
        this.color = options.color || Utils.Array.randomElement(CONFIG.COLORS.PARTICLE_COLORS);
        this.alpha = 1;
        this.gravity = options.gravity || 0.1;
        this.friction = options.friction || 0.98;
        this.glow = options.glow || true;
        this.type = options.type || 'default';

        // プール管理用フラグ
        this.isPooled = false;
        this.isActive = true;
    }

    update() {
        if (!this.isActive) return false;

        // 物理更新
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx;
        this.y += this.vy;

        // ライフサイクル更新
        this.life--;
        this.alpha = this.life / this.maxLife;

        // サイズの変化
        if (this.type === 'explosion') {
            this.size = (this.life / this.maxLife) * 4;
        }

        // 生存チェック
        const alive = this.life > 0 && this.alpha > 0;
        if (!alive) {
            this.isActive = false;
        }

        return alive;
    }

    draw(ctx) {
        if (this.alpha <= 0 || !this.isActive) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (this.glow && CONFIG.EFFECTS.ENABLE_GLOW) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = this.size * 3;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // 追加エフェクト
        if (this.type === 'spark') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        ctx.restore();
    }

    // プール用リセットメソッド
    reset(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || Utils.Math.randomFloat(-2, 2);
        this.vy = options.vy || Utils.Math.randomFloat(-3, -1);
        this.life = options.life || CONFIG.EFFECTS.PARTICLE_LIFETIME;
        this.maxLife = this.life;
        this.size = options.size || Utils.Math.randomFloat(1, 3);
        this.color = options.color || Utils.Array.randomElement(CONFIG.COLORS.PARTICLE_COLORS);
        this.alpha = 1;
        this.gravity = options.gravity || 0.1;
        this.friction = options.friction || 0.98;
        this.glow = options.glow !== false;
        this.type = options.type || 'default';
        this.isActive = true;
    }
}

class TrailParticle extends Particle {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.baseSize = this.size;
        this.life = CONFIG.BALL.TRAIL_LENGTH;
        this.maxLife = this.life;
    }

    update() {
        if (!this.isActive) return false;

        this.life--;
        this.alpha = this.life / this.maxLife;
        this.size = this.baseSize * this.alpha;

        const alive = this.life > 0;
        if (!alive) {
            this.isActive = false;
        }

        return alive;
    }

    reset(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.baseSize = options.size || 2;
        this.life = CONFIG.BALL.TRAIL_LENGTH;
        this.maxLife = this.life;
        this.color = options.color || CONFIG.COLORS.PRIMARY;
        this.alpha = 1;
        this.size = this.baseSize;
        this.isActive = true;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = CONFIG.PERFORMANCE.MAX_PARTICLES;

        // プール統合フラグ
        this.useObjectPool = CONFIG.PERFORMANCE.ENABLE_OBJECT_POOLING;

        // パフォーマンス統計
        this.stats = {
            created: 0,
            poolUsed: 0,
            directCreated: 0,
            cleaned: 0
        };

        console.log('🎆 Particle system initialized with pool integration');
    }

    /**
     * プールからパーティクルを安全に取得
     */
    acquireParticle(x, y, options = {}) {
        if (!this.useObjectPool || !window.poolManager) {
            // プールが無効な場合は直接作成
            this.stats.directCreated++;
            const particle = new Particle(x, y, options);
            particle.isPooled = false;
            return particle;
        }

        try {
            const particlePool = window.poolManager.getPool('particle');
            if (particlePool) {
                this.stats.poolUsed++;
                const particle = particlePool.acquire(x, y, options);
                particle.isPooled = true;
                return particle;
            } else {
                console.warn('Particle pool not found, creating direct particle');
                this.stats.directCreated++;
                const particle = new Particle(x, y, options);
                particle.isPooled = false;
                return particle;
            }
        } catch (error) {
            console.error('Error acquiring particle from pool:', error);
            this.stats.directCreated++;
            const particle = new Particle(x, y, options);
            particle.isPooled = false;
            return particle;
        }
    }

    /**
     * プールからトレイルパーティクルを安全に取得
     */
    acquireTrailParticle(x, y, options = {}) {
        if (!this.useObjectPool || !window.poolManager) {
            this.stats.directCreated++;
            const particle = new TrailParticle(x, y, options);
            particle.isPooled = false;
            return particle;
        }

        try {
            const trailPool = window.poolManager.getPool('trail');
            if (trailPool) {
                this.stats.poolUsed++;
                const particle = trailPool.acquire(x, y, options);
                particle.isPooled = true;
                return particle;
            } else {
                this.stats.directCreated++;
                const particle = new TrailParticle(x, y, options);
                particle.isPooled = false;
                return particle;
            }
        } catch (error) {
            console.error('Error acquiring trail particle from pool:', error);
            this.stats.directCreated++;
            const particle = new TrailParticle(x, y, options);
            particle.isPooled = false;
            return particle;
        }
    }

    /**
     * パーティクルを安全にリリース
     */
    releaseParticle(particle) {
        if (!particle) return false;

        // プール由来のパーティクルのみリリース
        if (!particle.isPooled) {
            return true; // 直接作成されたパーティクルは単純に削除
        }

        if (!window.poolManager) {
            console.warn('Pool manager not available for particle release');
            return false;
        }

        try {
            let pool = null;

            // パーティクルタイプに応じてプールを選択
            if (particle instanceof TrailParticle) {
                pool = window.poolManager.getPool('trail');
            } else {
                pool = window.poolManager.getPool('particle');
            }

            if (pool) {
                const released = pool.release(particle);
                if (released) {
                    this.stats.cleaned++;
                    return true;
                } else {
                    console.warn('Failed to release particle to pool');
                    return false;
                }
            } else {
                console.warn('Appropriate pool not found for particle release');
                return false;
            }
        } catch (error) {
            console.error('Error releasing particle to pool:', error);
            return false;
        }
    }

    // 爆発エフェクト
    createExplosion(x, y, color, intensity = 1) {
        if (!CONFIG.EFFECTS.ENABLE_PARTICLES) return;

        const particleCount = Math.floor(CONFIG.EFFECTS.EXPLOSION_PARTICLES * intensity);

        for (let i = 0; i < particleCount; i++) {
            if (this.particles.length >= this.maxParticles) {
                console.warn('Max particles reached, skipping explosion particles');
                break;
            }

            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = Utils.Math.randomFloat(2, 6) * intensity;

            const particle = this.acquireParticle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: Utils.Math.randomFloat(1, 3),
                life: Utils.Math.randomInt(20, 40),
                gravity: Utils.Math.randomFloat(0.05, 0.15),
                type: 'explosion'
            });

            this.particles.push(particle);
            this.stats.created++;
        }
    }

    // スパークエフェクト
    createSparks(x, y, count = 5, color = CONFIG.COLORS.PRIMARY) {
        if (!CONFIG.EFFECTS.ENABLE_PARTICLES) return;

        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) {
                console.warn('Max particles reached, skipping spark particles');
                break;
            }

            const particle = this.acquireParticle(x, y, {
                vx: Utils.Math.randomFloat(-4, 4),
                vy: Utils.Math.randomFloat(-6, -2),
                color: color,
                size: Utils.Math.randomFloat(0.5, 2),
                life: Utils.Math.randomInt(15, 30),
                gravity: 0.2,
                type: 'spark'
            });

            this.particles.push(particle);
            this.stats.created++;
        }
    }

    // トレイルエフェクト
    createTrail(x, y, color, size = 2) {
        if (!CONFIG.EFFECTS.ENABLE_TRAILS) return;
        if (this.particles.length >= this.maxParticles) return;

        const particle = this.acquireTrailParticle(x, y, {
            color: color,
            size: size,
            glow: true
        });

        this.particles.push(particle);
        this.stats.created++;
    }

    // ペグヒットエフェクト
    createPegHitEffect(x, y, ballColor) {
        this.createSparks(x, y, 3, ballColor);

        // 小さな爆発
        if (this.particles.length < this.maxParticles) {
            const particle = this.acquireParticle(x, y, {
                vx: 0,
                vy: 0,
                color: ballColor,
                size: 8,
                life: 10,
                gravity: 0,
                type: 'explosion'
            });

            this.particles.push(particle);
            this.stats.created++;
        }
    }

    // スロットヒットエフェクト
    createSlotHitEffect(x, y, points, color) {
        const intensity = Math.min(points / 500, 3); // 得点に応じた強度

        // メイン爆発
        this.createExplosion(x, y, color, intensity);

        // 追加スパーク
        this.createSparks(x, y, Math.floor(10 * intensity), color);

        // 得点テキストパーティクル
        this.createScoreParticle(x, y - 30, points, color);
    }

    // 得点表示パーティクル
    createScoreParticle(x, y, points, color) {
        if (this.particles.length >= this.maxParticles) return;

        const particle = new ScoreParticle(x, y, {
            text: `+${points}`,
            color: color,
            life: 90
        });

        // スコアパーティクルはプールを使用しない（特殊なタイプのため）
        particle.isPooled = false;
        this.particles.push(particle);
        this.stats.created++;
    }

    // 全パーティクルの更新
    update() {
        if (this.useObjectPool && window.poolManager) {
            // プール統合版の更新
            this.updateWithPool();
        } else {
            // 従来版の更新
            this.updateDirect();
        }

        // パフォーマンス監視
        if (this.particles.length > this.maxParticles * 0.9) {
            console.warn('Particle count approaching limit:', this.particles.length);
        }
    }

    /**
     * プール統合版の更新
     */
    updateWithPool() {
        try {
            const particlePool = window.poolManager.getPool('particle');
            const trailPool = window.poolManager.getPool('trail');

            if (particlePool && trailPool) {
                // プール管理された更新
                this.particles = this.updateParticlesWithPools(this.particles, particlePool, trailPool);
            } else {
                console.warn('Pools not available, falling back to direct update');
                this.updateDirect();
            }
        } catch (error) {
            console.error('Error in pool-based particle update:', error);
            this.updateDirect();
        }
    }

    /**
     * プール管理されたパーティクルの更新
     */
    updateParticlesWithPools(particles, particlePool, trailPool) {
        const active = [];
        const toRelease = [];

        particles.forEach(particle => {
            if (!particle) {
                console.warn('Null particle found in update');
                return;
            }

            try {
                if (particle.update()) {
                    active.push(particle);
                } else {
                    // 非アクティブなパーティクルを分類
                    if (particle.isPooled) {
                        toRelease.push(particle);
                    }
                    // 非プールパーティクルは自然にガベージコレクションされる
                }
            } catch (error) {
                console.error('Error updating particle:', error);
                if (particle.isPooled) {
                    toRelease.push(particle);
                }
            }
        });

        // 安全なリリース処理
        toRelease.forEach(particle => {
            this.releaseParticle(particle);
        });

        return active;
    }

    /**
     * 従来版の直接更新
     */
    updateDirect() {
        this.particles = this.particles.filter(particle => {
            if (!particle) return false;

            try {
                return particle.update();
            } catch (error) {
                console.error('Error updating particle:', error);
                return false;
            }
        });
    }

    // 全パーティクルの描画
    render(ctx) {
        this.particles.forEach(particle => {
            if (particle && particle.draw) {
                try {
                    particle.draw(ctx);
                } catch (error) {
                    console.error('Error drawing particle:', error);
                }
            }
        });
    }

    // パーティクルのクリア
    clear() {
        // プール由来のパーティクルを適切にリリース
        if (this.useObjectPool && window.poolManager) {
            this.particles.forEach(particle => {
                if (particle && particle.isPooled) {
                    this.releaseParticle(particle);
                }
            });
        }

        this.particles = [];
        console.log('Particle system cleared');
    }

    // パーティクル数の取得
    getParticleCount() {
        return this.particles.length;
    }

    // パフォーマンス統計の取得
    getStats() {
        return {
            ...this.stats,
            currentCount: this.particles.length,
            maxParticles: this.maxParticles,
            poolUtilization: this.stats.created > 0 ?
                (this.stats.poolUsed / this.stats.created * 100).toFixed(1) + '%' : '0%',
            memoryEfficiency: this.stats.poolUsed > this.stats.directCreated ? 'Good' : 'Poor'
        };
    }

    // 緊急クリーンアップ
    emergencyCleanup() {
        console.warn('🚨 Emergency particle cleanup');

        const originalCount = this.particles.length;

        // 古いパーティクルから削除
        this.particles.sort((a, b) => a.life - b.life);
        const keepCount = Math.floor(this.maxParticles * 0.3);
        const toRemove = this.particles.splice(keepCount);

        // プール由来のパーティクルを適切にリリース
        toRemove.forEach(particle => {
            if (particle && particle.isPooled) {
                this.releaseParticle(particle);
            }
        });

        console.warn(`Emergency cleanup: ${originalCount} -> ${this.particles.length} particles`);
        return originalCount - this.particles.length;
    }

    // 設定の動的変更
    updateConfiguration(newConfig) {
        if (newConfig.maxParticles) {
            this.maxParticles = newConfig.maxParticles;

            // パーティクル数が制限を超えている場合は調整
            if (this.particles.length > this.maxParticles) {
                const excess = this.particles.length - this.maxParticles;
                const removed = this.particles.splice(-excess);

                removed.forEach(particle => {
                    if (particle && particle.isPooled) {
                        this.releaseParticle(particle);
                    }
                });

                console.log(`Adjusted particle count: removed ${excess} particles`);
            }
        }

        if (newConfig.useObjectPool !== undefined) {
            this.useObjectPool = newConfig.useObjectPool;
            console.log(`Object pool usage: ${this.useObjectPool ? 'enabled' : 'disabled'}`);
        }
    }
}

// 得点表示専用パーティクル
class ScoreParticle extends Particle {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.text = options.text || '+100';
        this.fontSize = options.fontSize || 16;
        this.vy = -1; // 上に向かって移動
        this.vx = 0;
        this.gravity = 0;
        this.scale = 1;
    }

    update() {
        if (!this.isActive) return false;

        this.y += this.vy;
        this.life--;
        this.alpha = this.life / this.maxLife;

        // スケールアニメーション
        if (this.life > this.maxLife * 0.8) {
            this.scale = 1 + (1 - this.life / this.maxLife) * 0.5;
        } else {
            this.scale = this.alpha;
        }

        const alive = this.life > 0;
        if (!alive) {
            this.isActive = false;
        }

        return alive;
    }

    draw(ctx) {
        if (this.alpha <= 0 || !this.isActive) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (CONFIG.EFFECTS.ENABLE_GLOW) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
        }

        ctx.font = `bold ${this.fontSize * this.scale}px Orbitron`;
        ctx.fillStyle = this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);

        ctx.restore();
    }
}

// 画面揺れエフェクト
class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.duration = 0;
        this.x = 0;
        this.y = 0;
    }

    shake(intensity, duration) {
        if (!CONFIG.EFFECTS.ENABLE_SCREEN_SHAKE) return;

        this.intensity = Math.min(intensity, CONFIG.EFFECTS.SCREEN_SHAKE_INTENSITY);
        this.duration = duration;
    }

    update() {
        if (this.duration > 0) {
            this.duration--;
            const factor = this.duration / 30; // 30フレームで減衰
            const currentIntensity = this.intensity * factor;

            this.x = (Math.random() - 0.5) * currentIntensity * 2;
            this.y = (Math.random() - 0.5) * currentIntensity * 2;
        } else {
            this.x = 0;
            this.y = 0;
        }
    }

    apply(ctx) {
        if (this.x !== 0 || this.y !== 0) {
            ctx.translate(this.x, this.y);
        }
    }

    reset(ctx) {
        if (this.x !== 0 || this.y !== 0) {
            ctx.translate(-this.x, -this.y);
        }
    }
}