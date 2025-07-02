// 物理エンティティの基底クラス - 軽量化版
class PhysicsEntity {
    constructor(x, y, options = {}) {
        // 位置
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;

        // 速度
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;

        // 加速度
        this.ax = options.ax || 0;
        this.ay = options.ay || 0;

        // 物理プロパティ
        this.mass = options.mass || 1;
        this.radius = options.radius || 5;
        this.friction = options.friction || CONFIG.PHYSICS.FRICTION;
        this.bounce = options.bounce || CONFIG.PHYSICS.BOUNCE;
        this.gravity = options.gravity || CONFIG.PHYSICS.GRAVITY;

        // 状態フラグ
        this.isActive = true;
        this.isStatic = options.isStatic || false;
        this.canCollide = options.canCollide !== false;

        // ID（デバッグ用）
        this.id = Math.random().toString(36).substr(2, 9);

        // 衝突グループ
        this.collisionGroup = options.collisionGroup || 'default';
        this.collisionMask = options.collisionMask || ['default'];

        // ライフサイクル
        this.age = 0;
        this.maxAge = options.maxAge || Infinity;
    }

    /**
     * 位置の更新（修正版）
     */
    updatePosition(deltaTime = 1) {
        if (this.isStatic || !this.isActive) return;

        // 前フレームの位置を保存
        this.prevX = this.x;
        this.prevY = this.y;

        // 【修正】物理演算の有効化
        // 加速度から速度を更新
        // this.vx += this.ax * deltaTime;
        // this.vy += this.ay * deltaTime;
        //
        // // 重力の適用
        // if (this.gravity !== 0) {
        //     this.vy += this.gravity * deltaTime;
        // }
        //
        // // 摩擦の適用
        // if (this.friction !== 1) {
        //     this.vx *= Math.pow(this.friction, deltaTime);
        //     this.vy *= Math.pow(this.friction, deltaTime);
        // }
        //
        // // 速度制限
        // const maxVel = CONFIG.PHYSICS.MAX_VELOCITY;
        // const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        // if (speed > maxVel) {
        //     const scale = maxVel / speed;
        //     this.vx *= scale;
        //     this.vy *= scale;
        // }

        // 位置更新
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // 年齢更新
        this.age++;
        if (this.age >= this.maxAge) {
            this.isActive = false;
        }
    }

    /**
     * 加速度のリセット
     */
    resetAcceleration() {
        this.ax = 0;
        this.ay = 0;
    }

    /**
     * 力の適用
     */
    applyForce(fx, fy) {
        this.ax += fx / this.mass;
        this.ay += fy / this.mass;
    }

    /**
     * 衝撃の適用
     */
    applyImpulse(ix, iy) {
        this.vx += ix / this.mass;
        this.vy += iy / this.mass;
    }

