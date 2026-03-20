/* game.js */
// Game Configuration
const CONFIG = {
    GRID_COLS: 9,
    GRID_ROWS: 5,
    INITIAL_ENERGY: 450,
    ENERGY_PER_KILL: 30,
    SUN_ENERGY: 35,
    BASE_SPAWN_DELAY: 3200,
    MIN_SPAWN_DELAY: 1800
};

// Pokemon Stats
const POKEMON_STATS = {
    pikachu: { damage: 3, attackSpeed: 1400, projectile: "bolt", imgKey: "pikachu", maxHp: 8 },
    bulbasaur: { damage: 2, attackSpeed: 1200, projectile: "vine", imgKey: "bulbasaur", maxHp: 8, sunGen: true, sunInterval: 6500 },
    charmander: { damage: 5, attackSpeed: 1800, projectile: "flame", imgKey: "charmander", maxHp: 8, burn: true }
};

// Image Assets
const IMAGES = {
    pikachu: "https://img.pokemondb.net/sprites/black-white/anim/normal/pikachu.gif",
    bulbasaur: "https://img.pokemondb.net/sprites/black-white/anim/normal/bulbasaur.gif",
    charmander: "https://img.pokemondb.net/sprites/black-white/anim/normal/charmander.gif",
    zombie: "https://img.pokemondb.net/sprites/black-white/anim/back-normal/rattata.gif",
    zombieElite: "https://img.pokemondb.net/sprites/black-white/anim/back-normal/raticate.gif",
    bolt: "https://i.imgur.com/f6Hb8sN.png",
    vine: "https://i.imgur.com/2sKZ1.png",
    flame: "https://i.imgur.com/KjP2lTQ.png",
    sun: "https://i.imgur.com/TkV6eF8.png"
};

// Game State
let gameState = {
    active: true,
    energy: CONFIG.INITIAL_ENERGY,
    kills: 0,
    wave: 1,
    selectedType: "pikachu",
    selectedCost: 110,
    cells: [],
    intervals: [],
    spawnInterval: null
};

// DOM Elements
const elements = {
    grid: document.getElementById("gameGrid"),
    energySpan: document.getElementById("energyValue"),
    killSpan: document.getElementById("killCount"),
    waveSpan: document.getElementById("waveCount")
};

// ========== UTILITY FUNCTIONS ==========
function updateUI() {
    elements.energySpan.innerText = Math.floor(gameState.energy);
    elements.killSpan.innerText = gameState.kills;
    elements.waveSpan.innerText = gameState.wave;
}

function addEnergy(amount) {
    if (!gameState.active) return;
    gameState.energy += amount;
    updateUI();
}

function spendEnergy(cost) {
    if (gameState.active && gameState.energy >= cost) {
        gameState.energy -= cost;
        updateUI();
        return true;
    }
    return false;
}

function showFloatingMessage(cell, text) {
    const msg = document.createElement("div");
    msg.className = "floating-msg";
    msg.innerText = text;
    cell.style.position = "relative";
    cell.appendChild(msg);
    setTimeout(() => msg.remove(), 600);
}

function showGlobalMessage(text) {
    const banner = document.createElement("div");
    banner.innerText = text;
    banner.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(10px);
        padding: 10px 20px;
        border-radius: 50px;
        color: #ffcc55;
        font-weight: bold;
        font-size: clamp(14px, 4vw, 20px);
        z-index: 999;
        border: 2px solid gold;
        white-space: nowrap;
        pointer-events: none;
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 1800);
}

function vfxHit(cell) {
    const originalBg = cell.style.backgroundColor;
    cell.style.backgroundColor = "#ffaa66";
    setTimeout(() => { if (cell) cell.style.backgroundColor = originalBg; }, 100);
}

// ========== GRID MANAGEMENT ==========
function buildGrid() {
    elements.grid.innerHTML = "";
    gameState.cells = Array(CONFIG.GRID_ROWS).fill().map(() => Array(CONFIG.GRID_COLS).fill(null));
    
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
        for (let col = 0; col < CONFIG.GRID_COLS; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.onclick = (function(r, c) { 
                return () => handlePlacePokemon(r, c); 
            })(row, col);
            elements.grid.appendChild(cell);
            gameState.cells[row][col] = cell;
        }
    }
}

// ========== POKEMON MECHANICS ==========
function createPokemon(row, col, type) {
    const stats = POKEMON_STATS[type];
    const cell = gameState.cells[row][col];
    
    const pokemonDiv = document.createElement("div");
    pokemonDiv.className = "pokemon";
    pokemonDiv.dataset.hp = stats.maxHp;
    pokemonDiv.dataset.maxhp = stats.maxHp;
    pokemonDiv.dataset.type = type;
    
    const img = document.createElement("img");
    img.src = IMAGES[stats.imgKey];
    pokemonDiv.appendChild(img);
    
    const hpBar = document.createElement("div");
    hpBar.className = "hpbar";
    const hpFill = document.createElement("div");
    hpFill.className = "hp";
    hpFill.style.width = "100%";
    hpBar.appendChild(hpFill);
    pokemonDiv.appendChild(hpBar);
    
    cell.appendChild(pokemonDiv);
    
    // Start attacking
    startPokemonAttack(row, col, pokemonDiv, stats);
    
    // Bulbasaur special: generate sun
    if (type === "bulbasaur" && stats.sunGen) {
        const sunInterval = setInterval(() => {
            if (!gameState.active || !pokemonDiv.isConnected) {
                clearInterval(sunInterval);
                return;
            }
            createSunOrb(cell);
        }, stats.sunInterval);
        gameState.intervals.push(sunInterval);
    }
    
    // Charmander visual effect
    if (type === "charmander") {
        pokemonDiv.style.filter = "drop-shadow(0 0 3px orangered)";
    }
}

