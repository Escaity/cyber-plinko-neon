// 空間分割グリッド（CollisionDetectorが依存）
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.grid = new Map();
    }

    /**
     * グリッドのクリア
     */
    clear() {
        this.grid.clear();
    }

    /**
     * オブジェクトをグリッドに追加
     */
    addObject(obj, x, y, radius) {
        const cells = this.getCells(x, y, radius);

        cells.forEach(cellKey => {
            if (!this.grid.has(cellKey)) {
                this.grid.set(cellKey, []);
            }
            this.grid.get(cellKey).push(obj);
        });
    }

    /**
     * オブジェクトの近隣オブジェクトを取得
     */
    getNearbyObjects(x, y, radius) {
        const cells = this.getCells(x, y, radius);
        const nearby = new Set();

        cells.forEach(cellKey => {
            const objects = this.grid.get(cellKey);
            if (objects) {
                objects.forEach(obj => nearby.add(obj));
            }
        });

        return Array.from(nearby);
    }

    /**
     * オブジェクトが占有するセルを取得
     */
    getCells(x, y, radius) {
        const minX = Math.max(0, Math.floor((x - radius) / this.cellSize));
        const maxX = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
        const minY = Math.max(0, Math.floor((y - radius) / this.cellSize));
        const maxY = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

        const cells = [];
        for (let col = minX; col <= maxX; col++) {
            for (let row = minY; row <= maxY; row++) {
                cells.push(`${col},${row}`);
            }
        }
        return cells;
    }

    /**
     * デバッグ用グリッド描画
     */
    drawGrid(ctx) {
        if (!CONFIG.DEBUG.SHOW_GRID) return;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 255, 65, 0.1)';
        ctx.lineWidth = 1;

        // 縦線
        for (let col = 0; col <= this.cols; col++) {
            const x = col * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }

        // 横線
        for (let row = 0; row <= this.rows; row++) {
            const y = row * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * グリッド統計の取得
     */
    getGridStats() {
        const occupiedCells = this.grid.size;
        const totalCells = this.cols * this.rows;
        let totalObjects = 0;

        this.grid.forEach(cellObjects => {
            totalObjects += cellObjects.length;
        });

        return {
            occupiedCells,
            totalCells,
            occupancyRate: (occupiedCells / totalCells * 100).toFixed(1) + '%',
            totalObjects,
            averageObjectsPerCell: occupiedCells > 0 ? (totalObjects / occupiedCells).toFixed(1) : 0
        };
    }
}

// 高性能衝突検出システム
class CollisionDetector {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.spatialGrid = new SpatialGrid(width, height, CONFIG.PERFORMANCE.COLLISION_GRID_SIZE);
        this.collisionPairs = new Set();
        this.lastFrameCollisions = new Set();

