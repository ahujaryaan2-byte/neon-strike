/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point, GameObject, Bullet, Enemy, Particle } from '../types/game';

export const COLORS = {
  player: '#00ccff',
  enemyBasic: '#ff0055',
  enemyFast: '#ffff00',
  enemyTank: '#ff00ff',
  bullet: '#ffffff',
  background: '#0a0a0f',
  grid: '#1a1a2e',
};

export function getDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function checkCollision(obj1: GameObject, obj2: GameObject): boolean {
  return getDistance(obj1, obj2) < obj1.radius + obj2.radius;
}

export function createParticle(x: number, y: number, color: string): Particle {
  return {
    id: Math.random().toString(36).substr(2, 9),
    x,
    y,
    radius: Math.random() * 2 + 1,
    size: Math.random() * 2 + 1,
    color,
    velocity: {
      x: (Math.random() - 0.5) * 5,
      y: (Math.random() - 0.5) * 5,
    },
    alpha: 1,
    decay: Math.random() * 0.02 + 0.015,
  };
}

export function spawnEnemy(width: number, height: number, level: number): Enemy {
  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) { // Top
    x = Math.random() * width;
    y = -50;
  } else if (side === 1) { // Bottom
    x = Math.random() * width;
    y = height + 50;
  } else if (side === 2) { // Left
    x = -50;
    y = Math.random() * height;
  } else { // Right
    x = width + 50;
    y = Math.random() * height;
  }

  const typeRoll = Math.random();
  let type: Enemy['type'] = 'basic';
  let health = 1 + Math.floor(level / 2);
  let speed = 1.5 + (level * 0.1);
  let radius = 15;
  let color = COLORS.enemyBasic;
  let scoreValue = 10;

  if (typeRoll > 0.9) {
    type = 'tank';
    health *= 4;
    speed *= 0.6;
    radius = 25;
    color = COLORS.enemyTank;
    scoreValue = 50;
  } else if (typeRoll > 0.7) {
    type = 'fast';
    health *= 0.5;
    speed *= 2;
    radius = 10;
    color = COLORS.enemyFast;
    scoreValue = 25;
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    x,
    y,
    radius,
    color,
    health,
    maxHealth: health,
    type,
    scoreValue,
    velocity: { x: 0, y: 0 },
  };
}
