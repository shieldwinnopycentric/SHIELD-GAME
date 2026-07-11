import Phaser from "phaser";

/**
 * MainScene draws the battlefield map exploration.
 *
 * ASSETS: drop renamed PNGs into `frontend/public/assets/`. Only the files
 * under REQUIRED_ASSETS are mandatory (missing ones auto-fallback to a
 * placeholder shape). OPTIONAL_ASSETS add map variety / distinct NPC
 * markers per level / enemy icon — safe to skip, everything still renders.
 *
 *   REQUIRED
 *   /assets/tile-ground.png       -> base ground/road tile
 *   /assets/character-nexus.png   -> "Nexus" avatar sprite
 *   /assets/character-cypher.png  -> "Cypher" avatar sprite
 *   /assets/character-helix.png   -> "Helix" avatar sprite
 *   /assets/npc-marker.png        -> generic NPC / encounter marker icon
 *                                     (fallback used for any level that
 *                                     doesn't have its own marker below)
 *
 *   OPTIONAL — map look
 *   /assets/map-background.png    -> RECOMMENDED: one ready-made scene image
 *                                     (e.g. from itch.io / OpenGameArt) used
 *                                     as the entire map background instead
 *                                     of assembling one from small tiles.
 *                                     If present, tile-ground(-2/-3) below
 *                                     are ignored entirely for the ground.
 *   /assets/tile-ground-2.png     -> only used if map-background.png is
 *                                     absent: a 2nd ground tile variant
 *   /assets/tile-ground-3.png     -> only used if map-background.png is
 *                                     absent: a 3rd ground tile variant
 *   /assets/tile-path.png         -> a road/path tile for the walking route
 *                                     (works with EITHER map-background.png
 *                                     or the tile-mosaic fallback)
 *   /assets/decor-1.png / decor-2.png / decor-3.png -> scattered decoration
 *                                     (only used in the tile-mosaic fallback)
 *
 *   OPTIONAL — distinct marker per level (so Level 1/2/3 don't look
 *   identical on the map)
 *   /assets/npc-marker-1.png      -> Level 1 marker
 *   /assets/npc-marker-2.png      -> Level 2 marker
 *   /assets/npc-marker-3.png      -> Level 3 marker
 *
 *   OPTIONAL — enemy icon shown clustered near each marker, count = jumlah
 *   musuh level itu (1/3/5), per KONSEP_GAME_SHIELD.pdf ("musuhnya tolong
 *   ditampilin juga di map")
 *   /assets/enemy-icon.png
 *
 * Every player (yourself and teammates) renders using whichever of
 * character-nexus/cypher/helix matches THEIR chosen avatar, so you can
 * tell players apart by name tag + avatar instead of a generic placeholder.
 *
 * Colorful/variatif per konsep: tiap zona level punya lingkaran warna khas
 * (biru/kuning/merah, dari palet Mario) di belakang marker-nya, plus efek
 * asap ambient tersebar di map (tema inhalan).
 */

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
const MARKER_SIZE = 56; // NPC markers rendered bigger than character sprites so they stand out on the map
const ENEMY_ICON_SIZE = 16;
const MAP_W = 1600;
const MAP_H = 1200;
const SPAWN = { x: 400, y: 300 };

