// 物理エンティティの基底クラス
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
     * 位置の更新
     */
    updatePosition(deltaTime = 1) {
        if (this.isStatic || !this.isActive) return;

        // 前フレームの位置を保存
        this.prevX = this.x;
        this.prevY = this.y;

        // 物理演算
        this.vx += this.ax * deltaTime;
        this.vy += this.ay * deltaTime;

        // 重力の適用
        if (this.gravity !== 0) {
            this.vy += this.gravity * deltaTime;
        }

        // 摩擦の適用
        if (this.friction !== 1) {
            this.vx *= Math.pow(this.friction, deltaTime);
            this.vy *= Math.pow(this.friction, deltaTime);
        }

        // 速度制限
        const maxVel = CONFIG.PHYSICS.MAX_VELOCITY;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxVel) {
            const scale = maxVel / speed;
            this.vx *= scale;
            this.vy *= scale;
        }

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
     * 境界チェック
     */
    checkBounds(width, height) {
        let collided = false;

        // 左右の境界
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -this.bounce;
            collided = true;
        } else if (this.x + this.radius > width) {
            this.x = width - this.radius;
            this.vx *= -this.bounce;
            collided = true;
        }

        // 上下の境界
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy *= -this.bounce;
            collided = true;
        } else if (this.y + this.radius > height) {
            this.y = height - this.radius;
            this.vy *= -this.bounce;
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
     * 衝突判定
     */
    isCollidingWith(other) {
        if (!this.canCollide || !other.canCollide) return false;
        if (!this.isActive || !other.isActive) return false;
        if (this === other) return false;

        // 衝突グループのチェック
        if (!this.collisionMask.includes(other.collisionGroup)) return false;

        const distance = this.distanceTo(other);
        return distance < (this.radius + other.radius);
    }

    /**
     * 衝突レスポンス（基本実装）
     */
    resolveCollision(other) {
        if (!this.isCollidingWith(other)) return false;

        const distance = this.distanceTo(other);
        const overlap = (this.radius + other.radius) - distance;

        if (overlap <= 0) return false;

        // 衝突方向の計算
        let dx = other.x - this.x;
        let dy = other.y - this.y;

        // ゼロ除算の回避
        if (distance === 0) {
            dx = Utils.Math.randomFloat(-1, 1);
            dy = Utils.Math.randomFloat(-1, 1);
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        } else {
            dx /= distance;
            dy /= distance;
        }

        // 位置の分離
        const separation = overlap * 0.5;
        if (!this.isStatic) {
            this.x -= dx * separation;
            this.y -= dy * separation;
        }
        if (!other.isStatic) {
            other.x += dx * separation;
            other.y += dy * separation;
        }

        // 速度の交換（弾性衝突）
        if (!this.isStatic && !other.isStatic) {
            this.resolveElasticCollision(other, dx, dy);
        }

        return true;
    }

    /**
     * 弾性衝突の解決
     */
    resolveElasticCollision(other, nx, ny) {
        // 相対速度
        const dvx = this.vx - other.vx;
        const dvy = this.vy - other.vy;

        // 法線方向の相対速度
        const dvn = dvx * nx + dvy * ny;

        // 衝突していない場合は処理しない
        if (dvn > 0) return;

        // 衝突インパルスの計算
        const totalMass = this.mass + other.mass;
        const impulse = 2 * dvn / totalMass;

        // 反発係数の適用
        const restitution = Math.min(this.bounce, other.bounce);
        const impulseWithRestitution = impulse * restitution;

        // 速度の更新
        this.vx -= impulseWithRestitution * other.mass * nx;
        this.vy -= impulseWithRestitution * other.mass * ny;
        other.vx += impulseWithRestitution * this.mass * nx;
        other.vy += impulseWithRestitution * this.mass * ny;

        // ダンピングの適用
        const damping = CONFIG.PHYSICS.COLLISION_DAMPING;
        this.vx *= damping;
        this.vy *= damping;
        other.vx *= damping;
        other.vy *= damping;
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
            ctx.lineTo(this.x + this.vx * 5, this.y + this.vy * 5);
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