import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

// Interfaces
interface Position { x: number; y: number; }
interface Player { x: number; y: number; lives: number; speed: number; weapon: WeaponType; weaponAmmo: number; speedBoosts: number; nukes: number; }
interface Enemy { id: number; x: number; y: number; speed: number; health: number; maxHealth: number; type: EnemyType; size: number; }
interface Bullet { id: number; x: number; y: number; dx: number; dy: number; speed: number; damage: number; type: WeaponType; }
interface PowerUp { id: number; x: number; y: number; type: PowerUpType; duration?: number; }
interface Particle { id: number; x: number; y: number; dx: number; dy: number; size: number; life: number; color: string; }
interface MapExit { x: number; y: number; width: number; height: number; side: 'top' | 'bottom' | 'left' | 'right'; }
interface GameMap { id: number; bgColor: string; gridColor: string; decorations: { x: number; y: number; width: number; height: number; color: string }[]; }

// Types
type EnemyType = 'zombie' | 'hellhound' | 'crawler' | 'boss';
type WeaponType = 'pistol' | 'rifle' | 'shotgun' | 'grenade';
type PowerUpType = 'nuke' | 'speedboost' | 'weapon' | 'life' | 'treasure';

// Constantes
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_SIZE = 24;
const BULLET_SPEED = 12;
const PLAYER_BASE_SPEED = 4;

// Configurations
const MAPS: GameMap[] = [
  { id: 1, bgColor: '#1a1a1a', gridColor: '#333', decorations: [{ x: 100, y: 100, width: 50, height: 150, color: '#4a4a4a' }, { x: 650, y: 350, width: 50, height: 150, color: '#4a4a4a' }, { x: 300, y: 250, width: 200, height: 50, color: '#4a4a4a' }] },
  { id: 2, bgColor: '#2a0a0a', gridColor: '#442222', decorations: [{ x: 200, y: 200, width: 100, height: 100, color: '#5a3a3a' }, { x: 500, y: 300, width: 100, height: 100, color: '#5a3a3a' }] },
  { id: 3, bgColor: '#0a2a0a', gridColor: '#224422', decorations: [] },
  { id: 4, bgColor: '#0a0a2a', gridColor: '#222244', decorations: [{ x: 0, y: 275, width: GAME_WIDTH, height: 50, color: '#3a3a5a' }] },
  { id: 5, bgColor: '#2d0b45', gridColor: '#482264', decorations: [{ x: 150, y: 150, width: 100, height: 100, color: '#593a70' }, { x: 550, y: 150, width: 100, height: 100, color: '#593a3a70' }, { x: 150, y: 350, width: 100, height: 100, color: '#593a70' }, { x: 550, y: 350, width: 100, height: 100, color: '#593a70' }] },
];

const ENEMY_CONFIGS = {
  zombie: { size: 24, speed: 1.5, health: 1, sprite: '/assets/sprites/zombie.png' },
  hellhound: { size: 22, speed: 3, health: 2, sprite: '/assets/sprites/hellhound.png' },
  crawler: { size: 20, speed: 2.5, health: 1, sprite: '/assets/sprites/crawler.png' },
  boss: { size: 40, speed: 1, health: 10, sprite: '/assets/sprites/boss.png' }
};

const WEAPON_CONFIGS = {
  pistol: { damage: 1, fireRate: 200, ammo: Infinity, sound: 'pistol' },
  rifle: { damage: 2, fireRate: 100, ammo: 60, sound: 'rifle' },
  shotgun: { damage: 3, fireRate: 400, ammo: 20, sound: 'shotgun' },
  grenade: { damage: 5, fireRate: 800, ammo: 10, sound: 'grenade' }
};

