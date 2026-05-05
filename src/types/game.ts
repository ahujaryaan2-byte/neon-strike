/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export interface GameObject extends Point {
  id: string;
  radius: number;
  color: string;
  velocity: Point;
}

export interface Bullet extends GameObject {
  damage: number;
}

export interface Enemy extends GameObject {
  health: number;
  maxHealth: number;
  type: 'basic' | 'fast' | 'tank' | 'boss';
  scoreValue: number;
}

export interface Particle extends GameObject {
  alpha: number;
  decay: number;
  size: number;
}

export interface GameState {
  score: number;
  health: number;
  maxHealth: number;
  level: number;
  isGameOver: boolean;
  isPaused: boolean;
  upgradePoints: number;
  fireRate: number;
  bulletSpeed: number;
  damage: number;
}