        // 衝突統計
        this.stats = {
            totalChecks: 0,
            actualCollisions: 0,
            broadPhaseFiltered: 0,
            frameTime: 0
        };
    }

    /**
     * メイン衝突検出処理
     */
    detectCollisions(objects) {
        const startTime = performance.now();

        this.stats.totalChecks = 0;
        this.stats.actualCollisions = 0;
        this.stats.broadPhaseFiltered = 0;

        // 空間グリッドのクリア
        this.spatialGrid.clear();

        // アクティブなオブジェクトのみをフィルタリング
        const activeObjects = objects.filter(obj => obj.isActive && obj.canCollide);

        // 空間グリッドにオブジェクトを登録
        this.populateSpatialGrid(activeObjects);

        // 衝突ペアのクリア
        const currentFrameCollisions = new Set();

        // 各オブジェクトについて衝突チェック
        for (let i = 0; i < activeObjects.length; i++) {
            const objA = activeObjects[i];
            if (!objA.isActive) continue;

            // 空間グリッドから近隣オブジェクトを取得
            const nearbyObjects = this.spatialGrid.getNearbyObjects(
                objA.x, objA.y, objA.radius
            );

            this.stats.broadPhaseFiltered += nearbyObjects.length;

            for (const objB of nearbyObjects) {
                if (objA === objB || !objB.isActive) continue;

                // ペアIDの生成（順序を保証）
                const pairId = this.generatePairId(objA, objB);

                // 既にチェック済みのペアはスキップ
                if (currentFrameCollisions.has(pairId)) continue;

                this.stats.totalChecks++;

                // 詳細衝突判定
                if (this.checkCollision(objA, objB)) {
                    currentFrameCollisions.add(pairId);
                    this.resolveCollision(objA, objB);
                    this.stats.actualCollisions++;

                    // 衝突イベントの発火
                    this.onCollision(objA, objB);
                }
            }
        }

        this.lastFrameCollisions = currentFrameCollisions;
        this.stats.frameTime = performance.now() - startTime;
    }

    /**
     * 空間グリッドにオブジェクトを配置
     */
    populateSpatialGrid(objects) {
        for (const obj of objects) {
            this.spatialGrid.addObject(obj, obj.x, obj.y, obj.radius);
        }
    }

    /**
     * 精密な衝突判定
     */
    checkCollision(objA, objB) {
        // 衝突グループチェック
        if (!this.canCollide(objA, objB)) return false;

        // 距離ベースの衝突判定
        const dx = objB.x - objA.x;
        const dy = objB.y - objA.y;
        const distanceSquared = dx * dx + dy * dy;
        const radiusSum = objA.radius + objB.radius;

        return distanceSquared < (radiusSum * radiusSum);
    }

    /**
     * 衝突可能性のチェック
     */
    canCollide(objA, objB) {
        // 衝突グループとマスクのチェック
        const aCanCollideWithB = objA.collisionMask.includes(objB.collisionGroup);
        const bCanCollideWithA = objB.collisionMask.includes(objA.collisionGroup);

        return aCanCollideWithB || bCanCollideWithA;
    }

    /**
     * 衝突解決
     */
    resolveCollision(objA, objB) {
        const dx = objB.x - objA.x;
        const dy = objB.y - objA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // ゼロ除算の回避
        if (distance === 0) {
            const angle = Math.random() * Math.PI * 2;
            const separationDistance = (objA.radius + objB.radius) * 0.5;
            objA.x -= Math.cos(angle) * separationDistance;
            objA.y -= Math.sin(angle) * separationDistance;
            objB.x += Math.cos(angle) * separationDistance;
            objB.y += Math.sin(angle) * separationDistance;
            return;
        }

        const overlap = (objA.radius + objB.radius) - distance;
        if (overlap <= 0) return;

        // 正規化された方向ベクトル
        const nx = dx / distance;
        const ny = dy / distance;

        // 位置補正
        this.separateObjects(objA, objB, nx, ny, overlap);

        // 速度解決
        this.resolveVelocities(objA, objB, nx, ny);
    }

    /**
     * オブジェクトの分離
     */
    separateObjects(objA, objB, nx, ny, overlap) {
        const totalMass = objA.mass + objB.mass;

        if (!objA.isStatic && !objB.isStatic) {
            // 両方が動的オブジェクトの場合、質量比で分離
            const separationA = (overlap * objB.mass / totalMass) * 0.5;
            const separationB = (overlap * objA.mass / totalMass) * 0.5;

            objA.x -= nx * separationA;
            objA.y -= ny * separationA;
            objB.x += nx * separationB;
            objB.y += ny * separationB;
        } else if (!objA.isStatic) {
            // Aのみが動的な場合
            objA.x -= nx * overlap;
            objA.y -= ny * overlap;
        } else if (!objB.isStatic) {
            // Bのみが動的な場合
            objB.x += nx * overlap;
            objB.y += ny * overlap;
        }
    }

    /**
     * 速度の解決
     */
    resolveVelocities(objA, objB, nx, ny) {
        // 相対速度
        const relativeVelocityX = objA.vx - objB.vx;
        const relativeVelocityY = objA.vy - objB.vy;

        // 法線方向の相対速度
        const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

        // 離れていく場合は処理しない
        if (velocityAlongNormal > 0) return;

        // 反発係数
        const restitution = Math.min(objA.bounce, objB.bounce);

        // インパルスの大きさ
        const j = -(1 + restitution) * velocityAlongNormal;
        const impulse = j / (1/objA.mass + 1/objB.mass);

        // 速度の更新
        if (!objA.isStatic) {
            objA.vx += impulse * nx / objA.mass;
            objA.vy += impulse * ny / objA.mass;
        }
        if (!objB.isStatic) {
            objB.vx -= impulse * nx / objB.mass;
            objB.vy -= impulse * ny / objB.mass;
        }

        // ダンピング
        const damping = CONFIG.PHYSICS.COLLISION_DAMPING;
        if (!objA.isStatic) {
            objA.vx *= damping;
            objA.vy *= damping;
        }
        if (!objB.isStatic) {
            objB.vx *= damping;
            objB.vy *= damping;
        }
    }

    /**
     * 衝突ペアIDの生成
     */
    generatePairId(objA, objB) {
        const idA = objA.id || objA;
        const idB = objB.id || objB;
        return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
    }

    /**
     * 衝突イベント
     */
    onCollision(objA, objB) {
        // 衝突タイプに応じた処理
        this.handleCollisionByType(objA, objB);

        // パーティクルエフェクト
        this.createCollisionEffect(objA, objB);
    }

    /**
     * 衝突タイプ別処理
     */
    handleCollisionByType(objA, objB) {
        // ボール同士の衝突
        if (objA.type === 'ball' && objB.type === 'ball') {
            this.handleBallBallCollision(objA, objB);
        }

        // ボールとペグの衝突
        else if ((objA.type === 'ball' && objB.type === 'peg') ||
            (objA.type === 'peg' && objB.type === 'ball')) {
            const ball = objA.type === 'ball' ? objA : objB;
            const peg = objA.type === 'peg' ? objA : objB;
            this.handleBallPegCollision(ball, peg);
        }
    }

    /**
     * ボール同士の衝突処理
     */
    handleBallBallCollision(ballA, ballB) {
        // 質量と速度を考慮した弾性衝突
        const restitution = CONFIG.PHYSICS.BALL_BALL_BOUNCE;

        // エネルギー保存を考慮した速度交換
        const totalMass = ballA.mass + ballB.mass;
        const massRatioA = (ballA.mass - ballB.mass) / totalMass;
        const massRatioB = (ballB.mass - ballA.mass) / totalMass;
        const momentumFactor = 2 / totalMass;

        const dx = ballB.x - ballA.x;
        const dy = ballB.y - ballA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const nx = dx / distance;
            const ny = dy / distance;

            // 法線方向の速度成分
            const v1n = ballA.vx * nx + ballA.vy * ny;
            const v2n = ballB.vx * nx + ballB.vy * ny;

            // 新しい法線方向速度
            const newV1n = (massRatioA * v1n + momentumFactor * ballB.mass * v2n) * restitution;
            const newV2n = (massRatioB * v2n + momentumFactor * ballA.mass * v1n) * restitution;

            // 速度の更新
            ballA.vx += (newV1n - v1n) * nx;
            ballA.vy += (newV1n - v1n) * ny;
            ballB.vx += (newV2n - v2n) * nx;
            ballB.vy += (newV2n - v2n) * ny;
        }

        // 衝突エフェクト
        if (window.particleSystem) {
            const midX = (ballA.x + ballB.x) / 2;
            const midY = (ballA.y + ballB.y) / 2;
            window.particleSystem.createSparks(midX, midY, 2, ballA.color);
        }

        // ボールの衝突コールバック
        if (ballA.onCollision) ballA.onCollision(ballB);
        if (ballB.onCollision) ballB.onCollision(ballA);
    }

    /**
     * ボールとペグの衝突処理
     */
    handleBallPegCollision(ball, peg) {
        // ペグは静的なので、ボールのみが影響を受ける
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const nx = dx / distance;
            const ny = dy / distance;

            // 法線方向の速度
            const normalVelocity = ball.vx * nx + ball.vy * ny;

            // 反射処理
            ball.vx -= 2 * normalVelocity * nx * ball.bounce;
            ball.vy -= 2 * normalVelocity * ny * ball.bounce;

            // ランダムな跳ね返りを追加（Plinkoの特徴）
            const randomFactor = CONFIG.BALL.RANDOM_VELOCITY_RANGE;
            ball.vx += (Math.random() - 0.5) * randomFactor;
            ball.vy += (Math.random() - 0.5) * randomFactor * 0.5;
        }

        // ペグヒットエフェクト
        if (window.particleSystem) {
            window.particleSystem.createSparks(peg.x, peg.y, 3, ball.color);
        }

        // ペグのアニメーション
        if (peg.onHit) {
            peg.onHit(ball);
        }

        // ボールの衝突コールバック
        if (ball.onCollision) {
            ball.onCollision(peg);
        }
    }

    /**
     * 衝突エフェクトの生成
     */
    createCollisionEffect(objA, objB) {
        const midX = (objA.x + objB.x) / 2;
        const midY = (objA.y + objB.y) / 2;

        // 衝突の強度を計算
        const relativeSpeed = Math.sqrt(
            Math.pow(objA.vx - objB.vx, 2) + Math.pow(objA.vy - objB.vy, 2)
        );

        const intensity = Math.min(relativeSpeed / 10, 1);

        // パーティクルエフェクト
        if (window.particleSystem && intensity > 0.1) {
            const color = objA.color || objB.color || CONFIG.COLORS.PRIMARY;
            window.particleSystem.createSparks(midX, midY, Math.floor(intensity * 5), color);
        }

        // 画面揺れ
        if (window.screenShake && intensity > 0.5) {
            window.screenShake.shake(intensity * 2, 10);
        }
    }

    /**
     * 連続衝突検出（高速オブジェクト用）
     */
    continuousCollisionDetection(objA, objB) {
        // 前フレームの位置から現在の位置までの軌跡をチェック
        const steps = 5; // 分割数

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;

            const testX_A = this.lerp(objA.prevX, objA.x, t);
            const testY_A = this.lerp(objA.prevY, objA.y, t);
            const testX_B = this.lerp(objB.prevX, objB.x, t);
            const testY_B = this.lerp(objB.prevY, objB.y, t);

            const dx = testX_B - testX_A;
            const dy = testY_B - testY_A;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < objA.radius + objB.radius) {
                // 衝突時点の位置に戻す
                objA.x = testX_A;
                objA.y = testY_A;
                objB.x = testX_B;
                objB.y = testY_B;

                return true;
            }
        }

        return false;
    }

    /**
     * 線形補間ヘルパー
     */
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    /**
     * 境界との衝突検出
     */
    detectBoundaryCollisions(objects) {
        for (const obj of objects) {
            if (!obj.isActive || obj.isStatic) continue;

            let collided = false;

            // 左右の境界
            if (obj.x - obj.radius < 0) {
                obj.x = obj.radius;
                obj.vx = Math.abs(obj.vx) * obj.bounce;
                collided = true;
            } else if (obj.x + obj.radius > this.width) {
                obj.x = this.width - obj.radius;
                obj.vx = -Math.abs(obj.vx) * obj.bounce;
                collided = true;
            }

            // 上下の境界
            if (obj.y - obj.radius < 0) {
                obj.y = obj.radius;
                obj.vy = Math.abs(obj.vy) * obj.bounce;
                collided = true;
            } else if (obj.y + obj.radius > this.height) {
                obj.y = this.height - obj.radius;
                obj.vy = -Math.abs(obj.vy) * obj.bounce;
                collided = true;
            }

            // 境界衝突エフェクト
            if (collided && window.particleSystem) {
                window.particleSystem.createSparks(obj.x, obj.y, 2, obj.color || CONFIG.COLORS.PRIMARY);
            }
        }
    }

    /**
     * レイキャスト（線分と円の交差判定）
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

                const dist = Math.sqrt((x - obj.x) * (x - obj.x) + (y - obj.y) * (y - obj.y));
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
            const dist = Math.sqrt((x - obj.x) * (x - obj.x) + (y - obj.y) * (y - obj.y));
            return dist <= radius + obj.radius;
        });
    }

    /**
     * 衝突統計の取得
     */
    getCollisionStats() {
        return {
            ...this.stats,
            efficiency: this.stats.totalChecks > 0 ?
                (this.stats.actualCollisions / this.stats.totalChecks * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * デバッグ情報の描画
     */
    drawDebugInfo(ctx) {
        if (!CONFIG.DEBUG.SHOW_COLLISION_BOXES) return;

        // 空間グリッドの描画
        this.spatialGrid.drawGrid(ctx);

        // 統計情報の表示
        const stats = this.getCollisionStats();
        const lines = [
            `Collision Checks: ${stats.totalChecks}`,
            `Actual Collisions: ${stats.actualCollisions}`,
            `Efficiency: ${stats.efficiency}`,
            `Frame Time: ${stats.frameTime.toFixed(2)}ms`
        ];

        ctx.save();
        ctx.font = '10px Share Tech Mono';
        ctx.fillStyle = CONFIG.COLORS.SECONDARY;
        ctx.textAlign = 'left';

        lines.forEach((line, index) => {
            ctx.fillText(line, 10, this.height - 60 + index * 12);
        });

        ctx.restore();
    }

    /**
     * パフォーマンス監視
     */
    getPerformanceMetrics() {
        return {
            averageFrameTime: this.stats.frameTime,
            collisionsPerFrame: this.stats.actualCollisions,
            checksPerFrame: this.stats.totalChecks,
            efficiency: this.stats.totalChecks > 0 ? this.stats.actualCollisions / this.stats.totalChecks : 0,
            spatialGridPerformance: {
                objectsFiltered: this.stats.broadPhaseFiltered,
                gridCells: this.spatialGrid.cols * this.spatialGrid.rows
            }
        };
    }

    /**
     * システムのリセット
     */
    reset() {
        this.spatialGrid.clear();
        this.collisionPairs.clear();
        this.lastFrameCollisions.clear();

        this.stats = {
            totalChecks: 0,
            actualCollisions: 0,
            broadPhaseFiltered: 0,
            frameTime: 0
        };
    }

    /**
     * 設定の動的変更
     */
    updateConfiguration(newConfig) {
        if (newConfig.gridSize && newConfig.gridSize !== this.spatialGrid.cellSize) {
            this.spatialGrid = new SpatialGrid(this.width, this.height, newConfig.gridSize);
        }
    }
}