// Mario-palette accents per level zone (mixed & matched per konsep doc).
const LEVEL_COLORS = {
  1: 0x049cd8, // marioBlue
  2: 0xfbd000, // marioYellow
  3: 0xe52521, // marioRed
};

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.otherPlayers = new Map(); // id -> { sprite, nameTag }
    this.npcZones = [];
    this.missingAssetKeys = new Set();
  }

  init({ socket, roomCode, player, initialRoster, currentLevel, onNearNpc }) {
    this.socket = socket;
    this.roomCode = roomCode;
    this.playerMeta = player;
    this.initialRoster = initialRoster || [];
    this.currentLevel = currentLevel || 1;
    this.onNearNpc = onNearNpc;
    this.currentNpc = null;
    this.mustExitZone = false; // set true after each level-up (see setCurrentLevel)
  }

  /** Called from PhaserGame.jsx whenever the player's real level (confirmed
   * by the server) changes, so only the NPC matching that level responds
   * when approached. */
  setCurrentLevel(level) {
    this.currentLevel = level;
    this.currentNpc = null; // allow the newly-relevant zone to trigger fresh
    // Hard rule: after a level advances, the player MUST walk out of any NPC
    // zone and then approach the NEXT level's NPC before a new challenge can
    // start. This makes it impossible for level N+1 to auto-start just
    // because the player was standing on the previous NPC when they leveled
    // up (or was mid-move when the transition closed).
    this.mustExitZone = true;
    this.applyZoneDimming();
  }

  /** Full opacity for the marker matching the player's current level,
   * dimmed for the others — a quick visual cue for which NPC to approach. */
  applyZoneDimming() {
    (this.npcZones || []).forEach((nz) => {
      nz.marker?.setAlpha(nz.level === this.currentLevel ? 1 : 0.35);
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

    // Only REQUIRED_ASSETS get a guaranteed placeholder.
    ensure(
      "tile-ground",
      (gg) => {
        gg.fillStyle(0x141c24, 1); // cool-dark, sesuai panel neutral
        gg.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        gg.lineStyle(1, 0x263340, 1);
        gg.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
      },
      TILE_SIZE
    );

    ensure(
      "character-nexus",
      (gg) => {
        gg.fillStyle(0x049cd8, 1); // marioBlue
        gg.fillCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      },
      SPRITE_SIZE
    );

    ensure(
      "character-cypher",
      (gg) => {
        gg.fillStyle(0x43b047, 1); // marioGreen
        gg.fillCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      },
      SPRITE_SIZE
    );

    ensure(
      "character-helix",
      (gg) => {
        gg.fillStyle(0xe52521, 1); // marioRed
        gg.fillCircle(SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2);
      },
      SPRITE_SIZE
    );

    ensure(
      "npc-marker",
      (gg) => {
        gg.fillStyle(0xe52521, 1); // marioRed
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

    // Soft translucent circle used for the ambient smoke effect.
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

  /** Preferred path: one ready-made scene image stretched across the whole
   * map, optionally with a path overlay if tile-path.png was also
   * provided. Avoids the "patchwork of mismatched tiles" look you get from
   * randomly mixing many unrelated small tiles. */
  buildSingleImageBackground(bgKey, npcPositions) {
    this.add
      .image(MAP_W / 2, MAP_H / 2, bgKey)
      .setDisplaySize(MAP_W, MAP_H)
      .setDepth(0);

    const pathKey = this.availableKeys(["tile-path"])[0];
    if (!pathKey) return;

    // Optional thin path overlay so the route to each NPC still reads
    // clearly on top of the background art.
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

  /** Fallback when no map-background.png is provided: procedurally tile
   * whatever ground tile(s) you've added, with variety (rotation/flip/tint)
   * so a single repeated tile doesn't look like plain stripes. Works best
   * when tile-ground(-2/-3).png are visually similar (e.g. grass shades) —
   * mixing unrelated tiles (water, crates, walls) here will look patchy,
   * which is exactly why a single map-background.png is recommended instead. */
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

  /** Colored zone glow + enemy-count cluster behind each NPC marker, so
   * Level 1/2/3 read as visually distinct AND show how many opponents
   * that level represents (1 vs 1 / 1 vs 3 / 1 vs 5). */
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

  /** Ambient smoke puffs drifting slowly across the map — nods to the
   * inhalant theme without depicting anything graphic. */
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
      frequency: 900,
      blendMode: "ADD",
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

    // Find my own starting position (staggered per-player by the server)
    // in the initial roster, falling back to the default spawn if it's
    // missing for any reason.
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

    // Pre-create every OTHER player from the roster at their real starting
    // position + correct avatar, instead of waiting for their first
    // movement update (which used to leave them invisible, stacked on the
    // default spawn point).
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
        if (nz.level !== this.currentLevel) return; // NPC belum/tidak relevan untuk progres saat ini
        if (this.mustExitZone) return; // harus keluar zona lama dulu sesudah naik level
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

    this.setupJoystick();

    this.socket.on("player_moved", ({ id, x, y }) => {
      const entry = this.getOrCreateOther(id, x, y);
      entry.sprite.setPosition(x, y);
      entry.nameTag.setPosition(x, y - 24);
    });
  }

  /** Gets or lazily creates an { sprite, nameTag } pair for another player. */
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

    const entry = { sprite, nameTag };
    this.otherPlayers.set(id, entry);
    return entry;
  }

  /**
   * On-screen analog joystick for touch devices. A "dynamic" joystick:
   * wherever you first press, a base ring appears and the thumb tracks your
   * finger (clamped to JOY_RADIUS), producing a normalized movement vector
   * consumed in update(). Screen-fixed (setScrollFactor 0) so it stays put
   * while the camera follows the player. Keyboard (WASD/arrows) is untouched
   * for laptop play. Only touch pointers activate it, so a mouse on desktop
   * never accidentally drags the character.
   */
  setupJoystick() {
    const JOY_RADIUS = 60;
    const DEADZONE = 0.18;
    this.joyVec = { x: 0, y: 0 };
    this.joyActive = false;
    this.joyPointerId = null;

    // Allow a 2nd/3rd concurrent touch (e.g. moving + tapping a button).
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
    if (!this.self.body) return;
    const speed = 220;
    let vx = 0;
    let vy = 0;

    // Self-heal: if the finger driving the joystick was released over a DOM
    // overlay (e.g. the challenge modal), Phaser may never get the pointerup.
    // Detect the tracked pointer no longer being down and reset, so the
    // joystick never gets stuck "on".
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

    // Touch joystick takes over when active (overrides keyboard axes).
    if (this.joyActive && (this.joyVec.x !== 0 || this.joyVec.y !== 0)) {
      vx = this.joyVec.x * speed;
      vy = this.joyVec.y * speed;
    }

    this.self.setVelocity(vx, vy);
    this.nameTag.setPosition(this.self.x, this.self.y - 24);

    const stillNear = this.npcZones.some(
      (nz) => Phaser.Math.Distance.Between(this.self.x, this.self.y, nz.x, nz.y) < 60
    );
    if (!stillNear) {
      this.currentNpc = null;
      // Player has stepped away from every NPC — the next time they walk into
      // a zone it's a genuine, deliberate approach, so lift the post-levelup
      // lock.
      this.mustExitZone = false;
    }

    if (time - this.lastSent > 80) {
      this.lastSent = time;
      this.socket.emit("player_move", { code: this.roomCode, x: this.self.x, y: this.self.y });
    }
  }
}