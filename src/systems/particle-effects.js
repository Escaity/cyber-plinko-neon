// パーティクルエフェクトシステム
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
    }

    update() {
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

        return this.life > 0;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;

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
}

class TrailParticle extends Particle {
    constructor(x, y, options = {}) {
        super(x, y, options);
        this.baseSize = this.size;
        this.life = CONFIG.BALL.TRAIL_LENGTH;
        this.maxLife = this.life;
    }

    update() {
        this.life--;
        this.alpha = this.life / this.maxLife;
        this.size = this.baseSize * this.alpha;

        return this.life > 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = CONFIG.PERFORMANCE.MAX_PARTICLES;
    }

    // 爆発エフェクト
    createExplosion(x, y, color, intensity = 1) {
        if (!CONFIG.EFFECTS.ENABLE_PARTICLES) return;

        const particleCount = Math.floor(CONFIG.EFFECTS.EXPLOSION_PARTICLES * intensity);

        for (let i = 0; i < particleCount; i++) {
            if (this.particles.length >= this.maxParticles) break;

            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = Utils.Math.randomFloat(2, 6) * intensity;

            const particle = new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: Utils.Math.randomFloat(1, 3),
                life: Utils.Math.randomInt(20, 40),
                gravity: Utils.Math.randomFloat(0.05, 0.15),
                type: 'explosion'
            });

            this.particles.push(particle);
        }
    }

    // スパークエフェクト
    createSparks(x, y, count = 5, color = CONFIG.COLORS.PRIMARY) {
        if (!CONFIG.EFFECTS.ENABLE_PARTICLES) return;

        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;

            const particle = new Particle(x, y, {
                vx: Utils.Math.randomFloat(-4, 4),
                vy: Utils.Math.randomFloat(-6, -2),
                color: color,
                size: Utils.Math.randomFloat(0.5, 2),
                life: Utils.Math.randomInt(15, 30),
                gravity: 0.2,
                type: 'spark'
            });

            this.particles.push(particle);
        }
    }

    // トレイルエフェクト
    createTrail(x, y, color, size = 2) {
        if (!CONFIG.EFFECTS.ENABLE_TRAILS) return;
        if (this.particles.length >= this.maxParticles) return;

        const particle = new TrailParticle(x, y, {
            vx: 0,
            vy: 0,
            color: color,
            size: size,
            glow: true
        });

        this.particles.push(particle);
    }

    // ペグヒットエフェクト
    createPegHitEffect(x, y, ballColor) {
        this.createSparks(x, y, 3, ballColor);

        // 小さな爆発
        const particle = new Particle(x, y, {
            vx: 0,
            vy: 0,
            color: ballColor,
            size: 8,
            life: 10,
            gravity: 0,
            type: 'explosion'
        });

        this.particles.push(particle);
    }

    // スロットヒットエフェクト
    createSlotHitEffect(x, y, points, color) {
        const intensity = Math.min(points / 500, 3); // 得点に応じた強度

        // メイン爆発
        this.createExplosion(x, y, color, intensity);

        // 追加スパーク
        this.createSparks(x, y, Math.floor(10 * intensity), color);

        // 得点テキストパーティクル（将来の拡張用）
        this.createScoreParticle(x, y - 30, points, color);
    }

    // 得点表示パーティクル
    createScoreParticle(x, y, points, color) {
        const particle = new ScoreParticle(x, y, {
            text: `+${points}`,
            color: color,
            life: 90
        });

        this.particles.push(particle);
    }

    // 全パーティクルの更新
    update() {
        this.particles = this.particles.filter(particle => particle.update());

        // パフォーマンス監視
        if (this.particles.length > this.maxParticles * 0.9) {
            console.warn('Particle count approaching limit:', this.particles.length);
        }
    }

    // 全パーティクルの描画
    render(ctx) {
        this.particles.forEach(particle => particle.draw(ctx));
    }

    // パーティクルのクリア
    clear() {
        this.particles = [];
    }

    // パーティクル数の取得
    getParticleCount() {
        return this.particles.length;
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
        this.y += this.vy;
        this.life--;
        this.alpha = this.life / this.maxLife;

        // スケールアニメーション
        if (this.life > this.maxLife * 0.8) {
            this.scale = 1 + (1 - this.life / this.maxLife) * 0.5;
        } else {
            this.scale = this.alpha;
        }

        return this.life > 0;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;

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