function startPokemonAttack(row, col, pokemonDiv, stats) {
    const attackInterval = setInterval(() => {
        if (!gameState.active || !pokemonDiv.isConnected) {
            clearInterval(attackInterval);
            return;
        }
        
        // Find first zombie in same row to the right
        for (let c = col + 1; c < CONFIG.GRID_COLS; c++) {
            const cell = gameState.cells[row][c];
            if (cell && cell.children.length > 0) {
                const zombie = cell.querySelector(".zombie");
                if (zombie) {
                    launchProjectile(row, col, cell, stats, pokemonDiv);
                    break;
                }
            }
        }
    }, stats.attackSpeed);
    gameState.intervals.push(attackInterval);
}

function launchProjectile(row, startCol, targetCell, stats, sourcePokemon) {
    const startCell = gameState.cells[row][startCol];
    if (!startCell || !targetCell) return;
    
    const projImg = document.createElement("img");
    projImg.src = IMAGES[stats.projectile] || IMAGES.bolt;
    projImg.className = "projectile";
    startCell.appendChild(projImg);
    
    let currentCol = startCol;
    const moveInterval = setInterval(() => {
        if (!projImg.isConnected || !gameState.active) {
            projImg?.remove();
            clearInterval(moveInterval);
            return;
        }
        
        const parentRow = row;
        if (currentCol + 1 < CONFIG.GRID_COLS) {
            currentCol++;
            const nextCell = gameState.cells[parentRow][currentCol];
            if (nextCell) {
                // Check if reached target or hit zombie
                const zombieInCell = nextCell.querySelector(".zombie");
                if (zombieInCell && nextCell === targetCell) {
                    applyDamage(zombieInCell, stats.damage, stats);
                    vfxHit(nextCell);
                    projImg.remove();
                    clearInterval(moveInterval);
                } else {
                    nextCell.appendChild(projImg);
                }
            } else {
                projImg.remove();
                clearInterval(moveInterval);
            }
        } else {
            projImg.remove();
            clearInterval(moveInterval);
        }
    }, 55);
    gameState.intervals.push(moveInterval);
}

function applyDamage(zombieDiv, damage, stats) {
    let currentHp = parseFloat(zombieDiv.dataset.hp);
    if (isNaN(currentHp)) currentHp = zombieDiv.hp || 5;
    const newHp = currentHp - damage;
    zombieDiv.dataset.hp = newHp;
    zombieDiv.hp = newHp;
    
    const hpFill = zombieDiv.querySelector(".hp");
    if (hpFill) {
        const maxHp = parseFloat(zombieDiv.dataset.maxhp) || 5;
        const percent = Math.max(0, (newHp / maxHp) * 100);
        hpFill.style.width = percent + "%";
    }
    
    if (newHp <= 0) {
        zombieDiv.remove();
        gameState.kills++;
        elements.killSpan.innerText = gameState.kills;
        addEnergy(CONFIG.ENERGY_PER_KILL);
        
        // Wave progression
        if (gameState.kills % 8 === 0 && gameState.kills > 0) {
            advanceWave();
        }
    } else {
        zombieDiv.classList.add("damage-flash");
        setTimeout(() => zombieDiv.classList.remove("damage-flash"), 150);
        
        // Charmander burn effect
        if (stats.burn && Math.random() < 0.35) {
            setTimeout(() => {
                if (zombieDiv.isConnected) applyDamage(zombieDiv, 1, { damage: 1 });
            }, 600);
        }
    }
}

function createSunOrb(cell) {
    if (!gameState.active || !cell.isConnected) return;
    
    const sunImg = document.createElement("img");
    sunImg.src = IMAGES.sun;
    sunImg.className = "sun";
    sunImg.onclick = (e) => {
        e.stopPropagation();
        if (!gameState.active) return;
        addEnergy(CONFIG.SUN_ENERGY);
        sunImg.remove();
        showFloatingMessage(cell, `+${CONFIG.SUN_ENERGY}⚡`);
    };
    cell.appendChild(sunImg);
    
    setTimeout(() => {
        if (sunImg.isConnected) sunImg.remove();
    }, 8000);
}