export default function ZombieGame({ onGameOver }: { onGameOver: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<Position>({ x: 0, y: 0 });
  const mouseDownRef = useRef<boolean>(false);
  const lastShotRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext>();
  const [spriteImages, setSpriteImages] = useState<Record<string, HTMLImageElement>>({});

  const [player, setPlayer] = useState<Player>({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, lives: 3, speed: PLAYER_BASE_SPEED, weapon: 'pistol', weaponAmmo: Infinity, speedBoosts: 2, nukes: 1 });
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [roundComplete, setRoundComplete] = useState(false);
  const [showExits, setShowExits] = useState(false);
  const [enemiesKilled, setEnemiesKilled] = useState(0);
  const [roundEnemyTarget, setRoundEnemyTarget] = useState(0);
  const [currentMap, setCurrentMap] = useState<GameMap>(MAPS[0]);
  const [screenShake, setScreenShake] = useState(0);

  const bulletIdRef = useRef(0);
  const enemyIdRef = useRef(0);
  const powerUpIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const playerDamagedThisFrame = useRef(false);

  useEffect(() => { playerDamagedThisFrame.current = false; });

  useEffect(() => {
    const images: Record<string, HTMLImageElement> = {};
    const playerImg = new Image();
    playerImg.src = '/assets/sprites/player.png';
    images.player = playerImg;

    Object.values(ENEMY_CONFIGS).forEach(config => {
      const img = new Image();
      img.src = config.sprite;
      images[config.sprite] = img;
    });

    setSpriteImages(images);
  }, []);

  const playSound = useCallback((type: string, volume = 0.1, duration = 0.3) => {
    if (typeof window.AudioContext === 'undefined') return;
    if (!audioContextRef.current) { audioContextRef.current = new window.AudioContext(); }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    switch (type) {
      case 'pistol': oscillator.frequency.setValueAtTime(800, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1); break;
      case 'rifle': oscillator.frequency.setValueAtTime(1200, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05); break;
      case 'shotgun': oscillator.frequency.setValueAtTime(600, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2); break;
      case 'explosion': gainNode.gain.setValueAtTime(0.4, ctx.currentTime); oscillator.type = 'noise'; oscillator.frequency.setValueAtTime(1000, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(1, ctx.currentTime + 0.4); setScreenShake(15); break;
      case 'powerup': oscillator.frequency.setValueAtTime(440, ctx.currentTime); oscillator.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.2); break;
      case 'hurt': gainNode.gain.setValueAtTime(0.3, ctx.currentTime); oscillator.frequency.setValueAtTime(200, ctx.currentTime); oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3); break;
    }

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      newParticles.push({ id: particleIdRef.current++, x, y, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, size: Math.random() * 2 + 1, life: 20 + Math.random() * 10, color });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  const spawnEnemiesForRound = useCallback(() => {
    const enemyCount = Math.floor(5 * Math.pow(1.15, round - 1));
    const newEnemies: Enemy[] = [];
    for (let i = 0; i < enemyCount; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      switch (side) {
        case 0: x = Math.random() * GAME_WIDTH; y = -30; break;
        case 1: x = GAME_WIDTH + 30; y = Math.random() * GAME_HEIGHT; break;
        case 2: x = Math.random() * GAME_WIDTH; y = GAME_HEIGHT + 30; break;
        default: x = -30; y = Math.random() * GAME_HEIGHT; break;
      }
      let type: EnemyType = 'zombie';
      if (round > 3 && Math.random() < 0.2) type = 'hellhound';
      if (round > 5 && Math.random() < 0.1) type = 'crawler';
      if (round > 0 && round % 10 === 0 && i === 0) type = 'boss';
      const config = ENEMY_CONFIGS[type];
      newEnemies.push({ id: enemyIdRef.current++, x, y, speed: config.speed * (0.8 + Math.random() * 0.4), health: config.health + Math.floor(round / 3), maxHealth: config.health + Math.floor(round / 3), type, size: config.size });
    }
    setEnemies(newEnemies);
    setRoundEnemyTarget(newEnemies.length);
    setEnemiesKilled(0);
    setRoundComplete(false);
    setShowExits(false);
  }, [round]);

  const shoot = useCallback(() => {
    if (gameOver || isPaused || !mouseDownRef.current) return;
    const now = Date.now();
    const weapon = WEAPON_CONFIGS[player.weapon];
    if (now - lastShotRef.current < weapon.fireRate) return;
    if (player.weaponAmmo <= 0 && player.weapon !== 'pistol') { setPlayer(prev => ({ ...prev, weapon: 'pistol', weaponAmmo: Infinity })); return; }
    lastShotRef.current = now;
    const dx = mouseRef.current.x - player.x;
    const dy = mouseRef.current.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0) {
      const bulletsToSpawn = player.weapon === 'shotgun' ? 5 : 1;
      for (let i = 0; i < bulletsToSpawn; i++) {
        const spread = player.weapon === 'shotgun' ? (Math.random() - 0.5) * 0.5 : 0;
        const angle = Math.atan2(dy, dx) + spread;
        setBullets(prev => [...prev, { id: bulletIdRef.current++, x: player.x, y: player.y, dx: Math.cos(angle) * BULLET_SPEED, dy: Math.sin(angle) * BULLET_SPEED, speed: BULLET_SPEED, damage: weapon.damage, type: player.weapon }]);
      }
      if (player.weapon !== 'pistol') { setPlayer(prev => ({ ...prev, weaponAmmo: prev.weaponAmmo - 1 })); }
      playSound(weapon.sound);
    }
  }, [gameOver, isPaused, player, playSound]);

  const gameLoop = useCallback(() => {
    if (gameOver || isPaused) return;
    shoot();
    if (screenShake > 0) { setScreenShake(prev => prev * 0.9); }
    setParticles(prev => prev.map(p => ({ ...p, x: p.x + p.dx, y: p.y + p.dy, life: p.life - 1 })).filter(p => p.life > 0));
    setPlayer(prev => {
      let newX = prev.x, newY = prev.y;
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) { newX = Math.max(PLAYER_SIZE / 2, prev.x - prev.speed); }
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) { newX = Math.min(GAME_WIDTH - PLAYER_SIZE / 2, prev.x + prev.speed); }
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) { newY = Math.max(PLAYER_SIZE / 2, prev.y - prev.speed); }
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) { newY = Math.min(GAME_HEIGHT - PLAYER_SIZE / 2, prev.y + prev.speed); }
      currentMap.decorations.forEach(deco => {
        if (newX > deco.x - PLAYER_SIZE / 2 && newX < deco.x + deco.width + PLAYER_SIZE / 2 && prev.y > deco.y - PLAYER_SIZE / 2 && prev.y < deco.y + deco.height + PLAYER_SIZE / 2) { if (newX > prev.x) { newX = deco.x - PLAYER_SIZE / 2; } else { newX = deco.x + deco.width + PLAYER_SIZE / 2; } }
        if (newY > deco.y - PLAYER_SIZE / 2 && newY < deco.y + deco.height + PLAYER_SIZE / 2 && prev.x > deco.x - PLAYER_SIZE / 2 && prev.x < deco.x + deco.width + PLAYER_SIZE / 2) { if (newY > prev.y) { newY = deco.y - PLAYER_SIZE / 2; } else { newY = deco.y + deco.height + PLAYER_SIZE / 2; } }
      });
      return { ...prev, x: newX, y: newY };
    });
    setBullets(prev => prev.map(bullet => ({ ...bullet, x: bullet.x + bullet.dx, y: bullet.y + bullet.dy })).filter(bullet => bullet.x > -10 && bullet.x < GAME_WIDTH + 10 && bullet.y > -10 && bullet.y < GAME_HEIGHT + 10));
    setEnemies(prev => prev.map(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 0) { return { ...enemy, x: enemy.x + (dx / distance) * enemy.speed, y: enemy.y + (dy / distance) * enemy.speed }; }
      return enemy;
    }));
    setBullets(prevBullets => {
      let newBullets = [...prevBullets];
      setEnemies(prevEnemies => {
        let newEnemies = [...prevEnemies];
        newBullets.forEach(bullet => {
          newEnemies.forEach((enemy, enemyIndex) => {
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < enemy.size / 2 + 5) {
              newEnemies[enemyIndex] = { ...enemy, health: enemy.health - bullet.damage };
              spawnParticles(bullet.x, bullet.y, 3, '#ffcc00');
              newBullets = newBullets.filter(b => b.id !== bullet.id);
              if (newEnemies[enemyIndex].health <= 0) {
                const killedEnemy = newEnemies[enemyIndex];
                setScore(prev => prev + (killedEnemy.type === 'boss' ? 500 : 100));
                setEnemiesKilled(prev => prev + 1);
                if (Math.random() < 0.15) {
                  const types: PowerUpType[] = ['nuke', 'speedboost', 'weapon', 'life', 'treasure'];
                  const type = types[Math.floor(Math.random() * types.length)];
                  setPowerUps(prev => [...prev, { id: powerUpIdRef.current++, x: killedEnemy.x, y: killedEnemy.y, type }]);
                }
                spawnParticles(killedEnemy.x, killedEnemy.y, 15, ENEMY_CONFIGS[killedEnemy.type].color);
                newEnemies = newEnemies.filter(e => e.id !== enemy.id);
              }
            }
          });
        });
        return newEnemies;
      });
      return newBullets;
    });
    if (!playerDamagedThisFrame.current) {
      let playerTookDamage = false;
      enemies.forEach(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < enemy.size / 2 + PLAYER_SIZE / 2) {
          playerTookDamage = true;
          spawnParticles(player.x, player.y, 10, '#22c55e');
        }
      });
      if (playerTookDamage) {
        playerDamagedThisFrame.current = true;
        setPlayer(prev => {
          const newLives = prev.lives - 1;
          if (newLives <= 0) { setGameOver(true); }
          playSound('hurt', 0.4);
          return { ...prev, lives: newLives };
        });
      }
    }
    setPowerUps(prevPowerUps => {
      return prevPowerUps.filter(powerUp => {
        const dx = powerUp.x - player.x;
        const dy = powerUp.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 25) {
          playSound('powerup', 0.2);
          switch (powerUp.type) {
            case 'nuke': setPlayer(prev => ({ ...prev, nukes: prev.nukes + 1 })); break;
            case 'speedboost': setPlayer(prev => ({ ...prev, speedBoosts: prev.speedBoosts + 1 })); break;
            case 'weapon': {
              const weapons: WeaponType[] = ['rifle', 'shotgun', 'grenade'];
              const newWeapon = weapons[Math.floor(Math.random() * weapons.length)];
              setPlayer(prev => ({ ...prev, weapon: newWeapon, weaponAmmo: WEAPON_CONFIGS[newWeapon].ammo }));
              break;
            }
            case 'life': setPlayer(prev => ({ ...prev, lives: Math.min(prev.lives + 1, 9) })); break;
            case 'treasure': setScore(prev => prev + 1000); break;
          }
          return false;
        }
        return true;
      });
    });
    if (enemies.length === 0 && enemiesKilled >= roundEnemyTarget && !roundComplete) {
      setRoundComplete(true);
      if (round % 5 === 0) { setShowExits(true); }
      else { setTimeout(() => { setRound(prev => prev + 1); spawnEnemiesForRound(); }, 3000); }
    }
    if (showExits) {
      const exitSize = 60;
      const exits: MapExit[] = [
        { x: GAME_WIDTH / 2 - exitSize / 2, y: 0, width: exitSize, height: exitSize / 2, side: 'top' },
        { x: GAME_WIDTH / 2 - exitSize / 2, y: GAME_HEIGHT - exitSize / 2, width: exitSize, height: exitSize / 2, side: 'bottom' },
        { x: 0, y: GAME_HEIGHT / 2 - exitSize / 2, width: exitSize / 2, height: exitSize, side: 'left' },
        { x: GAME_WIDTH - exitSize / 2, y: GAME_HEIGHT / 2 - exitSize / 2, width: exitSize / 2, height: exitSize, side: 'right' },
      ];
      exits.forEach(exit => {
        if (player.x > exit.x && player.x < exit.x + exit.width && player.y > exit.y && player.y < exit.y + exit.height) {
          const newMapIndex = Math.floor(Math.random() * MAPS.length);
          setCurrentMap(MAPS[newMapIndex]);
          setPlayer(prev => {
            const newPlayerPos = { ...prev };
            switch (exit.side) {
              case 'top': newPlayerPos.y = GAME_HEIGHT - PLAYER_SIZE; break;
              case 'bottom': newPlayerPos.y = PLAYER_SIZE; break;
              case 'left': newPlayerPos.x = GAME_WIDTH - PLAYER_SIZE; break;
              case 'right': newPlayerPos.x = PLAYER_SIZE; break;
            }
            return newPlayerPos;
          });
          setRound(prev => prev + 1);
          spawnEnemiesForRound();
        }
      });
    }
  }, [gameOver, isPaused, player, enemies, enemiesKilled, roundEnemyTarget, roundComplete, spawnEnemiesForRound, shoot, playSound, currentMap.decorations, screenShake, round, spawnParticles]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    if (screenShake > 0) {
      const dx = (Math.random() - 0.5) * screenShake;
      const dy = (Math.random() - 0.5) * screenShake;
      ctx.translate(dx, dy);
    }
    ctx.fillStyle = currentMap.bgColor;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.strokeStyle = currentMap.gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < GAME_WIDTH; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); ctx.stroke(); }
    for (let i = 0; i < GAME_HEIGHT; i += 50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); ctx.stroke(); }
    currentMap.decorations.forEach(deco => { ctx.fillStyle = deco.color; ctx.fillRect(deco.x, deco.y, deco.width, deco.height); });
    if (spriteImages.player) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x) + Math.PI / 2);
      ctx.drawImage(spriteImages.player, -PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      ctx.restore();
    }
    enemies.forEach(enemy => {
      const config = ENEMY_CONFIGS[enemy.type];
      if (spriteImages[config.sprite]) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI / 2);
        ctx.drawImage(spriteImages[config.sprite], -enemy.size / 2, -enemy.size / 2, enemy.size, enemy.size);
        ctx.restore();
      }
      if (enemy.health < enemy.maxHealth) {
        const barWidth = enemy.size;
        const barHeight = 4;
        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.size / 2 - 8, barWidth, barHeight);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.size / 2 - 8, barWidth * healthPercent, barHeight);
      }
    });
    bullets.forEach(bullet => {
      ctx.fillStyle = bullet.type === 'grenade' ? '#ff6b35' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.type === 'grenade' ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    powerUps.forEach(powerUp => {
      const colors = { nuke: '#ff0000', speedboost: '#00ff00', weapon: '#0000ff', life: '#ff69b4', treasure: '#ffd700' };
      ctx.fillStyle = colors[powerUp.type];
      ctx.beginPath();
      ctx.arc(powerUp.x, powerUp.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      const icons = { nuke: '💥', speedboost: '⚡', weapon: '🔫', life: '💗', treasure: '💎' };
      ctx.fillText(icons[powerUp.type], powerUp.x, powerUp.y + 4);
    });
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    if (roundComplete) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`ROUND ${round} COMPLETE!`, GAME_WIDTH / 2, GAME_HEIGHT / 2);
      ctx.font = '24px Arial';
      ctx.fillText(`Next round starting...`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
    }
    if (showExits) {
      ctx.fillStyle = '#fde047';
      const exitSize = 60;
      ctx.fillRect(GAME_WIDTH / 2 - exitSize / 2, 0, exitSize, exitSize / 2);
      ctx.fillRect(GAME_WIDTH / 2 - exitSize / 2, GAME_HEIGHT - exitSize / 2, exitSize, exitSize / 2);
      ctx.fillRect(0, GAME_HEIGHT / 2 - exitSize / 2, exitSize / 2, exitSize);
      ctx.fillRect(GAME_WIDTH - exitSize / 2, GAME_HEIGHT / 2 - exitSize / 2, exitSize / 2, exitSize);
      ctx.fillStyle = '#000';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('CHOOSE AN EXIT', GAME_WIDTH / 2, GAME_HEIGHT / 2);
    }
    if (isPaused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', GAME_WIDTH / 2, GAME_HEIGHT / 2);
      ctx.font = '24px Arial';
      ctx.fillText('Press SPACE to continue', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
    }
    ctx.restore();
  }, [player, enemies, bullets, powerUps, particles, round, roundComplete, isPaused, currentMap, showExits, screenShake, spriteImages]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysRef.current.add(e.key.toLowerCase());
    if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); setIsPaused(prev => !prev); }
    if (e.key.toLowerCase() === 'n' && player.nukes > 0) { setPlayer(prev => ({ ...prev, nukes: prev.nukes - 1 })); setEnemies([]); playSound('explosion', 0.5, 0.5); setScore(prev => prev + enemies.length * 50); setEnemiesKilled(prev => prev + enemies.length); }
    if (e.key.toLowerCase() === 'b' && player.speedBoosts > 0) { setPlayer(prev => ({ ...prev, speedBoosts: prev.speedBoosts - 1, speed: PLAYER_BASE_SPEED * 1.5 })); setTimeout(() => { setPlayer(prev => ({ ...prev, speed: PLAYER_BASE_SPEED })); }, 5000); }
  }, [player.nukes, player.speedBoosts, enemies.length, playSound]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }; }, []);
  const handleMouseDown = useCallback((e: MouseEvent) => { if (e.button === 0) { mouseDownRef.current = true; } }, []);
  const handleMouseUp = useCallback((e: MouseEvent) => { if (e.button === 0) { mouseDownRef.current = false; } }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseMove, handleMouseDown, handleMouseUp]);

  useEffect(() => { if (round === 1 && enemies.length === 0) { spawnEnemiesForRound(); } }, [round, enemies.length, spawnEnemiesForRound]);

  useEffect(() => {
    const loop = () => { gameLoop(); render(); gameLoopRef.current = requestAnimationFrame(loop); };
    gameLoopRef.current = requestAnimationFrame(loop);
    return () => { if (gameLoopRef.current) { cancelAnimationFrame(gameLoopRef.current); } };
  }, [gameLoop, render]);

  useEffect(() => { if (gameOver) { setTimeout(() => { onGameOver(); }, 3000); } }, [gameOver, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black">
      <audio ref={audio => { if(audio) audio.volume = 0.1; }} src="https://vgmsite.com/soundtracks/doom-2016/xbrokclw/1-01.%20I.%20Dogma.mp3" autoPlay loop />
      <div className="flex gap-2 mb-4 flex-wrap justify-center">
        <Card className="bg-black/50 border-green-500/50"><CardContent className="p-3"><div className="text-green-400 font-bold text-sm">Score: {score}</div></CardContent></Card>
        <Card className="bg-black/50 border-purple-500/50"><CardContent className="p-3"><div className="text-purple-400 font-bold text-sm">Round: {round}</div></CardContent></Card>
        <Card className="bg-black/50 border-red-500/50"><CardContent className="p-3"><div className="text-red-400 font-bold text-sm">Lives: {player.lives}</div></CardContent></Card>
        <Card className="bg-black/50 border-blue-500/50"><CardContent className="p-3"><div className="text-blue-400 font-bold text-sm">Weapon: {player.weapon.toUpperCase()} {player.weaponAmmo !== Infinity && ` (${player.weaponAmmo})`}</div></CardContent></Card>
      </div>
      <div className="flex gap-2 mb-4">
        <Card className="bg-black/50 border-yellow-500/50"><CardContent className="p-2"><div className="text-yellow-400 font-bold text-sm">💥 Nukes: {player.nukes} (Press N)</div></CardContent></Card>
        <Card className="bg-black/50 border-cyan-500/50"><CardContent className="p-2"><div className="text-cyan-400 font-bold text-sm">⚡ Speed: {player.speedBoosts} (Press B)</div></CardContent></Card>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="border-2 border-gray-700 bg-gray-900 cursor-crosshair" style={{ imageRendering: 'pixelated', transition: 'transform 0.1s' }} />
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <Card className="bg-black/50 border-red-500/50">
              <CardContent className="p-6 text-center">
                <h2 className="text-3xl font-bold text-red-400 mb-4">GAME OVER</h2>
                <p className="text-xl text-white mb-2">Final Score: {score}</p>
                <p className="text-lg text-gray-300 mb-4">Round Reached: {round}</p>
                <p className="text-sm text-gray-400">Returning to menu...</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <div className="mt-4 text-center">
        <div className="text-sm text-gray-400 mb-2">WASD: Move | Mouse: Aim & Hold to Shoot | N: Nuke | B: Speed Boost | SPACE: Pause</div>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => setIsPaused(!isPaused)} className="bg-yellow-600 hover:bg-yellow-700">{isPaused ? 'Resume' : 'Pause'}</Button>
          <Button onClick={onGameOver} variant="outline" className="border-gray-600 text-gray-300">Main Menu</Button>
        </div>
      </div>
    </div>
  );
}