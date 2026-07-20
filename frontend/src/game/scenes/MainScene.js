import Phaser from "phaser";

const REQUIRED_ASSETS = {
  "tile-ground": "/assets/tile-ground.png",
  "character-nexus": "/assets/character-nexus.png",
  "character-cypher": "/assets/character-cypher.png",
  "character-helix": "/assets/character-helix.png",
  "npc-marker": "/assets/npc-marker.png",
};

const OPTIONAL_ASSETS = {
  "map-background": "/assets/map-background.jpg",
  "decor-1": "/assets/decor-1.png",
  "decor-2": "/assets/decor-2.png",
  "decor-3": "/assets/decor-3.png",
  "npc-marker-1": "/assets/npc-marker-1.png",
  "npc-marker-2": "/assets/npc-marker-2.png",
  "npc-marker-3": "/assets/npc-marker-3.png",
  "enemy-icon": "/assets/enemy-icon.png",
};

const TILE_SIZE = 64;
const SPRITE_SIZE = 32;
const MARKER_SIZE = 56;
const ENEMY_ICON_SIZE = 16;
const MAP_W = 1600;
const MAP_H = 1200;
const SPAWN = { x: 400, y: 300 };

const LEVEL_COLORS = {
  1: 0x049cd8,
  2: 0xfbd000,
  3: 0xe52521,
};

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.otherPlayers = new Map();
    this.npcZones = [];
    this.missingAssetKeys = new Set();
  }

  init({ socket, roomCode, player, initialRoster, currentLevel, onNearNpc, spectator }) {
    this.socket = socket;
    this.roomCode = roomCode;
    this.playerMeta = player || {};
    this.initialRoster = initialRoster || [];
    this.currentLevel = currentLevel || 1;
    this.onNearNpc = onNearNpc;
    // MODE SPECTATOR (admin): tidak ada avatar sendiri — SEMUA pemain
    // dirender sebagai "other", kamera bebas digeser (drag / WASD), dan
    // tidak pernah emit player_move ke server.
    this.isSpectator = !!spectator;
    this.currentNpc = null;
    this.mustExitZone = false;
  }

  setCurrentLevel(level) {
    this.currentLevel = level;
    this.currentNpc = null;
    this.mustExitZone = true;
    this.applyZoneDimming();
  }

  applyZoneDimming() {
    (this.npcZones || []).forEach((nz) => {
      // Spectator melihat semua zona level sama terang — dia bukan pemain
      // yang sedang "berada" di satu level tertentu.
      nz.marker?.setAlpha(this.isSpectator || nz.level === this.currentLevel ? 1 : 0.35);
    });
  }

  preload() {
    Object.entries(REQUIRED_ASSETS).forEach(([key, path]) => this.load.image(key, path));
    Object.entries(OPTIONAL_ASSETS).forEach(([key, path]) => this.load.image(key, path));

    this.load.on("loaderror", (file) => {
      console.warn(`[SHIELD] Asset tidak ditemukan: "${file.key}" (${file.src}).`);
      this.missingAssetKeys.add(file.key);
    });
  }

  createPlaceholderTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const ensure = (key, draw, size) => {
      if (this.textures.exists(key) && !this.missingAssetKeys.has(key)) return;
      if (this.textures.exists(key)) this.textures.remove(key);
      draw(g);
      g.generateTexture(key, size, size);
      g.clear();
    };

    ensure(
      "tile-ground",
      (gg) => {
        gg.fillStyle(0x141c24, 1);
        gg.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        gg.lineStyle(1, 0x263340, 1);
        gg.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
      },
      TILE_SIZE
    );

    ensure(
      "character-nexus",
      (gg) => {
        gg.fillStyle(0x049cd8, 1);
        gg.fillCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      },
      SPRITE_SIZE
    );

    ensure(
      "character-cypher",
      (gg) => {
        gg.fillStyle(0x43b047, 1);
        gg.fillCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      },
      SPRITE_SIZE
    );

    ensure(
      "character-helix",
      (gg) => {
        gg.fillStyle(0xe52521, 1);
        gg.fillCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      },
      SPRITE_SIZE
    );

    ensure(
      "npc-marker",
      (gg) => {
        gg.fillStyle(0xe52521, 1);
        gg.fillTriangle(MARKER_SIZE / 2, 0, MARKER_SIZE, MARKER_SIZE, 0, MARKER_SIZE);
      },
      MARKER_SIZE
    );

    ensure(
      "enemy-icon",
      (gg) => {
        gg.fillStyle(0x8a2e2e, 1);
        gg.fillRect(0, 0, ENEMY_ICON_SIZE, ENEMY_ICON_SIZE);
      },
      ENEMY_ICON_SIZE
    );

    ensure(
      "smoke-puff",
      (gg) => {
        gg.fillStyle(0xaab0ad, 0.35);
        gg.fillCircle(32, 32, 32);
      },
      64
    );

    g.destroy();
  }

  availableKeys(keys) {
    return keys.filter((k) => this.textures.exists(k) && !this.missingAssetKeys.has(k));
  }

  characterTextureFor(character) {
    if (character === "cypher") return "character-cypher";
    if (character === "helix") return "character-helix";
    return "character-nexus";
  }

  markerTextureFor(level) {
    const perLevelKey = `npc-marker-${level}`;
    return this.availableKeys([perLevelKey])[0] || "npc-marker";
  }

  makeRng(seed) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  buildPathCells(npcPositions) {
    const pathCells = new Set();
    const widen = [-TILE_SIZE / 2, 0, TILE_SIZE / 2];

    const markLine = (a, b) => {
      const steps = Math.ceil(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / (TILE_SIZE / 2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = Phaser.Math.Linear(a.x, b.x, t);
        const py = Phaser.Math.Linear(a.y, b.y, t);
        widen.forEach((wx) => {
          widen.forEach((wy) => {
            const cx = Math.floor((px + wx) / TILE_SIZE);
            const cy = Math.floor((py + wy) / TILE_SIZE);
            pathCells.add(`${cx},${cy}`);
          });
        });
      }
    };

    npcPositions.forEach((nz) => markLine(SPAWN, nz));
    return pathCells;
  }

  buildGround(npcPositions) {
    const bgKey = this.availableKeys(["map-background"])[0];
    if (bgKey) {
      this.buildSingleImageBackground(bgKey, npcPositions);
      return;
    }
    this.buildTileMosaicGround(npcPositions);
  }

  buildSingleImageBackground(bgKey, npcPositions) {
    this.add
      .image(MAP_W / 2, MAP_H / 2, bgKey)
      .setDisplaySize(MAP_W, MAP_H)
      .setDepth(0);

    const pathKey = this.availableKeys(["tile-path"])[0];
    if (!pathKey) return;

    const pathCells = this.buildPathCells(npcPositions);
    pathCells.forEach((cellKey) => {
      const [cx, cy] = cellKey.split(",").map(Number);
      this.add
        .image(cx * TILE_SIZE + TILE_SIZE / 2, cy * TILE_SIZE + TILE_SIZE / 2, pathKey)
        .setDisplaySize(TILE_SIZE, TILE_SIZE)
        .setAlpha(0.85)
        .setDepth(1);
    });
  }

  buildTileMosaicGround(npcPositions) {
    const groundKeys = ["tile-ground", ...this.availableKeys(["tile-ground-2", "tile-ground-3"])];
    const pathKey = this.availableKeys(["tile-path"])[0] || null;
    const decorKeys = this.availableKeys(["decor-1", "decor-2", "decor-3"]);
    const pathCells = this.buildPathCells(npcPositions);
    const rng = this.makeRng(1337);

    for (let x = 0; x < MAP_W; x += TILE_SIZE) {
      for (let y = 0; y < MAP_H; y += TILE_SIZE) {
        const cellKey = `${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`;
        const isPath = pathCells.has(cellKey);
        const cx = x + TILE_SIZE / 2;
        const cy = y + TILE_SIZE / 2;

        const textureKey = isPath && pathKey ? pathKey : Phaser.Utils.Array.GetRandom(groundKeys);
        const tile = this.add.image(cx, cy, textureKey).setDisplaySize(TILE_SIZE, TILE_SIZE);

        if (!isPath) {
          const r = rng();
          tile.setFlipX(r > 0.5);
          tile.setAngle(Math.floor(rng() * 4) * 90);
          const shade = 235 + Math.floor(rng() * 20);
          tile.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
        }

        if (!isPath && decorKeys.length && rng() < 0.035) {
          const nearAnchor = [SPAWN, ...npcPositions].some(
            (p) => Phaser.Math.Distance.Between(cx, cy, p.x, p.y) < 110
          );
          if (!nearAnchor) {
            this.add
              .image(cx, cy - 6, Phaser.Utils.Array.GetRandom(decorKeys))
              .setDisplaySize(SPRITE_SIZE, SPRITE_SIZE)
              .setDepth(1);
          }
        }
      }
    }
  }

  buildLevelZoneDecoration(pos) {
    const color = LEVEL_COLORS[pos.level] ?? 0xe0793c;
    this.add.circle(pos.x, pos.y, 85, color, 0.12).setDepth(0);
    this.add.circle(pos.x, pos.y, 85, color, 0.5).setStrokeStyle(2, color, 0.6).setDepth(0);

    const enemyKey = this.availableKeys(["enemy-icon"])[0] || "enemy-icon";
    const count = pos.opponents;
    const spacing = 14;
    const startX = pos.x - ((count - 1) * spacing) / 2;
    const clusterY = pos.y + MARKER_SIZE / 2 + 14;
    for (let i = 0; i < count; i++) {
      this.add
        .image(startX + i * spacing, clusterY, enemyKey)
        .setDisplaySize(ENEMY_ICON_SIZE, ENEMY_ICON_SIZE)
        .setDepth(3);
    }
    this.add
      .text(pos.x, clusterY + 12, `1 vs ${count}`, { fontSize: "11px", color: "#EDE6D6" })
      .setOrigin(0.5)
      .setDepth(3);
  }

  buildSmokeEffect() {
    const smokeKey = this.textures.exists("smoke-puff") ? "smoke-puff" : null;
    if (!smokeKey) return;

    this.add.particles(0, 0, smokeKey, {
      x: { min: 0, max: MAP_W },
      y: { min: 0, max: MAP_H },
      lifespan: 9000,
      speed: { min: 5, max: 18 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 1.6 },
      alpha: { start: 0.18, end: 0 },
      frequency: 1600,
      depth: 2,
    });
  }

  createNameTag(x, y, name) {
    return this.add
      .text(x, y - 24, name, { fontSize: "14px", color: "#EDE6D6" })
      .setOrigin(0.5)
      .setDepth(6);
  }

  create() {
    this.createPlaceholderTextures();

    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);

    const npcPositions = [
      { x: 500, y: 400, level: 1, label: "Level 1", opponents: 1 },
      { x: 900, y: 700, level: 2, label: "Level 2", opponents: 3 },
      { x: 1300, y: 300, level: 3, label: "Level 3", opponents: 5 },
    ];

    this.buildGround(npcPositions);
    npcPositions.forEach((pos) => this.buildLevelZoneDecoration(pos));
    this.buildSmokeEffect();

    if (this.isSpectator) {
      this.createSpectator(npcPositions);
      return;
    }

    const myId = this.socket.id;
    const mySpawn = this.initialRoster.find((p) => p.id === myId);
    const startX = mySpawn?.x ?? SPAWN.x;
    const startY = mySpawn?.y ?? SPAWN.y;

    this.self = this.physics.add
      .sprite(startX, startY, this.characterTextureFor(this.playerMeta.character))
      .setDisplaySize(SPRITE_SIZE, SPRITE_SIZE)
      .setDepth(5);
    this.self.setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.self, true, 0.1, 0.1);

    this.nameTag = this.createNameTag(startX, startY, this.playerMeta.name);

    this.initialRoster
      .filter((p) => p.id !== myId)
      .forEach((p) => this.getOrCreateOther(p.id, p.x, p.y, p.character, p.name));

    this.npcZones = npcPositions.map((pos) => {
      const marker = this.add
        .image(pos.x, pos.y, this.markerTextureFor(pos.level))
        .setDisplaySize(MARKER_SIZE, MARKER_SIZE)
        .setDepth(4);
      const zone = this.add.zone(pos.x, pos.y, 110, 110);
      this.physics.add.existing(zone, true);
      this.add
        .text(pos.x, pos.y - MARKER_SIZE / 2 - 14, pos.label, { fontSize: "13px", color: "#FBD000" })
        .setOrigin(0.5)
        .setDepth(4);
      return { ...pos, marker, zone };
    });

    this.npcZones.forEach((nz) => {
      this.physics.add.overlap(this.self, nz.zone, () => {
        if (nz.level !== this.currentLevel) return;
        if (this.mustExitZone) return;
        if (this.currentNpc !== nz.level) {
          this.currentNpc = nz.level;
          this.onNearNpc(nz.level);
        }
      });
    });

    this.applyZoneDimming();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");
    this.lastSent = 0;
    this.lastSentPos = { x: startX, y: startY };

    this.setupJoystick();
    this.setupResponsiveZoom();

    this.onPlayerMoved = ({ id, x, y }) => {
      const entry = this.getOrCreateOther(id, x, y);
      entry.target = { x, y };
    };
    this.socket.on("player_moved", this.onPlayerMoved);

    this.onPlayerProgress = ({ id, disconnected }) => {
      if (!disconnected) return;
      const entry = this.otherPlayers.get(id);
      if (entry) {
        entry.sprite.destroy();
        entry.nameTag.destroy();
        this.otherPlayers.delete(id);
      }
    };
    this.socket.on("player_progress", this.onPlayerProgress);

    this.onPlayerRebound = ({ oldId, id, name, character, x, y }) => {
      const old = this.otherPlayers.get(oldId);
      if (old) {
        this.otherPlayers.delete(oldId);
        this.otherPlayers.set(id, old);
        old.target = { x, y };
      } else if (id !== this.socket.id) {
        this.getOrCreateOther(id, x, y, character, name);
      }
    };
    this.socket.on("player_rebound", this.onPlayerRebound);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.socket.off("player_moved", this.onPlayerMoved);
      this.socket.off("player_progress", this.onPlayerProgress);
      this.socket.off("player_rebound", this.onPlayerRebound);
    });
  }

  /** Setup khusus mode spectator (admin): render semua pemain sebagai
   * sprite "other" yang mengikuti broadcast player_moved, marker level
   * tetap tampil, kamera bebas (drag mouse/jari atau WASD/panah), dan
   * tidak ada satupun emit ke server dari scene ini. */
  createSpectator(npcPositions) {
    // Marker + label level tetap digambar supaya petanya sama persis
    // dengan yang dilihat pemain.
    this.npcZones = npcPositions.map((pos) => {
      const marker = this.add
        .image(pos.x, pos.y, this.markerTextureFor(pos.level))
        .setDisplaySize(MARKER_SIZE, MARKER_SIZE)
        .setDepth(4);
      this.add
        .text(pos.x, pos.y - MARKER_SIZE / 2 - 14, pos.label, { fontSize: "13px", color: "#FBD000" })
        .setOrigin(0.5)
        .setDepth(4);
      return { ...pos, marker };
    });
    this.applyZoneDimming();

    // SEMUA pemain di roster dirender sebagai "other player".
    this.initialRoster.forEach((p) =>
      this.getOrCreateOther(p.id, p.x, p.y, p.character, p.name)
    );

    this.onPlayerMoved = ({ id, x, y }) => {
      const entry = this.getOrCreateOther(id, x, y);
      entry.target = { x, y };
    };
    this.socket.on("player_moved", this.onPlayerMoved);

    this.onPlayerProgress = ({ id, disconnected }) => {
      if (!disconnected) return;
      const entry = this.otherPlayers.get(id);
      if (entry) {
        entry.sprite.destroy();
        entry.nameTag.destroy();
        this.otherPlayers.delete(id);
      }
    };
    this.socket.on("player_progress", this.onPlayerProgress);

    this.onPlayerRebound = ({ oldId, id, name, character, x, y }) => {
      const old = this.otherPlayers.get(oldId);
      if (old) {
        this.otherPlayers.delete(oldId);
        this.otherPlayers.set(id, old);
        old.target = { x, y };
      } else {
        this.getOrCreateOther(id, x, y, character, name);
      }
    };
    this.socket.on("player_rebound", this.onPlayerRebound);

    // Kamera mulai di titik spawn, bisa digeser dengan drag (mouse/jari)
    // atau WASD/panah.
    this.cameras.main.centerOn(SPAWN.x, SPAWN.y);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    this.input.on("pointermove", (pointer) => {
      if (!pointer.isDown) return;
      const cam = this.cameras.main;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    });

    this.setupResponsiveZoom();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.socket.off("player_moved", this.onPlayerMoved);
      this.socket.off("player_progress", this.onPlayerProgress);
      this.socket.off("player_rebound", this.onPlayerRebound);
    });
  }

  setupResponsiveZoom() {
    const TARGET_VIEW_W = 800;
    const applyZoom = () => {
      const w = this.scale.width || TARGET_VIEW_W;
      const zoom = Phaser.Math.Clamp(w / TARGET_VIEW_W, 0.5, 1.3);
      this.cameras.main.setZoom(zoom);
    };
    applyZoom();
    this.scale.on("resize", applyZoom);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", applyZoom);
    });
  }

  getOrCreateOther(id, x, y, character, name) {
    if (this.otherPlayers.has(id)) return this.otherPlayers.get(id);

    const roster = this.initialRoster.find((p) => p.id === id);
    const resolvedCharacter = character || roster?.character || "nexus";
    const resolvedName = name || roster?.name || "Pemain";

    const sprite = this.add
      .sprite(x ?? SPAWN.x, y ?? SPAWN.y, this.characterTextureFor(resolvedCharacter))
      .setDisplaySize(SPRITE_SIZE, SPRITE_SIZE)
      .setDepth(5);
    const nameTag = this.createNameTag(x ?? SPAWN.x, y ?? SPAWN.y, resolvedName);

    const entry = { sprite, nameTag, target: { x: x ?? SPAWN.x, y: y ?? SPAWN.y } };
    this.otherPlayers.set(id, entry);
    return entry;
  }

  setupJoystick() {
    const JOY_RADIUS = 60;
    const DEADZONE = 0.18;
    this.joyVec = { x: 0, y: 0 };
    this.joyActive = false;
    this.joyPointerId = null;

    this.input.addPointer(2);

    this.joyBase = this.add
      .circle(0, 0, JOY_RADIUS, 0xffffff, 0.1)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);
    this.joyThumb = this.add
      .circle(0, 0, 26, 0x049cd8, 0.75)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setVisible(false);

    this.input.on("pointerdown", (pointer) => {
      if (!pointer.wasTouch || this.joyActive) return;
      this.joyActive = true;
      this.joyPointerId = pointer.id;
      this.joyOrigin = { x: pointer.x, y: pointer.y };
      this.joyBase.setPosition(pointer.x, pointer.y).setVisible(true);
      this.joyThumb.setPosition(pointer.x, pointer.y).setVisible(true);
    });

    this.input.on("pointermove", (pointer) => {
      if (!this.joyActive || pointer.id !== this.joyPointerId) return;
      const dx = pointer.x - this.joyOrigin.x;
      const dy = pointer.y - this.joyOrigin.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const clamped = Math.min(dist, JOY_RADIUS);
      this.joyThumb.setPosition(
        this.joyOrigin.x + Math.cos(angle) * clamped,
        this.joyOrigin.y + Math.sin(angle) * clamped
      );
      const mag = clamped / JOY_RADIUS;
      this.joyVec =
        mag < DEADZONE
          ? { x: 0, y: 0 }
          : { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
    });

    const endJoystick = (pointer) => {
      if (pointer.id !== this.joyPointerId) return;
      this.resetJoystick();
    };
    this.input.on("pointerup", endJoystick);
    this.input.on("pointerupoutside", endJoystick);
  }

  resetJoystick() {
    this.joyActive = false;
    this.joyPointerId = null;
    this.joyVec = { x: 0, y: 0 };
    this.joyBase?.setVisible(false);
    this.joyThumb?.setVisible(false);
  }

  update(time) {
    // MODE SPECTATOR: geser kamera dengan WASD/panah, tidak ada avatar sendiri.
    if (this.isSpectator) {
      const speed = 6;
      const cam = this.cameras.main;
      if (this.cursors?.left.isDown || this.wasd?.A.isDown) cam.scrollX -= speed;
      else if (this.cursors?.right.isDown || this.wasd?.D.isDown) cam.scrollX += speed;
      if (this.cursors?.up.isDown || this.wasd?.W.isDown) cam.scrollY -= speed;
      else if (this.cursors?.down.isDown || this.wasd?.S.isDown) cam.scrollY += speed;

      this.otherPlayers.forEach((entry) => {
        const { sprite, nameTag, target } = entry;
        if (!target) return;
        const nx = Phaser.Math.Linear(sprite.x, target.x, 0.25);
        const ny = Phaser.Math.Linear(sprite.y, target.y, 0.25);
        sprite.setPosition(nx, ny);
        nameTag.setPosition(nx, ny - 24);
      });
      return;
    }

    if (!this.self.body) return;
    const speed = 220;
    let vx = 0;
    let vy = 0;

    if (this.joyActive) {
      const p = (this.input.manager?.pointers || []).find(
        (pt) => pt.id === this.joyPointerId
      );
      if (!p || !p.isDown) this.resetJoystick();
    }

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = speed;

    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = speed;

    if (this.joyActive && (this.joyVec.x !== 0 || this.joyVec.y !== 0)) {
      vx = this.joyVec.x * speed;
      vy = this.joyVec.y * speed;
    } else if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    this.self.setVelocity(vx, vy);
    this.nameTag.setPosition(this.self.x, this.self.y - 24);

    const stillNear = this.npcZones.some(
      (nz) => Phaser.Math.Distance.Between(this.self.x, this.self.y, nz.x, nz.y) < 95
    );
    if (!stillNear) {
      this.currentNpc = null;
      this.mustExitZone = false;
    }

    if (time - this.lastSent > 80) {
      const dx = this.self.x - this.lastSentPos.x;
      const dy = this.self.y - this.lastSentPos.y;
      if (dx * dx + dy * dy > 1) {
        this.lastSent = time;
        this.lastSentPos = { x: this.self.x, y: this.self.y };
        this.socket.emit("player_move", { code: this.roomCode, x: this.self.x, y: this.self.y });
      }
    }

    this.otherPlayers.forEach((entry) => {
      const { sprite, nameTag, target } = entry;
      if (!target) return;
      const nx = Phaser.Math.Linear(sprite.x, target.x, 0.25);
      const ny = Phaser.Math.Linear(sprite.y, target.y, 0.25);
      sprite.setPosition(nx, ny);
      nameTag.setPosition(nx, ny - 24);
    });
  }
}
