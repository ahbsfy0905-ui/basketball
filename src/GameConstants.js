/**
 * GameConstants — all tunable game parameters in one place.
 * Import and use these instead of magic numbers throughout the codebase.
 */

// ===== COURT (NBA Regulation) =====
export const COURT_WIDTH = 15.24;          // 50 ft
export const COURT_LENGTH = 28.65;         // 94 ft
export const HALF_COURT_WIDTH = COURT_WIDTH / 2;

// ===== HOOP =====
export const RIM_HEIGHT = 3.05;            // 10 ft
export const RIM_Z = 0.381;               // 15 inches from board
export const RIM_RADIUS = 0.2286;          // 9 inches
export const BACKBOARD_WIDTH = 1.83;       // 72 inches
export const BACKBOARD_HEIGHT = 1.07;      // 42 inches
export const TARGET_BOX_W = 0.61;          // 24 inches
export const TARGET_BOX_H = 0.457;         // 18 inches

// ===== 3-POINT LINE =====
export const THREE_PT_ARC = 7.24;          // NBA arc radius
export const THREE_PT_CORNER = 6.71;       // NBA corner distance
export const THREE_PT_CORNER_Z = 2.73;     // Z threshold for corner vs arc

// ===== PAINT / FREE THROW =====
export const PAINT_WIDTH = 4.88;           // 16 ft
export const FT_DISTANCE = 4.57;           // 15 ft from backboard
export const RESTRICTED_AREA_R = 1.22;     // 4 ft
export const CENTER_CIRCLE_R = 1.83;       // 6 ft

// ===== BALL =====
export const BALL_RADIUS = 0.12;           // Size 7
export const BALL_MASS = 0.624;            // kg (NBA regulation)
export const BALL_RESTITUTION = 0.85;      // Bounce coefficient
export const BALL_LINEAR_DAMPING = 0.1;

// ===== PLAYER =====
export const PLAYER_HEIGHT = 1.70;         // Eye height (meters)
export const WALK_SPEED = 2.6;             // m/s
export const SPRINT_SPEED = 5.5;           // m/s
export const AIR_CONTROL_FACTOR = 0.3;

// ===== SHOT DISTANCES =====
export const DUNK_RANGE = 1.2;             // meters from rim
export const LAYUP_RANGE = 3.5;            // meters from rim

// ===== JUMP =====
export const JUMP_VELOCITY_NORMAL = 3.2;   // Regular jump & shot release
export const JUMP_VELOCITY_LAYUP = 4.0;
export const JUMP_VELOCITY_DUNK = 5.8;
export const JUMP_VELOCITY_GATHER = 5.5;

// ===== SHOT PHYSICS =====
export const MANUAL_SHOT_BASE_POWER = 5.0;
export const MANUAL_SHOT_GAUGE_POWER = 6.5;
export const AUTO_SHOT_LAUNCH_ANGLE_NEAR = 45;   // degrees (mid-range)
export const AUTO_SHOT_LAUNCH_ANGLE_FAR = 49;    // degrees (3pt)
export const AUTO_SHOT_DRAG_COMP = 1.05;
export const AUTO_SHOT_TARGET_OFFSET_Y = 0.15;   // Above rim

// ===== DRIBBLE =====
export const DRIBBLE_BOUNCE_SPEED = 2.8;

// ===== VIOLATIONS =====
export const TRAVELLING_DISTANCE = 3.0;    // Max distance after pickup

// ===== RESET =====
export const RESET_TIMER_NORMAL = 3000;    // ms
export const RESET_TIMER_OOB = 1500;       // ms

// ===== SCORE DETECTION =====
export const SCORE_CYLINDER_RADIUS_SQ = 0.04;  // 0.2m radius squared
export const SCORE_BELOW_RIM_MAX = 0.3;         // Check zone below rim

// ===== DELIVERY / ANIMATION =====
export const LOAD_PHASE_DURATION = 0.40;
export const LOAD_PHASE_AUTO = 0.12;
export const DELIVERY_SPEED_NORMAL = 2.2;
export const DELIVERY_SPEED_AUTO = 7.0;
export const AUTO_RELEASE_TIME = 0.12;
