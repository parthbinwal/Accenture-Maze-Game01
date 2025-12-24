(() => {
    const introEl = document.getElementById("intro");
    const gameEl = document.getElementById("game");
    const summaryEl = document.getElementById("summary");
    const gridEl = document.getElementById("grid");
    const timerEl = document.getElementById("timer");
    const summaryTable = document.getElementById("summaryTable");
    const keysLabelEl = document.getElementById("keysLabel");
    const headerEl = document.querySelector(".header");

    const letsStartBtn = document.getElementById("letsStart");
    const stopSubmitBtn = document.getElementById("stopSubmit");
    const closeSummaryBtn = document.getElementById("closeSummary");
    const levelSelectEl = document.getElementById("levelSelect");

    // Build 150 levels with specified size and key rules
    function buildLevels() {
        const levels = [];
        // First 100 levels: sizes cycle through [3,5,6..12]
        const cycle1 = [3, 5, 6, 7, 8, 9, 10, 11, 12];
        for (let i = 1; i <= 100; i++) {
            const size = cycle1[(i - 1) % cycle1.length];
            const keys = (() => {
                if (size === 3 || size === 5) return 1;
                if (size >= 6 && size <= 9) {
                    // Start with 1 key, increase to 2 later in the set
                    return i <= 60 ? 1 : 2;
                }
                // size 10–12: start at 1, then 2, then 3
                if (i <= 33) return 1;
                if (i <= 66) return 2;
                return 3;
            })();
            levels.push({ level: i, size, keys });
        }

        // Levels 101–150: sizes cycle through [5,6..12], path hidden
        const cycle2 = [5, 6, 7, 8, 9, 10, 11, 12];
        for (let i = 101; i <= 150; i++) {
            const size = cycle2[(i - 101) % cycle2.length];
            const keys = (() => {
                if (size === 5) return 1;
                if (size >= 6 && size <= 9) {
                    // Start with 1 key, increase to 2 later in the set
                    return i <= 125 ? 1 : 2;
                }
                // size 10–12: start at 1, then 2, then 3 as difficulty increases
                if (i <= 116) return 1;
                if (i <= 133) return 2;
                return 3;
            })();
            levels.push({ level: i, size, keys, hiddenPath: true });
        }
        return levels;
    }

    const LEVELS = buildLevels();

    let level = 1;
    let rows = 5, cols = 5;
    let player = { r: 0, c: 0 };
    let startPos = { r: 0, c: 0 };
    let door = { r: 0, c: 0 };
    let keys = [], originalKeys = [];
    let keysNeeded = 1, keysCollected = 0;
    let moves = 0, running = false;
    let roundSeconds = 240, roundTimer = null;
    let roundStartTime = 0;
    let cells = [];
    let sessionResults = [];
    let hidePath = false;

    function getRoundSeconds(lvl) {
        if (lvl <= 30) return 4 * 60;       // 1–30: 4 min
        if (lvl <= 60) return 6 * 60;       // 31–60: 6 min
        if (lvl <= 90) return 8 * 60;       // 61–90: 8 min
        if (lvl <= 100) return 10 * 60;     // 91–100: 10 min
        return 30 * 60;                     // 101–150: 30 min
    }

    function idx(r, c) { return r * cols + c; }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
    function formatTime(s) { const m = Math.floor(s / 60), ss = s % 60; return `${m}:${ss < 10 ? "0" + ss : ss}`; }

    function showToast(msg) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.classList.add("show");
        setTimeout(() => t.classList.remove("show"), 1200);
    }

    /* LEVEL CONFIG */
    function applyLevelConfig(lvl) {
        const cfg = LEVELS[lvl - 1] || LEVELS[LEVELS.length - 1];
        level = cfg.level;
        rows = cols = cfg.size;
        keysNeeded = cfg.keys;
        hidePath = !!cfg.hiddenPath;
        headerEl.textContent = `Hidden Maze Challenge — Level ${level} (${rows}×${cols})`;
        keysLabelEl.textContent = keysNeeded === 1 ? "1 KEY" : `${keysNeeded} KEYS`;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        
        // Add size class for larger grids (7x7 and above)
        gridEl.className = 'grid';
        if (rows >= 7) {
            gridEl.classList.add(`size-${rows}`);
        }
    }

    /* MAZE GENERATOR */
    function generatePerfectMaze() {
        const base = Array.from({ length: rows * cols }, () => ({ u: true, r: true, d: true, l: true }));
        const visited = Array(rows * cols).fill(false);
        const stack = [[startPos.r, startPos.c]];
        visited[idx(startPos.r, startPos.c)] = true;

        while (stack.length) {
            const [r, c] = stack[stack.length - 1];
            const dirs = [[r - 1, c, 'u'], [r, c + 1, 'r'], [r + 1, c, 'd'], [r, c - 1, 'l']];
            const nbr = dirs.filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[idx(nr, nc)]);
            if (!nbr.length) { stack.pop(); continue; }
            const [nr, nc, dir] = nbr[Math.floor(Math.random() * nbr.length)];
            if (dir === 'u') { base[idx(r, c)].u = false; base[idx(nr, nc)].d = false; }
            if (dir === 'r') { base[idx(r, c)].r = false; base[idx(nr, nc)].l = false; }
            if (dir === 'd') { base[idx(r, c)].d = false; base[idx(nr, nc)].u = false; }
            if (dir === 'l') { base[idx(r, c)].l = false; base[idx(nr, nc)].r = false; }
            visited[idx(nr, nc)] = true;
            stack.push([nr, nc]);
        }
        return base;
    }

    function buildGrid() {
        gridEl.innerHTML = "";
        const maze = generatePerfectMaze();
        cells = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const d = document.createElement("div");
                d.className = "cell";
                d.onclick = () => onCellClick(r, c);
                gridEl.appendChild(d);
                cells.push({ r, c, walls: maze[idx(r, c)] });
            }
        }
    }

    function getReachableAvoidingDoor() {
        const q = [[startPos.r, startPos.c]];
        const seen = Array(rows * cols).fill(false);
        seen[idx(startPos.r, startPos.c)] = true;
        const out = [];
        while (q.length) {
            const [r, c] = q.shift();
            out.push({ r, c });
            const w = cells[idx(r, c)].walls;
            const nbr = [];
            if (!w.u) nbr.push([r - 1, c]);
            if (!w.r) nbr.push([r, c + 1]);
            if (!w.d) nbr.push([r + 1, c]);
            if (!w.l) nbr.push([r, c - 1]);
            for (const [nr, nc] of nbr) {
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                if (nr === door.r && nc === door.c) continue;
                if (!seen[idx(nr, nc)]) {
                    seen[idx(nr, nc)] = true;
                    q.push([nr, nc]);
                }
            }
        }
        return out;
    }

    function placeKeysRandom() {
        keys = []; originalKeys = []; keysCollected = 0;
        let attempts = 0;
        let reachable = [];
        while (attempts < 40) {
            reachable = getReachableAvoidingDoor()
                .filter(c => !(c.r === startPos.r && c.c === startPos.c) && !(c.r === door.r && c.c === door.c));
            if (reachable.length >= keysNeeded) break;
            buildGrid(); placeEntities();
            attempts++;
        }
        if (reachable.length < keysNeeded) keysNeeded = Math.max(1, Math.min(keysNeeded, reachable.length));
        shuffle(reachable);
        for (let i = 0; i < keysNeeded; i++) {
            keys.push({ ...reachable[i] });
            originalKeys.push({ ...reachable[i] });
        }
        keysLabelEl.textContent = keysNeeded === 1 ? "1 KEY" : `${keysNeeded} KEYS`;
    }

    function placeEntities() {
        startPos = { r: 0, c: 0 };
        player = { r: 0, c: 0 };
        door = { r: rows - 1, c: cols - 1 };
    }

    function markPath(r, c) {
        if (hidePath) return;
        gridEl.children[idx(r, c)].classList.add("path");
    }
    function clearPath() {
        document.querySelectorAll(".cell.path").forEach(el => el.classList.remove("path"));
    }

    function render() {
        const all = document.querySelectorAll(".cell");
        all.forEach(el => { el.innerHTML = ""; el.classList.remove("hit", "player-cell"); });

        keys.forEach(k => {
            const keyCell = gridEl.children[idx(k.r, k.c)];
            keyCell.innerHTML = '<div class="key">🗝️</div>';
        });

        const doorCell = gridEl.children[idx(door.r, door.c)];
        doorCell.innerHTML = '<div class="door"></div>';

        const pCell = gridEl.children[idx(player.r, player.c)];
        pCell.classList.add("player-cell");
        pCell.innerHTML = `
            <svg class="player-icon" viewBox="0 0 24 24" fill="white">
                <circle cx="12" cy="7" r="4"></circle>
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="white" stroke-width="2" fill="none"/>
            </svg>
        `;
    }

    function onCellClick(r, c) {
        if (!running) return;
        if (Math.abs(r - player.r) + Math.abs(c - player.c) !== 1) return;
        attemptMove(r, c);
    }

    function attemptMove(tr, tc) {
        let dr = tr - player.r, dc = tc - player.c;
        let dir = null;
        if (dr === -1) dir = 'u';
        if (dr === 1) dir = 'd';
        if (dc === -1) dir = 'l';
        if (dc === 1) dir = 'r';

        if (tr === door.r && tc === door.c && keysCollected < keysNeeded) {
            showToast(keysNeeded === 1 ? "Collect the key and come to the door" : `Collect ${keysNeeded} keys and come to the door`);
            gridEl.children[idx(tr, tc)].classList.add("hit");
            gridEl.classList.add("shake");
            setTimeout(() => gridEl.classList.remove("shake"), 300);
            return;
        }

        const cur = cells[idx(player.r, player.c)];
        if (cur.walls[dir]) {
            const pCell = gridEl.children[idx(player.r, player.c)];
            pCell.classList.add("hit");
            gridEl.classList.add("shake");
            setTimeout(() => gridEl.classList.remove("shake"), 250);

            player = { ...startPos };
            keys = originalKeys.map(k => ({ ...k }));
            keysCollected = 0;
            moves = 0;
            clearPath();
            render();
            return;
        }

        markPath(player.r, player.c);
        player = { r: tr, c: tc };
        moves++;

        const fi = keys.findIndex(k => k.r === player.r && k.c === player.c);
        if (fi !== -1) {
            keys.splice(fi, 1);
            keysCollected++;
        }

        render();

        if (keysCollected >= keysNeeded && player.r === door.r && player.c === door.c) {
            endRound(true);
        }
    }

    window.onkeydown = e => {
        if (!running) return;
        let r = player.r, c = player.c;
        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') r--;
        if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') r++;
        if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') c--;
        if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') c++;
        if (r >= 0 && r < rows && c >= 0 && c < cols) attemptMove(r, c);
    };

    function startRound() {
        applyLevelConfig(level);
        buildGrid();
        placeEntities();
        placeKeysRandom();
        moves = 0;
        keysCollected = 0;
        clearPath();
        render();

        running = true;
        roundSeconds = getRoundSeconds(level);
        timerEl.textContent = formatTime(roundSeconds);
        roundStartTime = Date.now();

        clearInterval(roundTimer);
        roundTimer = setInterval(() => {
            roundSeconds--;
            timerEl.textContent = formatTime(roundSeconds);
            if (roundSeconds <= 0) endRound(false);
        }, 1000);

        introEl.classList.add("hidden");
        summaryEl.classList.add("hidden");
        gameEl.classList.remove("hidden");
    }

    function endRound(solved) {
        running = false;
        clearInterval(roundTimer);
        const t = Math.floor((Date.now() - roundStartTime) / 1000);
        sessionResults.push({ round: level, time: t, moves, keys: keysCollected, solved });

        // Advance only on success; on failure retry the same level.
        if (solved) {
            level = level >= 150 ? 1 : level + 1;
        }

        setTimeout(() => startRound(), 350);
    }

    stopSubmitBtn.onclick = () => {
        if (running) {
            running = false;
            clearInterval(roundTimer);
            const t = Math.floor((Date.now() - roundStartTime) / 1000);
            sessionResults.push({ round: level, time: t, moves, keys: keysCollected, solved: false });
        }
        showSummary();
    };

    function showSummary() {
        gameEl.classList.add("hidden");
        summaryEl.classList.remove("hidden");
        summaryTable.innerHTML = "";
        sessionResults.forEach(r => {
            summaryTable.innerHTML += `<tr>
                <td>${r.round}</td>
                <td>${Math.floor(r.time / 60)}m ${r.time % 60}s</td>
                <td>${r.moves}</td>
                <td>${r.keys}</td>
            </tr>`;
        });
    }

    closeSummaryBtn.onclick = () => {
        summaryEl.classList.add("hidden");
        introEl.classList.remove("hidden");
    };

    // Populate level selector
    for (let i = 1; i <= 150; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        const cfg = LEVELS[i - 1];
        const hidden = cfg.hiddenPath ? " — hidden path" : "";
        opt.textContent = `Level ${i} (${cfg.size}×${cfg.size}, ${cfg.keys} ${cfg.keys === 1 ? 'key' : 'keys'})${hidden}`;
        if (i === level) opt.selected = true;
        levelSelectEl.appendChild(opt);
    }

    letsStartBtn.onclick = () => {
        level = parseInt(levelSelectEl.value, 10);
        startRound();
    };
})();
