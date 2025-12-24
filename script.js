(() => {
    const introEl = document.getElementById("intro");
    const gameEl = document.getElementById("game");
    const summaryEl = document.getElementById("summary");
    const gridEl = document.getElementById("grid");
    const timerEl = document.getElementById("timer");
    const summaryTable = document.getElementById("summaryTable");
    const keysLabelEl = document.getElementById("keysLabel");
    const headerEl = document.querySelector(".header");
    const boostCountEl = document.getElementById("boostCount");

    const letsStartBtn = document.getElementById("letsStart");
    const stopSubmitBtn = document.getElementById("stopSubmit");
    const closeSummaryBtn = document.getElementById("closeSummary");
    const levelSelectEl = document.getElementById("levelSelect");
    const pauseBtn = document.getElementById("pauseBtn");
    const addTimeBtn = document.getElementById("addTimeBtn");
    const resumeBtn = document.getElementById("resumeBtn");
    const returnMenuBtn = document.getElementById("returnMenuBtn");
    const pauseOverlay = document.getElementById("pauseOverlay");
    const tutorialBtn = document.getElementById("tutorialBtn");
    const tutorialOverlay = document.getElementById("tutorialOverlay");
    const tutorialStep = document.getElementById("tutorialStep");
    const tutorialTitle = document.getElementById("tutorialTitle");
    const tutorialText = document.getElementById("tutorialText");
    const tutorialNext = document.getElementById("tutorialNext");
    const tutorialSkip = document.getElementById("tutorialSkip");

    // Build 150 levels with specified size and key rules
    function buildLevels() {
        const levels = [];
        const sizes = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const keyCycles = {
            3: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            4: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            5: [1, 1, 1, 1, 2, 2, 2, 3, 3, 3],
            6: [1, 1, 1, 1, 2, 2, 2, 3, 3, 3],
            7: [1, 1, 1, 2, 2, 2, 3, 3, 4, 4],
            8: [1, 1, 1, 2, 2, 2, 3, 3, 4, 4],
            9: [1, 1, 1, 2, 2, 2, 3, 3, 4, 4],
            10: [1, 1, 1, 2, 2, 2, 3, 3, 4, 4],
            11: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
            12: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
        };

        for (let i = 1; i <= 100; i++) {
            const sizeIndex = Math.floor((i - 1) / 10);
            const size = sizes[Math.min(sizeIndex, sizes.length - 1)];
            const levelInSize = (i - 1) % 10;
            const keys = keyCycles[size][levelInSize];
            levels.push({ level: i, size, keys });
        }

        // Levels 101–150: sizes cycle through [5,6..12], path hidden, with 2-3 keys
        const cycle2 = [5, 6, 7, 8, 9, 10, 11, 12];
        for (let i = 101; i <= 150; i++) {
            const size = cycle2[(i - 101) % cycle2.length];
            const keys = size >= 11 ? 3 : 2;
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
    let playerPath = [];
    let paused = false;
    let pauseStartTime = 0;
    let totalPausedTime = 0;
    let inTutorial = false;
    let tutorialStepIndex = 0;
    let tutorialTooltip = null;
    let earnedBoosts = parseInt(localStorage.getItem("earnedBoosts") || "0", 10);

    function getRoundSeconds(lvl) {
        if (lvl <= 30) return 4 * 60;
        if (lvl <= 60) return 6 * 60;
        if (lvl <= 90) return 8 * 60;
        if (lvl <= 100) return 10 * 60;
        return 30 * 60;
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

    function updateBoostDisplay() {
        boostCountEl.textContent = earnedBoosts;
    }

    const tutorialSteps = [
        {
            title: "Welcome to Hidden Maze! 🎮",
            text: "This is a puzzle game where you navigate through invisible mazes. Let's learn the basics!",
            highlight: null
        },
        {
            title: "The Grid 🔲",
            text: "This is your maze grid. The walls are invisible, so you'll need to explore carefully by clicking adjacent cells or using arrow keys (W/A/S/D).",
            highlight: "grid",
            action: () => {
                if (!running) {
                    level = 1;
                    startTutorialRound();
                }
            }
        },
        {
            title: "Collect Keys 🗝️",
            text: "Your goal is to find and collect all the keys in the maze. Keys are marked with a 🗝️ emoji. Try moving around to explore!",
            highlight: "grid"
        },
        {
            title: "Reach the Door 🚪",
            text: "After collecting all keys, go to the door (purple box at bottom-right). The door will only open when you have all keys!",
            highlight: "grid"
        },
        {
            title: "Watch Out for Walls! ⚠️",
            text: "If you hit an invisible wall, you'll flash red and reset to start. Your visited path (dark trail) helps you remember where you've been. Good luck!",
            highlight: "grid"
        }
    ];

    function showTutorialStep(index) {
        if (index >= tutorialSteps.length) {
            endTutorial();
            return;
        }

        tutorialStepIndex = index;
        const step = tutorialSteps[index];
        
        tutorialStep.textContent = `Step ${index + 1} of ${tutorialSteps.length}`;
        tutorialTitle.textContent = step.title;
        tutorialText.textContent = step.text;
        tutorialNext.textContent = index === tutorialSteps.length - 1 ? "Start Playing!" : "Next";

        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
        if (tutorialTooltip) {
            tutorialTooltip.remove();
            tutorialTooltip = null;
        }

        if (step.highlight) {
            const element = document.getElementById(step.highlight);
            if (element) {
                element.classList.add('tutorial-highlight');
            }
        }

        if (step.action) {
            step.action();
        }
    }

    function startTutorialRound() {
        rows = cols = 3;
        keysNeeded = 1;
        hidePath = false;
        headerEl.textContent = "Hidden Maze Challenge — Tutorial (3×3)";
        keysLabelEl.textContent = "1 KEY";
        gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridEl.className = 'grid';

        buildGrid();
        placeEntities();
        placeKeysRandom();
        moves = 0;
        keysCollected = 0;
        playerPath = [{ r: startPos.r, c: startPos.c }];
        clearPath();
        render();

        running = true;
        inTutorial = true;
        roundSeconds = 600;
        timerEl.textContent = formatTime(roundSeconds);
        roundStartTime = Date.now();
        totalPausedTime = 0;

        clearInterval(roundTimer);
        roundTimer = setInterval(() => {
            if (!paused) {
                roundSeconds--;
                timerEl.textContent = formatTime(roundSeconds);
                if (roundSeconds <= 0) endTutorialRound();
            }
        }, 1000);

        introEl.classList.add("hidden");
        summaryEl.classList.add("hidden");
        gameEl.classList.remove("hidden");
    }

    function endTutorialRound() {
        running = false;
        inTutorial = false;
        clearInterval(roundTimer);
        showToast('🎉 Tutorial complete! Ready to play?');
        setTimeout(() => {
            gameEl.classList.add("hidden");
            introEl.classList.remove("hidden");
        }, 1500);
    }

    function endTutorial() {
        tutorialOverlay.classList.add('hidden');
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
        
        if (inTutorial && running) {
            showToast('Complete this level to finish tutorial!');
        } else {
            localStorage.setItem('tutorialCompleted', 'true');
            showToast('Tutorial complete! Select a level to begin.');
        }
    }

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
        
        gridEl.className = 'grid';
        if (rows >= 7) {
            gridEl.classList.add(`size-${rows}`);
        }
    }

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

    function calculateSolutionPath() {
        const queue = [{ r: startPos.r, c: startPos.c, keysFound: [], path: [{ r: startPos.r, c: startPos.c }] }];
        const visited = new Set();
        visited.add(`${startPos.r},${startPos.c},`);

        while (queue.length > 0) {
            const current = queue.shift();
            const { r, c, keysFound, path } = current;

            if (r === door.r && c === door.c && keysFound.length === keysNeeded) {
                return path;
            }

            const w = cells[idx(r, c)].walls;
            const neighbors = [];
            if (!w.u && r - 1 >= 0) neighbors.push([r - 1, c]);
            if (!w.r && c + 1 < cols) neighbors.push([r, c + 1]);
            if (!w.d && r + 1 < rows) neighbors.push([r + 1, c]);
            if (!w.l && c - 1 >= 0) neighbors.push([r, c - 1]);

            for (const [nr, nc] of neighbors) {
                let newKeysFound = [...keysFound];
                
                const keyAtPos = originalKeys.find(k => k.r === nr && k.c === nc);
                if (keyAtPos && !newKeysFound.some(k => k.r === nr && k.c === nc)) {
                    newKeysFound.push({ r: nr, c: nc });
                }

                const stateKey = `${nr},${nc},${newKeysFound.map(k => `${k.r}-${k.c}`).sort().join(',')}`;
                if (!visited.has(stateKey)) {
                    visited.add(stateKey);
                    queue.push({
                        r: nr,
                        c: nc,
                        keysFound: newKeysFound,
                        path: [...path, { r: nr, c: nc }]
                    });
                }
            }
        }

        return [];
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
        if (!running || paused) return;
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
            playerPath = [{ r: startPos.r, c: startPos.c }];
            clearPath();
            render();
            return;
        }

        markPath(player.r, player.c);
        player = { r: tr, c: tc };
        playerPath.push({ r: tr, c: tc });
        moves++;

        const fi = keys.findIndex(k => k.r === player.r && k.c === player.c);
        if (fi !== -1) {
            keys.splice(fi, 1);
            keysCollected++;
        }

        render();

        if (keysCollected >= keysNeeded && player.r === door.r && player.c === door.c) {
            if (inTutorial) {
                celebrateTutorialComplete();
            } else {
                celebrateLevelComplete();
            }
        }
    }

    window.onkeydown = e => {
        if (!running || paused) return;
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
        playerPath = [{ r: startPos.r, c: startPos.c }];
        clearPath();
        render();
        updateBoostDisplay();

        running = true;
        paused = false;
        pauseStartTime = 0;
        totalPausedTime = 0;
        roundSeconds = getRoundSeconds(level);
        timerEl.textContent = formatTime(roundSeconds);
        roundStartTime = Date.now();

        clearInterval(roundTimer);
        roundTimer = setInterval(() => {
            if (!paused) {
                roundSeconds--;
                timerEl.textContent = formatTime(roundSeconds);
                if (roundSeconds <= 0) endRound(false);
            }
        }, 1000);

        introEl.classList.add("hidden");
        summaryEl.classList.add("hidden");
        gameEl.classList.remove("hidden");
    }

    function showPathWithAnimation(pathArray, className) {
        pathArray.forEach((pos, i) => {
            setTimeout(() => {
                const cell = gridEl.children[idx(pos.r, pos.c)];
                cell.classList.add(className);
            }, i * 30);
        });
    }

    function celebrateTutorialComplete() {
        running = false;
        inTutorial = false;
        
        const doorCell = gridEl.children[idx(door.r, door.c)];
        const doorElement = doorCell.querySelector('.door');
        
        if (doorElement) {
            doorElement.classList.add('unlocking');
            setTimeout(() => {
                createSparkles(doorCell);
            }, 300);
            setTimeout(() => {
                const burst = document.createElement('div');
                burst.className = 'door-burst';
                doorCell.appendChild(burst);
                setTimeout(() => burst.remove(), 1000);
            }, 500);
            setTimeout(() => {
                doorElement.classList.add('opening');
                doorElement.classList.remove('unlocking');
            }, 600);
        }
        
        doorCell.classList.add('success');
        showPathWithAnimation(playerPath, 'traveled-path');
        
        const overlay = document.createElement('div');
        overlay.className = 'level-complete-overlay';
        overlay.textContent = '🎓 Tutorial Complete! 🎓';
        gameEl.style.position = 'relative';
        gameEl.appendChild(overlay);
        
        showToast('🎊 Great job! You\'re ready to play!');
        localStorage.setItem('tutorialCompleted', 'true');
        
        setTimeout(() => {
            overlay.remove();
            clearInterval(roundTimer);
            gameEl.classList.add('hidden');
            introEl.classList.remove('hidden');
        }, 2500);
    }

    function celebrateLevelComplete() {
        running = false;
        earnedBoosts++;
        localStorage.setItem("earnedBoosts", earnedBoosts.toString());
        updateBoostDisplay();
        
        const doorCell = gridEl.children[idx(door.r, door.c)];
        const doorElement = doorCell.querySelector('.door');
        
        if (doorElement) {
            doorElement.classList.add('unlocking');
            
            setTimeout(() => {
                createSparkles(doorCell);
            }, 300);
            
            setTimeout(() => {
                const burst = document.createElement('div');
                burst.className = 'door-burst';
                doorCell.appendChild(burst);
                setTimeout(() => burst.remove(), 1000);
            }, 500);
            
            setTimeout(() => {
                doorElement.classList.add('opening');
                doorElement.classList.remove('unlocking');
            }, 600);
        }
        
        doorCell.classList.add('success');
        
        showPathWithAnimation(playerPath, 'traveled-path');
        
        const overlay = document.createElement('div');
        overlay.className = 'level-complete-overlay';
        overlay.textContent = '🎉 LEVEL UP! 🎉';
        gameEl.style.position = 'relative';
        gameEl.appendChild(overlay);
        
        showToast('🎊 Level Complete! +1 Boost earned!');
        
        setTimeout(() => {
            overlay.remove();
            endRound(true);
        }, 2500);
    }
    
    function createSparkles(parentCell) {
        const colors = ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#60a5fa'];
        const sparkleCount = 12;
        
        for (let i = 0; i < sparkleCount; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle';
                sparkle.style.background = colors[Math.floor(Math.random() * colors.length)];
                
                const angle = (Math.PI * 2 * i) / sparkleCount;
                const distance = 30 + Math.random() * 20;
                const tx = Math.cos(angle) * distance;
                const ty = Math.sin(angle) * distance;
                
                sparkle.style.setProperty('--tx', `${tx}px`);
                sparkle.style.setProperty('--ty', `${ty}px`);
                
                sparkle.style.left = '50%';
                sparkle.style.top = '50%';
                
                parentCell.appendChild(sparkle);
                
                setTimeout(() => sparkle.remove(), 1000);
            }, i * 50);
        }
    }

    function endRound(solved) {
        running = false;
        paused = false;
        clearInterval(roundTimer);
        const t = Math.floor((Date.now() - roundStartTime - totalPausedTime) / 1000);
        sessionResults.push({ round: level, time: t, moves, keys: keysCollected, solved });

        if (solved) {
            level = level >= 150 ? 1 : level + 1;
            setTimeout(() => startRound(), 350);
        } else {
            showToast('⏱️ Time\'s up! Here\'s the solution path...');
            const solutionPath = calculateSolutionPath();
            if (solutionPath.length > 0) {
                showPathWithAnimation(solutionPath, 'solution-path');
            }
            setTimeout(() => startRound(), 3000);
        }
    }

    stopSubmitBtn.onclick = () => {
        if (running) {
            running = false;
            clearInterval(roundTimer);
            const t = Math.floor((Date.now() - roundStartTime - totalPausedTime) / 1000);
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

    tutorialBtn.onclick = () => {
        tutorialStepIndex = 0;
        tutorialOverlay.classList.remove('hidden');
        showTutorialStep(0);
    };

    tutorialNext.onclick = () => {
        showTutorialStep(tutorialStepIndex + 1);
    };

    tutorialSkip.onclick = () => {
        endTutorial();
    };

    pauseBtn.onclick = () => {
        if (!running || paused) return;
        paused = true;
        pauseStartTime = Date.now();
        pauseOverlay.classList.remove('hidden');
        showToast('⏸ Game Paused');
    };

    addTimeBtn.onclick = () => {
        if (!running || paused) return;
        if (earnedBoosts <= 0) {
            showToast('⏱️ No boosts available! Complete levels to earn more.');
            return;
        }
        earnedBoosts--;
        localStorage.setItem("earnedBoosts", earnedBoosts.toString());
        roundSeconds += 60;
        updateBoostDisplay();
        timerEl.textContent = formatTime(roundSeconds);
        showToast(`⏱️ +60s added! (${earnedBoosts} boosts left)`);
    };

    resumeBtn.onclick = () => {
        if (!paused) return;
        totalPausedTime += Date.now() - pauseStartTime;
        paused = false;
        pauseOverlay.classList.add('hidden');
        showToast('▶ Game Resumed');
    };

    returnMenuBtn.onclick = () => {
        if (running) {
            running = false;
            paused = false;
            clearInterval(roundTimer);
            const t = Math.floor((Date.now() - roundStartTime - totalPausedTime) / 1000);
            sessionResults.push({ round: level, time: t, moves, keys: keysCollected, solved: false });
        }
        pauseOverlay.classList.add('hidden');
        gameEl.classList.add('hidden');
        introEl.classList.remove('hidden');
        showToast('Returned to menu');
    };
})();
