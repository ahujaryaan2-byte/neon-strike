import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Zap, RotateCcw, Trophy, Play, Pause } from 'lucide-react';
import { GameState, Enemy, Bullet, Particle, Point } from '../types/game';
import { COLORS, getDistance, checkCollision, spawnEnemy, createParticle } from '../lib/gameLogic';

const INITIAL_STATE: GameState = {
  score: 0,
  health: 100,
  maxHealth: 100,
  level: 1,
  isGameOver: false,
  isPaused: false,
  upgradePoints: 0,
  fireRate: 8, // Bullets per second
  bulletSpeed: 10,
  damage: 1,
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [gameStarted, setGameStarted] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // Game references (mutable state for the loop)
  const playerRef = useRef({ x: 0, y: 0, radius: 15 });
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastShotTimeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameIdRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);

  const resetGame = () => {
    setGameState(INITIAL_STATE);
    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    playerRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      radius: 15,
    };
    lastShotTimeRef.current = 0;
    spawnTimerRef.current = 0;
    setGameStarted(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = true);
    const handleKeyUp = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = false);
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const update = useCallback((time: number) => {
    if (gameState.isGameOver || gameState.isPaused || !gameStarted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Move Player
    const speed = 5;
    if (keysRef.current['w'] || keysRef.current['arrowup']) playerRef.current.y -= speed;
    if (keysRef.current['s'] || keysRef.current['arrowdown']) playerRef.current.y += speed;
    if (keysRef.current['a'] || keysRef.current['arrowleft']) playerRef.current.x -= speed;
    if (keysRef.current['d'] || keysRef.current['arrowright']) playerRef.current.x += speed;

    // Bounds
    playerRef.current.x = Math.max(playerRef.current.radius, Math.min(canvas.width - playerRef.current.radius, playerRef.current.x));
    playerRef.current.y = Math.max(playerRef.current.radius, Math.min(canvas.height - playerRef.current.radius, playerRef.current.y));

    // 2. Shooting
    const fireInterval = 1000 / gameState.fireRate;
    if (time - lastShotTimeRef.current > fireInterval) {
      const angle = Math.atan2(
        mouseRef.current.y - playerRef.current.y,
        mouseRef.current.x - playerRef.current.x
      );
      
      bulletsRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: playerRef.current.x,
        y: playerRef.current.y,
        radius: 4,
        color: COLORS.bullet,
        damage: gameState.damage,
        velocity: {
          x: Math.cos(angle) * gameState.bulletSpeed,
          y: Math.sin(angle) * gameState.bulletSpeed,
        },
      });
      lastShotTimeRef.current = time;
    }

    // 3. Spawn enemies
    spawnTimerRef.current += 1;
    const spawnRate = Math.max(10, 60 - (gameState.level * 2));
    if (spawnTimerRef.current > spawnRate) {
      enemiesRef.current.push(spawnEnemy(canvas.width, canvas.height, gameState.level));
      spawnTimerRef.current = 0;
    }

    // 4. Update Game Objects
    bulletsRef.current = bulletsRef.current.filter(b => {
      b.x += b.velocity.x;
      b.y += b.velocity.y;
      return b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height;
    });

    enemiesRef.current.forEach(enemy => {
      const angle = Math.atan2(playerRef.current.y - enemy.y, playerRef.current.x - enemy.x);
      const speed = enemy.type === 'fast' ? 3 : enemy.type === 'tank' ? 1 : 2;
      enemy.x += Math.cos(angle) * speed;
      enemy.y += Math.sin(angle) * speed;

      // Player Collision
      if (checkCollision(playerRef.current, enemy as any)) {
        setGameState(prev => {
          const newHealth = prev.health - 10;
          if (newHealth <= 0) {
            return { ...prev, health: 0, isGameOver: true };
          }
          return { ...prev, health: newHealth };
        });
        
        // Take damage particles
        for(let i=0; i<10; i++) particlesRef.current.push(createParticle(playerRef.current.x, playerRef.current.y, COLORS.player));
        enemy.health = 0; // Destroy enemy on impact
      }
    });

    // Check Bullet collisions
    bulletsRef.current.forEach(bullet => {
      enemiesRef.current.forEach(enemy => {
        if (checkCollision(bullet as any, enemy as any)) {
          enemy.health -= bullet.damage;
          bullet.x = -1000; // Remove bullet
          
          if (enemy.health <= 0) {
            setGameState(prev => {
              const newScore = prev.score + enemy.scoreValue;
              const newLevel = Math.floor(newScore / 500) + 1;
              return { ...prev, score: newScore, level: newLevel };
            });
            // Explosion particles
            for(let i=0; i<8; i++) particlesRef.current.push(createParticle(enemy.x, enemy.y, enemy.color));
          }
        }
      });
    });

    enemiesRef.current = enemiesRef.current.filter(e => e.health > 0);

    particlesRef.current.forEach(p => {
      p.x += p.velocity.x;
      p.y += p.velocity.y;
      p.alpha -= p.decay;
    });
    particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);

    // 5. Draw
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Bullets
    ctx.shadowBlur = 10;
    ctx.shadowColor = COLORS.bullet;
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      
      if (e.type === 'fast') {
        ctx.moveTo(e.x, e.y - e.radius);
        ctx.lineTo(e.x + e.radius, e.y + e.radius);
        ctx.lineTo(e.x - e.radius, e.y + e.radius);
      } else if (e.type === 'tank') {
        ctx.rect(e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
      } else {
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      }
      ctx.fill();

      // Enemy health bar
      if (e.health < e.maxHealth) {
        ctx.fillStyle = '#333';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 4);
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, (e.health / e.maxHealth) * (e.radius * 2), 4);
      }
    });

    // Draw Player
    ctx.shadowColor = COLORS.player;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    // Fun shape for player
    const angle = Math.atan2(
      mouseRef.current.y - playerRef.current.y,
      mouseRef.current.x - playerRef.current.x
    );
    ctx.save();
    ctx.translate(playerRef.current.x, playerRef.current.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(playerRef.current.radius, 0);
    ctx.lineTo(-playerRef.current.radius, -playerRef.current.radius);
    ctx.lineTo(-playerRef.current.radius * 0.5, 0);
    ctx.lineTo(-playerRef.current.radius, playerRef.current.radius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;

    frameIdRef.current = requestAnimationFrame(update);
  }, [gameState.isGameOver, gameState.isPaused, gameState.level, gameState.fireRate, gameState.bulletSpeed, gameState.damage, gameStarted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (!gameStarted) {
        playerRef.current = { x: canvas.width / 2, y: canvas.height / 2, radius: 15 };
      }
    };

    window.addEventListener('resize', resize);
    resize();

    frameIdRef.current = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [update, gameStarted]);

  useEffect(() => {
    if (gameState.isGameOver && gameState.score > highScore) {
      setHighScore(gameState.score);
    }
  }, [gameState.isGameOver, gameState.score, highScore]);

  return (
    <div className="relative w-full h-full bg-[#0a0a0f] overflow-hidden font-sans">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
      />

      {/* HUD */}
      {gameStarted && !gameState.isGameOver && (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                {gameState.score.toLocaleString()}
              </div>
              <div className="text-xs font-bold text-white/50 uppercase tracking-widest">
                Current Level: {gameState.level}
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setGameState(p => ({ ...p, isPaused: !p.isPaused }))}
                className="pointer-events-auto p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors"
                id="pause-button"
              >
                {gameState.isPaused ? <Play size={20} /> : <Pause size={20} />}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between items-end">
                <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                  <Shield size={10} /> Hull Integrity
                </div>
                <div className="text-sm font-mono text-cyan-400">
                  {gameState.health}%
                </div>
              </div>
              <div className="h-2 w-full bg-cyan-900/30 rounded-full overflow-hidden border border-cyan-400/20">
                <motion.div 
                  className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                  initial={{ width: '100%' }}
                  animate={{ width: `${gameState.health}%` }}
                />
              </div>
            </div>

            <div className="flex gap-6">
              <Stat icon={<Target size={14} />} label="DMG" value={gameState.damage} color="text-red-400" />
              <Stat icon={<Zap size={14} />} label="RPM" value={Math.round(gameState.fireRate * 60)} color="text-yellow-400" />
            </div>
          </div>
        </div>
      )}

      {/* Start / Game Over Screen */}
      <AnimatePresence>
        {(!gameStarted || gameState.isGameOver) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/90 backdrop-blur-md z-50 p-6"
          >
            <div className="max-w-md w-full text-center space-y-12">
              <div className="space-y-4">
                <motion.h1 
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="text-8xl font-black text-white tracking-tighter leading-none"
                >
                  NEON<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">STRIKE</span>
                </motion.h1>
                <div className="text-white/40 uppercase tracking-[0.2em] text-xs font-bold">
                  High-Octane Arcade Survival
                </div>
              </div>

              {gameState.isGameOver && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6"
                >
                  <div className="space-y-1">
                    <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Final Score</div>
                    <div className="text-5xl font-black text-white tracking-tight">{gameState.score.toLocaleString()}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Level Reached</div>
                      <div className="text-2xl font-bold text-white">{gameState.level}</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">High Score</div>
                      <div className="text-2xl font-bold text-cyan-400">{highScore.toLocaleString()}</div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="space-y-6">
                <button
                  onClick={resetGame}
                  className="w-full py-6 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-3 group"
                  id="start-button"
                >
                  {gameState.isGameOver ? <RotateCcw className="group-hover:rotate-180 transition-transform duration-500" /> : <Play />}
                  {gameState.isGameOver ? 'Try Again' : 'Initiate Strike'}
                </button>
                
                <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                  <div className="flex items-center justify-center gap-2">
                    <kbd className="px-2 py-1 bg-white/10 rounded">WASD</kbd> Move
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <kbd className="px-2 py-1 bg-white/10 rounded">MOUSE</kbd> Aim/Auto
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Screen */}
      <AnimatePresence>
        {gameState.isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/60 backdrop-blur-sm z-40"
          >
            <div className="text-center space-y-8">
              <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic">Paused</h2>
              <button
                onClick={() => setGameState(p => ({ ...p, isPaused: false }))}
                className="px-12 py-4 rounded-full bg-cyan-500 text-white font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-transform"
                id="resume-button"
              >
                Resume
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest opacity-50 text-white mb-1`}>
        {icon} {label}
      </div>
      <div className={`text-xl font-bold font-mono ${color}`}>
        {value}
      </div>
    </div>
  );
}
