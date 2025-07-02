// ゲーム設定とコンフィグレーション
const CONFIG = {
    // ゲーム基本設定
    GAME: {
        INITIAL_BALL_COUNT: 55,
        CANVAS_WIDTH: 600,
        CANVAS_HEIGHT: 700,
        MAX_BALLS_ON_SCREEN: 50, // パフォーマンス改善: 同時表示球数制限
        TARGET_FPS: 60
    },

    // 物理演算設定
    PHYSICS: {
        GRAVITY: 0.25,
        FRICTION: 0.995,
        BOUNCE: 0.65,
        MAX_VELOCITY: 15, // 最大速度制限
        BALL_BALL_BOUNCE: 0.8, // ボール同士の反発係数
        COLLISION_DAMPING: 0.95 // 衝突時の速度減衰
    },

    // ボール設定
    BALL: {
        RADIUS: 6,
        INITIAL_Y: 20,
        RANDOM_VELOCITY_RANGE: 1.5,
        TRAIL_LENGTH: 3, // パーティクルトレイルの長さ
        GLOW_INTENSITY: 0.8
    },

    // ペグ設定
    PEG: {
        RADIUS: 4,
        ROWS: 13,
        COLS: 9,
        START_Y: 80,
        ROW_SPACING: 42,
        COL_SPACING: 55,
        GLOW_PULSE_SPEED: 0.02
    },

    // スロット設定
    SLOT: {
        COUNT: 7,
        HEIGHT: 65,
        POINTS: [50, 200, 500, 1000, 500, 200, 50],
        EFFECT_DURATION: 60 // フレーム数
    },

    // パフォーマンス設定
    PERFORMANCE: {
        ENABLE_OBJECT_POOLING: true,
        MAX_PARTICLES: 150,
        COLLISION_GRID_SIZE: 50, // 空間分割のグリッドサイズ
        UPDATE_FREQUENCY: 1, // 毎フレーム更新 (1 = 毎回, 2 = 1フレームおき)
        RENDER_SCALE: 1, // レンダリングスケール
        ENABLE_SPATIAL_PARTITIONING: true
    },

    // エフェクト設定
    EFFECTS: {
        ENABLE_PARTICLES: true,
        ENABLE_TRAILS: true,
        ENABLE_GLOW: true,
        ENABLE_SCREEN_SHAKE: true,
        PARTICLE_LIFETIME: 20,
        EXPLOSION_PARTICLES: 20,
        SCREEN_SHAKE_INTENSITY: 3
    },

    // カラーパレット（サイバーパンク）
    COLORS: {
        // 背景
        BACKGROUND_START: '#0a0a0a',
        BACKGROUND_END: '#1a0a2e',

        // UI要素
        PRIMARY: '#00ff41',      // サイバーグリーン
        SECONDARY: '#00d4ff',    // サイバーブルー
        ACCENT: '#bc13fe',       // サイバーパープル
        WARNING: '#ff6600',      // サイバーオレンジ

        // ゲーム要素
        PEG_IDLE: '#00ff41',
        PEG_ACTIVE: '#00d4ff',
        DROP_LINE: 'rgba(0, 255, 65, 0.6)',

        // スロット
        SLOT_JACKPOT: '#bc13fe',     // 最高得点
        SLOT_HIGH: '#ff6600',        // 高得点
        SLOT_MEDIUM: '#00d4ff',      // 中得点
        SLOT_LOW: '#00ff41',         // 低得点

        // ボール色パレット
        BALL_COLORS: [
            '#00ff41', // グリーン
            '#00d4ff', // ブルー
            '#bc13fe', // パープル
            '#ff6600', // オレンジ
            '#ff0080', // ピンク
            '#80ff00', // ライム
            '#0080ff', // スカイブルー
            '#ff8000'  // アンバー
        ],

        // パーティクル
        PARTICLE_COLORS: [
            '#00ff41',
            '#00d4ff',
            '#bc13fe',
            '#ff6600',
            '#ffffff'
        ]
    },

    // サウンド設定（将来の拡張用）
    AUDIO: {
        ENABLE_SOUND: false,
        MASTER_VOLUME: 0.5,
        SFX_VOLUME: 0.7,
        MUSIC_VOLUME: 0.3
    },

    // デバッグ設定
    DEBUG: {
        SHOW_FPS: true,
        SHOW_COLLISION_BOXES: false,
        SHOW_VELOCITY_VECTORS: false,
        SHOW_GRID: false,
        LOG_PERFORMANCE: false
    }
};

// 動的設定の調整（デバイス性能に基づく）
function adjustConfigForDevice() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    // GPU性能の簡易チェック
    const hasWebGL = !!gl;
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|tablet|android|iphone|ipad/.test(userAgent);

    if (isMobile || !hasWebGL) {
        // モバイルデバイスまたは低性能デバイスの場合
        CONFIG.PERFORMANCE.MAX_PARTICLES = 100;
        CONFIG.GAME.MAX_BALLS_ON_SCREEN = 25;
        CONFIG.EFFECTS.ENABLE_TRAILS = false;
        CONFIG.PERFORMANCE.UPDATE_FREQUENCY = 2;
        CONFIG.BALL.TRAIL_LENGTH = 3;
        CONFIG.EFFECTS.EXPLOSION_PARTICLES = 10;
    }

    // メモリ制限の設定
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        CONFIG.PERFORMANCE.MAX_PARTICLES = 50;
        CONFIG.GAME.MAX_BALLS_ON_SCREEN = 15;
        CONFIG.EFFECTS.ENABLE_GLOW = false;
    }
}

// 設定の初期化
document.addEventListener('DOMContentLoaded', adjustConfigForDevice);