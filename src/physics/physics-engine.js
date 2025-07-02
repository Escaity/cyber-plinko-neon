// 高性能物理エンジン
class PhysicsEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.collisionDetector = new CollisionDetector(width, height);
        this.gravity = CONFIG.PHYSICS.GRAVITY;
        this.deltaTime = 1 / 60; // 60FPS想定
        this.timeAccumulator = 0;
        this.fixedTimeStep = 1 / 120; // 物理演算は120FPSで固定
        this.maxSubSteps = 5;

        // 物理統計
        this.stats = {
            updateTime: 0,
            collisionTime: 0,
            subSteps: 0
        };

        // 力のコレクション
        this.globalForces = [];
        this.forces = new Map(); // オブジェクトごとの力
    }

    /**
     * メイン物理更新
     */
    update(objects, deltaTime) {
        const startTime = performance.now();

        this.timeAccumulator += deltaTime;
        let subSteps = 0;

        // 固定タイムステップでの物理演算
        while (this.timeAccumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
            this.fixedUpdate(objects, this.fixedTimeStep);
            this.timeAccumulator -= this.fixedTimeStep;
            subSteps++;
        }

        this.stats.subSteps = subSteps;
        this.stats.updateTime = performance.now() - startTime;
    }

    /**
     * 固定タイムステップでの更新
     */
    fixedUpdate(objects, deltaTime) {
        // アクティブなオブジェクトをフィルタリング
        const activeObjects = objects.filter(obj => obj.isActive);

        // 力の適用
        this.applyForces(activeObjects, deltaTime);

        // 位置更新
        this.updatePositions(activeObjects, deltaTime);

        // 境界衝突
        this.collisionDetector.detectBoundaryCollisions(activeObjects);

        // オブジェクト間衝突
        const collisionStartTime = performance.now();
        this.collisionDetector.detectCollisions(activeObjects);
        this.stats.collisionTime = performance.now() - collisionStartTime;

        // 制約の解決
        this.resolveConstraints(activeObjects);

        // 力のリセット
        this.resetForces(activeObjects);
    }

    /**
     * 力の適用
     */
    applyForces(objects, deltaTime) {
        for (const obj of objects) {
            if (obj.isStatic) continue;

            // 重力
            if (obj.gravity !== 0) {
                obj.ay += obj.gravity;
            }

            // グローバル力
            for (const force of this.globalForces) {
                force.apply(obj, deltaTime);
            }

            // オブジェクト固有の力
            const objectForces = this.forces.get(obj.id);
            if (objectForces) {
                for (const force of objectForces) {
                    force.apply(obj, deltaTime);
                }
            }
        }
    }

    /**
     * 位置更新（Verlet積分）
     */
    updatePositions(objects, deltaTime) {
        for (const obj of objects) {
            if (obj.isStatic) continue;

            // 前フレームの位置を保存
            obj.prevX = obj.x;
            obj.prevY = obj.y;

            // Verlet積分による位置更新
            const newX = obj.x + obj.vx * deltaTime + 0.5 * obj.ax * deltaTime * deltaTime;
            const newY = obj.y + obj.vy * deltaTime + 0.5 * obj.ay * deltaTime * deltaTime;

            // 速度更新
            obj.vx += obj.ax * deltaTime;
            obj.vy += obj.ay * deltaTime;

            // 摩擦の適用
            if (obj.friction !== 1) {
                const frictionFactor = Math.pow(obj.friction, deltaTime * 60);
                obj.vx *= frictionFactor;
                obj.vy *= frictionFactor;
            }

            // 最大速度制限
            const maxVel = CONFIG.PHYSICS.MAX_VELOCITY;
            const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
            if (speed > maxVel) {
                const scale = maxVel / speed;
                obj.vx *= scale;
                obj.vy *= scale;
            }

            // 位置更新
            obj.x = newX;
            obj.y = newY;
        }
    }

    /**
     * 制約の解決
     */
    resolveConstraints(objects) {
        // 位置制約（境界内に留める）
        for (const obj of objects) {
            if (obj.isStatic) continue;

            // 境界制約
            obj.x = Utils.Math.clamp(obj.x, obj.radius, this.width - obj.radius);
            obj.y = Utils.Math.clamp(obj.y, obj.radius, this.height - obj.radius);
        }
    }

    /**
     * 力のリセット
     */
    resetForces(objects) {
        for (const obj of objects) {
            obj.ax = 0;
            obj.ay = 0;
        }
    }

    /**
     * グローバル力の追加
     */
    addGlobalForce(force) {
        this.globalForces.push(force);
    }

    /**
     * オブジェクト固有の力の追加
     */
    addForce(objectId, force) {
        if (!this.forces.has(objectId)) {
            this.forces.set(objectId, []);
        }
        this.forces.get(objectId).push(force);
    }

    /**
     * 力の削除
     */
    removeForce(objectId, force) {
        const objectForces = this.forces.get(objectId);
        if (objectForces) {
            const index = objectForces.indexOf(force);
            if (index !== -1) {
                objectForces.splice(index, 1);
            }
        }
    }

    /**
     * 重力の設定
     */
    setGravity(gravity) {
        this.gravity = gravity;
        CONFIG.PHYSICS.GRAVITY = gravity;
    }

    /**
     * レイキャスト
     */
    raycast(startX, startY, endX, endY, objects) {
        const results = [];
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) return results;

        const dirX = dx / length;
        const dirY = dy / length;
        const steps = Math.ceil(length);

        for (let i = 0; i <= steps; i++) {
            const x = startX + dirX * i;
            const y = startY + dirY * i;

            for (const obj of objects) {
                if (!obj.isActive) continue;

                const dist = Utils.Math.calculateDistance(x, y, obj.x, obj.y);
                if (dist <= obj.radius) {
                    results.push({
                        object: obj,
                        point: { x, y },
                        distance: i,
                        normal: {
                            x: (x - obj.x) / dist,
                            y: (y - obj.y) / dist
                        }
                    });
                    break; // 最初にヒットしたオブジェクトで終了
                }
            }
        }

        return results;
    }

    /**
     * エリア内のオブジェクト取得
     */
    getObjectsInArea(x, y, radius, objects) {
        return objects.filter(obj => {
            if (!obj.isActive) return false;
            const dist = Utils.Math.calculateDistance(x, y, obj.x, obj.y);
            return dist <= radius + obj.radius;
        });
    }

    /**
     * 運動エネルギーの計算
     */
    calculateKineticEnergy(obj) {
        const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
        return 0.5 * obj.mass * speed * speed;
    }

    /**
     * システム全体の運動エネルギー
     */
    getTotalKineticEnergy(objects) {
        return objects.reduce((total, obj) => {
            return total + (obj.isActive ? this.calculateKineticEnergy(obj) : 0);
        }, 0);
    }

    /**
     * 物理統計の取得
     */
    getPhysicsStats() {
        return {
            ...this.stats,
            collisionStats: this.collisionDetector.getCollisionStats()
        };
    }

    /**
     * デバッグ描画
     */
    drawDebugInfo(ctx) {
        this.collisionDetector.drawDebugInfo(ctx);

        // 物理統計の表示
        if (CONFIG.DEBUG.LOG_PERFORMANCE) {
            const stats = this.getPhysicsStats();
            const lines = [
                `Physics Update: ${stats.updateTime.toFixed(2)}ms`,
                `Collision Time: ${stats.collisionTime.toFixed(2)}ms`,
                `Sub Steps: ${stats.subSteps}`
            ];

            ctx.save();
            ctx.font = '10px Share Tech Mono';
            ctx.fillStyle = CONFIG.COLORS.PRIMARY;
            ctx.textAlign = 'right';

            lines.forEach((line, index) => {
                ctx.fillText(line, this.width - 10, 20 + index * 12);
            });

            ctx.restore();
        }
    }

    /**
     * システムのリセット
     */
    reset() {
        this.collisionDetector.reset();
        this.globalForces = [];
        this.forces.clear();
        this.timeAccumulator = 0;

        this.stats = {
            updateTime: 0,
            collisionTime: 0,
            subSteps: 0
        };
    }
}