function handlePlacePokemon(row, col) {
    if (!gameState.active) return;
    const cell = gameState.cells[row][col];
    if (cell.children.length > 0) return;
    
    if (!spendEnergy(gameState.selectedCost)) {
        showFloatingMessage(cell, "Not enough energy!");
        return;
    }
    
    createPokemon(row, col, gameState.selectedType);
}

// ========== ZOMBIE MECHANICS ==========
function spawnZombie() {
    if (!gameState.active) return;
    
    const row = Math.floor(Math.random() * CONFIG.GRID_ROWS);
    const startCol = CONFIG.GRID_COLS - 1;
    const cell = gameState.cells[row][startCol];
    if (!cell) return;
    if (cell.children.length > 0 && cell.querySelector(".zombie")) return;
    
    const isElite = gameState.wave >= 3 && Math.random() < 0.3;
    const zombieHp = 5 + Math.floor(gameState.wave / 2);
    const zombieSpeed = Math.max(1300, 1800 - gameState.wave * 25);
    
    const zombieDiv = document.createElement("div");
    zombieDiv.className = "zombie";
    zombieDiv.dataset.hp = zombieHp;
    zombieDiv.dataset.maxhp = zombieHp;
    zombieDiv.hp = zombieHp;
    
    const img = document.createElement("img");
    img.src = isElite ? IMAGES.zombieElite : IMAGES.zombie;
    zombieDiv.appendChild(img);
    
    const hpBar = document.createElement("div");
    hpBar.className = "hpbar";
    const hpFill = document.createElement("div");
    hpFill.className = "hp";
    hpFill.style.width = "100%";
    hpBar.appendChild(hpFill);
    zombieDiv.appendChild(hpBar);
    
    cell.appendChild(zombieDiv);
    
    let currentCol = startCol;
    const walkInterval = setInterval(() => {
        if (!gameState.active || !zombieDiv.isConnected) {
            clearInterval(walkInterval);
            return;
        }
        
        const currentCell = zombieDiv.parentElement;
        if (!currentCell) return;
        
        const currentRow = row;
        if (currentCol === 0) {
            gameLose();
            return;
        }
        
        const prevCell = gameState.cells[currentRow][currentCol - 1];
        if (prevCell) {
            const defender = prevCell.querySelector(".pokemon");
            if (defender) {
                // Zombie attacks pokemon
                const pokemonHp = parseFloat(defender.dataset.hp || 8);
                const newHp = pokemonHp - (isElite ? 3 : 2);
                defender.dataset.hp = newHp;
                const hpFillDef = defender.querySelector(".hp");
                if (hpFillDef) {
                    const maxHp = parseFloat(defender.dataset.maxhp || 8);
                    const percent = Math.max(0, (newHp / maxHp) * 100);
                    hpFillDef.style.width = percent + "%";
                }
                if (newHp <= 0) {
                    defender.remove();
                }
                vfxHit(prevCell);
            } else {
                prevCell.appendChild(zombieDiv);
                currentCol--;
            }
        }
    }, zombieSpeed);
    
    gameState.intervals.push(walkInterval);
}

function advanceWave() {
    gameState.wave++;
    elements.waveSpan.innerText = gameState.wave;
    showGlobalMessage(`🔥 WAVE ${gameState.wave} - STRONGER ZOMBIES! 🔥`);
    
    // Update spawn rate
    if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
    const newDelay = Math.max(CONFIG.MIN_SPAWN_DELAY, CONFIG.BASE_SPAWN_DELAY - gameState.wave * 70);
    gameState.spawnInterval = setInterval(() => spawnZombie(), newDelay);
}

function gameLose() {
    if (!gameState.active) return;
    gameState.active = false;
    
    // Clear all intervals
    gameState.intervals.forEach(id => clearInterval(id));
    if (gameState.spawnInterval) clearInterval(gameState.spawnInterval);
    
    const modal = document.createElement("div");
    modal.className = "game-over-modal";
    modal.innerHTML = `
        <div class="modal-content">
            <h1>💀 GAME OVER 💀</h1>
            <p>Zombies breached the line!</p>
            <p>🏆 Kills: ${gameState.kills}</p>
            <p>🌊 Wave: ${gameState.wave}</p>
            <button class="restart-btn" id="restartBtn">⚡ RESTART ⚡</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("restartBtn").onclick = () => location.reload();
}

// ========== CARD SELECTION ==========
function initCardSelection() {
    const cards = document.querySelectorAll(".poke-card");
    const statsMap = {
        pikachu: { cost: 110 },
        bulbasaur: { cost: 85 },
        charmander: { cost: 130 }
    };
    
    cards.forEach(card => {
        card.onclick = () => {
            cards.forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            const type = card.dataset.type;
            gameState.selectedType = type;
            gameState.selectedCost = statsMap[type].cost;
        };
    });
    
    // Select first by default
    cards[0]?.classList.add("selected");
}

// ========== INITIALIZATION ==========
function init() {
    buildGrid();
    initCardSelection();
    updateUI();
    gameState.active = true;
    gameState.spawnInterval = setInterval(() => spawnZombie(), CONFIG.BASE_SPAWN_DELAY);
}

// Start the game
init();
