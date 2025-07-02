// ユーティリティ関数とヘルパー
const Utils = {
    // 数学ユーティリティ
    Math: {
        /**
         * 2点間の距離を計算
         */
        calculateDistance(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        },

        /**
         * 2点間の距離の二乗を計算（高速化のため）
         */
        calculateDistanceSquared(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return dx * dx + dy * dy;
        },

        /**
         * 値を指定範囲内にクランプ
         */
        clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        },

        /**
         * 線形補間
         */
        lerp(start, end, factor) {
            return start + (end - start) * factor;
        },

        /**
         * 角度の正規化（0-2π）
         */
        normalizeAngle(angle) {
            while (angle < 0) angle += Math.PI * 2;
            while (angle >= Math.PI * 2) angle -= Math.PI * 2;
            return angle;
        },

        /**
         * ランダムな浮動小数点数
         */
        randomFloat(min, max) {
            return Math.random() * (max - min) + min;
        },

        /**
         * ランダムな整数
         */
        randomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },

        /**
         * 円周上のランダムなポイント
         */
        randomPointOnCircle(centerX, centerY, radius) {
            const angle = Math.random() * Math.PI * 2;
            return {
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            };
        }
    },

    // カラーユーティリティ
    Color: {
        /**
         * HSLからRGBに変換
         */
        hslToRgb(h, s, l) {
            h /= 360;
            s /= 100;
            l /= 100;

            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs((h * 6) % 2 - 1));
            const m = l - c / 2;

            let r, g, b;

            if (0 <= h && h < 1/6) {
                r = c; g = x; b = 0;
            } else if (1/6 <= h && h < 2/6) {
                r = x; g = c; b = 0;
            } else if (2/6 <= h && h < 3/6) {
                r = 0; g = c; b = x;
            } else if (3/6 <= h && h < 4/6) {
                r = 0; g = x; b = c;
            } else if (4/6 <= h && h < 5/6) {
                r = x; g = 0; b = c;
            } else {
                r = c; g = 0; b = x;
            }

            return {
                r: Math.round((r + m) * 255),
                g: Math.round((g + m) * 255),
                b: Math.round((b + m) * 255)
            };
        },

        /**
         * ランダムなサイバーパンクカラー
         */
        generateRandomCyberColor() {
            const colors = CONFIG.COLORS.BALL_COLORS;
            return colors[Math.floor(Math.random() * colors.length)];
        },

        /**
         * 得点に基づくスロットカラー
         */
        getSlotColorByPoints(points) {
            if (points >= 1000) return CONFIG.COLORS.SLOT_JACKPOT;
            if (points >= 500) return CONFIG.COLORS.SLOT_HIGH;
            if (points >= 200) return CONFIG.COLORS.SLOT_MEDIUM;
            return CONFIG.COLORS.SLOT_LOW;
        },

        /**
         * カラーにアルファ値を追加
         */
        addAlpha(color, alpha) {
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
            return color;
        },

        /**
         * カラーの明度を調整
         */
        adjustBrightness(color, factor) {
            if (!color.startsWith('#')) return color;

            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);

            const newR = Math.min(255, Math.floor(r * factor));
            const newG = Math.min(255, Math.floor(g * factor));
            const newB = Math.min(255, Math.floor(b * factor));

            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        }
    },

    // DOMユーティリティ
    DOM: {
        /**
         * 要素の取得
         */
        get(id) {
            return document.getElementById(id);
        },

        /**
         * 要素のテキスト更新
         */
        setText(id, text) {
            const element = this.get(id);
            if (element) element.textContent = text;
        },

        /**
         * 要素の表示/非表示
         */
        setVisibility(id, visible) {
            const element = this.get(id);
            if (element) {
                element.style.display = visible ? 'block' : 'none';
            }
        },

        /**
         * キャンバスのマウス座標取得
         */
        getCanvasMousePosition(canvas, event) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
        }
    },

    // パフォーマンスユーティリティ
    Performance: {
        /**
         * FPS計算用のタイマー
         */
        fpsCounter: {
            frameCount: 0,
            lastTime: performance.now(),
            fps: 60
        },

        /**
         * FPS更新
         */
        updateFPS() {
            this.fpsCounter.frameCount++;
            const currentTime = performance.now();

            if (currentTime - this.fpsCounter.lastTime >= 1000) {
                this.fpsCounter.fps = Math.round(
                    this.fpsCounter.frameCount * 1000 / (currentTime - this.fpsCounter.lastTime)
                );
                this.fpsCounter.frameCount = 0;
                this.fpsCounter.lastTime = currentTime;

                Utils.DOM.setText('fps', this.fpsCounter.fps);
            }
        },

        /**
         * メモリ使用量の概算
         */
        getMemoryUsage() {
            if (performance.memory) {
                return {
                    used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                    total: Math.round(performance.memory.totalJSHeapSize / 1048576),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
                };
            }
            return null;
        },

        /**
         * パフォーマンス測定用デコレータ
         */
        measurePerformance(fn, name) {
            return function(...args) {
                const start = performance.now();
                const result = fn.apply(this, args);
                const end = performance.now();

                if (CONFIG.DEBUG.LOG_PERFORMANCE) {
                    console.log(`${name}: ${(end - start).toFixed(2)}ms`);
                }

                return result;
            };
        }
    },

    // 空間分割ユーティリティ
    SpatialGrid: {
        /**
         * グリッド座標の計算
         */
        getGridCoordinate(x, y, gridSize) {
            return {
                x: Math.floor(x / gridSize),
                y: Math.floor(y / gridSize)
            };
        },

        /**
         * グリッドハッシュキーの生成
         */
        getGridKey(gridX, gridY) {
            return `${gridX},${gridY}`;
        },

        /**
         * オブジェクトの周辺グリッドを取得
         */
        getNearbyGrids(x, y, radius, gridSize) {
            const grids = [];
            const minGridX = Math.floor((x - radius) / gridSize);
            const maxGridX = Math.floor((x + radius) / gridSize);
            const minGridY = Math.floor((y - radius) / gridSize);
            const maxGridY = Math.floor((y + radius) / gridSize);

            for (let gx = minGridX; gx <= maxGridX; gx++) {
                for (let gy = minGridY; gy <= maxGridY; gy++) {
                    grids.push(this.getGridKey(gx, gy));
                }
            }

            return grids;
        }
    },

    // 配列ユーティリティ
    Array: {
        /**
         * 配列のシャッフル
         */
        shuffle(array) {
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },

        /**
         * 配列からランダム要素を取得
         */
        randomElement(array) {
            return array[Math.floor(Math.random() * array.length)];
        },

        /**
         * 配列の重複削除
         */
        unique(array) {
            return [...new Set(array)];
        },

        /**
         * 配列の分割
         */
        chunk(array, size) {
            const chunks = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        }
    },

    // 時間ユーティリティ
    Time: {
        /**
         * フレーム時間の管理
         */
        frameTimer: {
            lastTime: 0,
            deltaTime: 0,
            totalTime: 0
        },

        /**
         * フレーム時間の更新
         */
        updateFrameTime(currentTime) {
            this.frameTimer.deltaTime = currentTime - this.frameTimer.lastTime;
            this.frameTimer.lastTime = currentTime;
            this.frameTimer.totalTime += this.frameTimer.deltaTime;
        },

        /**
         * デルタタイムの取得（秒単位）
         */
        getDeltaTime() {
            return this.frameTimer.deltaTime / 1000;
        },

        /**
         * 総経過時間の取得（秒単位）
         */
        getTotalTime() {
            return this.frameTimer.totalTime / 1000;
        }
    },

    // デバッグユーティリティ
    Debug: {
        /**
         * オブジェクトの詳細ログ
         */
        logObject(obj, name = 'Object') {
            if (CONFIG.DEBUG.LOG_PERFORMANCE) {
                console.group(name);
                Object.entries(obj).forEach(([key, value]) => {
                    console.log(`${key}:`, value);
                });
                console.groupEnd();
            }
        },

        /**
         * パフォーマンス情報の表示
         */
        showPerformanceInfo(balls, pegs, particles) {
            if (!CONFIG.DEBUG.SHOW_FPS) return;

            const info = {
                fps: Utils.Performance.fpsCounter.fps,
                balls: balls.length,
                pegs: pegs.length,
                particles: particles ? particles.length : 0,
                memory: Utils.Performance.getMemoryUsage()
            };

            console.log('Performance Info:', info);
        }
    }
};