// 力の基底クラス
class Force {
    constructor(name) {
        this.name = name;
        this.isActive = true;
    }

    apply(object, deltaTime) {
        // オーバーライド用
    }

    setActive(active) {
        this.isActive = active;
    }
}

// 重力力
class GravityForce extends Force {
    constructor(strength = CONFIG.PHYSICS.GRAVITY) {
        super('gravity');
        this.strength = strength;
    }

    apply(object, deltaTime) {
        if (!this.isActive || object.isStatic) return;
        object.ay += this.strength;
    }
}

// 風力
class WindForce extends Force {
    constructor(windX = 0, windY = 0) {
        super('wind');
        this.windX = windX;
        this.windY = windY;
    }

    apply(object, deltaTime) {
        if (!this.isActive || object.isStatic) return;

        // 空気抵抗を考慮した風力
        const dragCoeff = 0.1;
        const relativeVx = this.windX - object.vx;
        const relativeVy = this.windY - object.vy;

        object.ax += relativeVx * dragCoeff;
        object.ay += relativeVy * dragCoeff;
    }
}

// 磁力（引力/斥力）
class MagneticForce extends Force {
    constructor(centerX, centerY, strength = 100, maxDistance = 200) {
        super('magnetic');
        this.centerX = centerX;
        this.centerY = centerY;
        this.strength = strength;
        this.maxDistance = maxDistance;
    }

    apply(object, deltaTime) {
        if (!this.isActive || object.isStatic) return;

        const dx = this.centerX - object.x;
        const dy = this.centerY - object.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > this.maxDistance || distance === 0) return;

        const force = this.strength / (distance * distance);
        const forceX = (dx / distance) * force;
        const forceY = (dy / distance) * force;

        object.ax += forceX / object.mass;
        object.ay += forceY / object.mass;
    }

    setCenter(x, y) {
        this.centerX = x;
        this.centerY = y;
    }
}