    /**
     * 境界チェック（軽量化版）
     */
    checkBounds(width, height) {
        let collided = false;

        // 左右の境界
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx) * this.bounce;
            collided = true;
        } else if (this.x + this.radius > width) {
            this.x = width - this.radius;
            this.vx = -Math.abs(this.vx) * this.bounce;
            collided = true;
        }

        // 上の境界のみ（下は自然落下）
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = Math.abs(this.vy) * this.bounce;
            collided = true;
        }

        return collided;
    }

    /**
     * 他のエンティティとの距離計算
     */
    distanceTo(other) {
        return Utils.Math.calculateDistance(this.x, this.y, other.x, other.y);
    }

    /**
     * 他のエンティティとの距離の二乗計算（高速化）
     */
    distanceToSquared(other) {
        return Utils.Math.calculateDistanceSquared(this.x, this.y, other.x, other.y);
    }

    /**
     * 高速衝突判定
     */
    isCollidingWith(other) {
        if (!this.canCollide || !other.canCollide) return false;
        if (!this.isActive || !other.isActive) return false;
        if (this === other) return false;

        // 衝突グループのチェック
        if (!this.collisionMask.includes(other.collisionGroup)) return false;

        // 高速距離チェック（二乗比較）
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distanceSquared = dx * dx + dy * dy;
        const radiusSum = this.radius + other.radius;

        return distanceSquared < (radiusSum * radiusSum);
    }

    /**
     * 簡略化された衝突レスポンス
     */
    resolveCollision(other) {
        if (!this.isCollidingWith(other)) return false;

        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) {
            // ゼロ除算の回避
            const angle = Math.random() * Math.PI * 2;
            const separation = (this.radius + other.radius) * 0.5;
            this.x -= Math.cos(angle) * separation;
            this.y -= Math.sin(angle) * separation;
            if (!other.isStatic) {
                other.x += Math.cos(angle) * separation;
                other.y += Math.sin(angle) * separation;
            }
            return true;
        }

        const overlap = (this.radius + other.radius) - distance;
        if (overlap <= 0) return false;

        // 正規化された方向ベクトル
        const nx = dx / distance;
        const ny = dy / distance;

        // 位置の分離（簡略化）
        const separation = overlap * 0.5;
        if (!this.isStatic) {
            this.x -= nx * separation;
            this.y -= ny * separation;
        }
        if (!other.isStatic) {
            other.x += nx * separation;
            other.y += ny * separation;
        }

        // 速度の簡易反射（静的オブジェクトとの衝突のみ）
        if (other.isStatic && !this.isStatic) {
            const dotProduct = this.vx * nx + this.vy * ny;
            this.vx -= 2 * dotProduct * nx * this.bounce;
            this.vy -= 2 * dotProduct * ny * this.bounce;

            // エネルギー減衰
            this.vx *= CONFIG.PHYSICS.COLLISION_DAMPING;
            this.vy *= CONFIG.PHYSICS.COLLISION_DAMPING;
        }

        return true;
    }

    /**
     * エンティティの状態取得
     */
    getState() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            radius: this.radius,
            mass: this.mass,
            isActive: this.isActive,
            age: this.age
        };
    }

    /**
     * エンティティの状態設定
     */
    setState(state) {
        this.x = state.x || this.x;
        this.y = state.y || this.y;
        this.vx = state.vx || this.vx;
        this.vy = state.vy || this.vy;
        this.isActive = state.isActive !== undefined ? state.isActive : this.isActive;
    }

    /**
     * デバッグ情報の描画
     */
    drawDebugInfo(ctx) {
        if (!CONFIG.DEBUG.SHOW_COLLISION_BOXES) return;

        ctx.save();

        // 衝突ボックス
        ctx.strokeStyle = this.isActive ? 'lime' : 'red';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 速度ベクトル
        if (CONFIG.DEBUG.SHOW_VELOCITY_VECTORS && (this.vx !== 0 || this.vy !== 0)) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.vx * 3, this.y + this.vy * 3);
            ctx.stroke();
        }

        // ID表示
        ctx.fillStyle = 'white';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.id.substr(0, 3), this.x, this.y - this.radius - 5);

        ctx.restore();
    }

    /**
     * エンティティの更新（オーバーライド用）
     */
    update(deltaTime = 1) {
        this.updatePosition(deltaTime);
        this.resetAcceleration();
    }

    /**
     * エンティティの描画（オーバーライド用）
     */
    draw(ctx) {
        // 基本的な円の描画
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        // デバッグ情報
        this.drawDebugInfo(ctx);
    }

    /**
     * エンティティの破棄
     */
    destroy() {
        this.isActive = false;
    }
}

// 静的オブジェクト用クラス
class StaticPhysicsEntity extends PhysicsEntity {
    constructor(x, y, options = {}) {
        super(x, y, { ...options, isStatic: true });
        this.vx = 0;
        this.vy = 0;
        this.ax = 0;
        this.ay = 0;
        this.gravity = 0;
    }

    // 静的オブジェクトは位置更新しない
    updatePosition() {
        // 何もしない
    }

    // 静的オブジェクトは力を受けない
    applyForce() {
        // 何もしない
    }

    // 静的オブジェクトは衝撃を受けない
    applyImpulse() {
        // 何もしない
    }
}