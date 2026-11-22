// Chart.js kommt aus dem CDN-Link in index.html
const Chart = window.Chart;

const ENDPUNKT = 'php/unload.php';

const COLORS = {
    cream: '#f3efe7',
    bordeaux: '#3b0f0f',
    brown: '#7a4530',
    orange: '#c9592f',
    peach: '#f2b48a',
    grid: 'rgba(243, 239, 231, 0.12)',
};

const REVEAL_DURATION = 2000;

// Zahlen vom Schweizer Tierschutz (nicht im Endpunkt, darum hier fest)
const STS = {
    labels: ['2023', '2024', '2025'],
    verzicht: [865, 1009, null],          // freiwillig abgegeben
    total: [1838, 1826, 1696],            // alle Aufnahmen (2023: 1826 + 12)
};

const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;


/* --- Hilfsfunktionen --- */
async function loadData(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Endpunkt antwortet mit Status ${response.status}`);
    }

    return response.json();
}

function formatNumber(number) {
    return new Intl.NumberFormat('de-CH').format(number);
}

function percentChange(start, end) {
    return (end - start) / start * 100;
}

function formatPercent(percent) {
    const rounded = Math.round(percent);

    if (rounded > 0) return `+${rounded} %`;
    if (rounded < 0) return `−${Math.abs(rounded)} %`;
    return '±0 %';
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
}

function pressButton(buttons, active) {
    buttons.forEach(button => button.setAttribute('aria-pressed', button === active));
}


/* --- Grundeinstellungen für alle Grafiken --- */
Chart.defaults.font.family = 'Roboto, sans-serif';
Chart.defaults.font.size = 13;
Chart.defaults.color = 'rgba(243, 239, 231, 0.75)';
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation = false;

Chart.defaults.interaction.mode = 'index';
Chart.defaults.interaction.intersect = false;

Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = COLORS.cream;
Chart.defaults.plugins.tooltip.titleColor = COLORS.bordeaux;
Chart.defaults.plugins.tooltip.bodyColor = COLORS.bordeaux;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.displayColors = false;


/* --- Plugin: Beschriftungen direkt an der Grafik --- */
const LABEL_POSITIONS = {
    above:      ['center',  0, -14],
    aboveLeft:  ['right',   6, -14],
    aboveRight: ['left',   -6, -14],
    below:      ['center',  0,  22],
    belowLeft:  ['right',   6,  22],
    belowRight: ['left',   10,  20],
    right:      ['left',   10,   4],
    high:       ['left',  -14, -80],
};

const pointLabels = {
    id: 'pointLabels',
    afterDatasetsDraw(chart, args, options) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = 'bold 13px Roboto, sans-serif';

        for (const label of options.labels ?? []) {
            const point = chart.getDatasetMeta(label.datasetIndex ?? 0).data[label.index];
            if (!point) continue;

            const [align, dx, dy] = LABEL_POSITIONS[label.position ?? 'above'];
            ctx.textAlign = align;
            ctx.fillStyle = label.color ?? COLORS.cream;
            ctx.fillText(label.text, point.x + dx, point.y + dy);
        }

        ctx.restore();
    },
};


/* --- Plugin: Grafik von links nach rechts aufdecken --- */
const revealFromLeft = {
    id: 'revealFromLeft',

    afterInit(chart) {
        chart.$reveal = REDUCE_MOTION ? 1 : 0;
        const start = performance.now();

        function frame(now) {
            if (chart.$destroyed) return;

            chart.$reveal = Math.min((now - start) / REVEAL_DURATION, 1);
            chart.draw();

            if (chart.$reveal < 1) requestAnimationFrame(frame);
        }

        if (!REDUCE_MOTION) requestAnimationFrame(frame);
    },

    beforeDatasetsDraw(chart) {
        const left = chart.chartArea.left - 10;
        const width = (chart.width - left) * chart.$reveal;

        chart.ctx.save();
        chart.ctx.beginPath();
        chart.ctx.rect(left, 0, width, chart.height);
        chart.ctx.clip();
    },

    afterDatasetsDraw(chart) {
        chart.ctx.restore();
    },

    afterDestroy(chart) {
        chart.$destroyed = true;
    },
};

Chart.register(pointLabels, revealFromLeft);


/* --- Bausteine für die Grafiken --- */

function yAxis(min, max, stepSize, format = formatNumber, color, gridColor = COLORS.grid) {
    return {
        min: min,
        max: max,
        ticks: { stepSize: stepSize, color: color, callback: format },
        grid: { color: gridColor },
        border: { display: false },
    };
}

function drawChart(canvasId, createChart) {
    Chart.getChart(canvasId)?.destroy();
    createChart();
}

// Grafik erst zeichnen, wenn sie ganz sichtbar ist
function setupChart(canvasId, createChart) {
    const box = document.getElementById(canvasId).parentElement;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].intersectionRatio >= 0.99) {
            drawChart(canvasId, createChart);
            observer.disconnect();
        }
    }, { threshold: 0.99 });

    observer.observe(box);

    const replay = box.closest('figure').querySelector('.replay');
    if (replay) {
        replay.addEventListener('click', () => drawChart(canvasId, createChart));
    }
}


/* --- Daten: Platzhalter, bis php/unload.php geladen ist (werden dann ersetzt) --- */
let rows2018 = [
    { year: 2018, registered_dogs: 502308, total_dogs_shelter: 2156, animal_shelter: 42 },
    { year: 2025, registered_dogs: 552538, total_dogs_shelter: 1288, animal_shelter: 91 },
];
let shelterRows = [
    { year: 2016, animal_shelter: 11 },
    { year: 2018, animal_shelter: 42 },
    { year: 2025, animal_shelter: 91 },
];
let realChange = -40;   // Veränderung der Heimhunde seit 2018, für die Schätzfrage
let tipp = null;        // Tipp aus der Schätzfrage


/* --- Grafik 1: Der Widerspruch (Veränderung seit 2018 in Prozent) --- */
let highlight = 'beide';

function lineColor(color, key) {
    return highlight === 'beide' || highlight === key ? color : 'rgba(243, 239, 231, 0.15)';
}

function createWiderspruchChart() {
    const base = rows2018[0];
    const lastIndex = rows2018.length - 1;
    const land = rows2018.map(row => percentChange(base.registered_dogs, row.registered_dogs));
    const heim = rows2018.map(row => percentChange(base.total_dogs_shelter, row.total_dogs_shelter));

    const labels = [
        { datasetIndex: 0, index: lastIndex, text: formatPercent(land[lastIndex]), position: 'right', color: COLORS.peach },
        { datasetIndex: 1, index: lastIndex, text: formatPercent(heim[lastIndex]), position: 'right' },
    ];

    /** @type {Object[]} */
    const datasets = [
        { label: 'Hunde im Land', key: 'land', data: land, borderColor: lineColor(COLORS.peach, 'land'), backgroundColor: COLORS.peach },
        { label: 'Hunde im Heim', key: 'heim', data: heim, borderColor: lineColor(COLORS.cream, 'heim'), backgroundColor: COLORS.cream },
    ].map(dataset => ({ ...dataset, borderWidth: 3, tension: 0.3, pointRadius: 3 }));

    if (tipp !== null) {
        datasets.push({
            label: 'Ihr Tipp',
            data: rows2018.map((row, index) => index === lastIndex ? tipp : null),
            pointRadius: 7,
            pointBackgroundColor: 'transparent',
            pointBorderColor: COLORS.cream,
            pointBorderWidth: 2,
            showLine: false,
        });
        labels.push({ datasetIndex: 2, index: lastIndex, text: 'Ihr Tipp', position: 'aboveLeft' });
    }

    return new Chart(document.getElementById('chart-widerspruch'), {
        type: 'line',
        data: { labels: rows2018.map(row => row.year), datasets: datasets },
        options: {
            layout: { padding: { top: 16, right: 60 } },
            plugins: {
                pointLabels: { labels: labels },
                tooltip: {
                    callbacks: { label: (context) => `${context.dataset.label}: ${formatPercent(context.parsed.y)}` },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0 } },
                y: yAxis(-50, 20, 10, (value) => value === 0 ? 'Stand 2018' : formatPercent(value)),
            },
        },
    });
}

const lineButtons = document.querySelectorAll('[data-line]');

lineButtons.forEach(button => button.addEventListener('click', () => {
    highlight = button.dataset.line;
    pressButton(lineButtons, button);

    const chart = Chart.getChart('chart-widerspruch');
    if (!chart) return;

    chart.data.datasets[0].borderColor = lineColor(COLORS.peach, 'land');
    chart.data.datasets[1].borderColor = lineColor(COLORS.cream, 'heim');
    chart.update('none');
}));


/* --- Grafik 2: Die falsche Spur (Tierheime pro Jahr) --- */
let startYear = 2016;

function barColors() {
    return shelterRows.map((row, index) => {
        if (row.year < startYear) return 'rgba(243, 239, 231, 0.15)';
        if (row.year === startYear) return COLORS.orange;
        if (index === shelterRows.length - 1) return COLORS.peach;
        return 'rgba(243, 239, 231, 0.6)';
    });
}

function updateHeimeText() {
    const start = shelterRows.find(row => row.year === startYear);
    const last = shelterRows[shelterRows.length - 1];

    setText('heime-prozent', formatPercent(percentChange(start.animal_shelter, last.animal_shelter)));
    setText('heime-text', `von ${start.animal_shelter} auf ${last.animal_shelter} Heime`);
}

function createHeimeChart() {
    const values = shelterRows.map(row => row.animal_shelter);

    return new Chart(document.getElementById('chart-heime'), {
        type: 'bar',
        data: {
            labels: shelterRows.map(row => row.year),
            datasets: [{ data: values, backgroundColor: barColors(), borderRadius: 4 }],
        },
        options: {
            layout: { padding: { top: 50 } },
            plugins: {
                pointLabels: {
                    labels: [
                        ...values.map((value, index) => ({ index: index, text: String(value), position: 'above' })),
                        { index: 0, text: 'AMICUS-Start', position: 'high', color: COLORS.peach },
                    ],
                },
                tooltip: { callbacks: { label: (context) => `${context.parsed.y} Tierheime` } },
            },
            scales: {
                x: { grid: { display: false } },
                y: yAxis(0, 100, 25),
            },
        },
    });
}

const startButtons = document.querySelectorAll('[data-start]');

startButtons.forEach(button => button.addEventListener('click', () => {
    startYear = Number(button.dataset.start);
    pressButton(startButtons, button);
    updateHeimeText();

    const chart = Chart.getChart('chart-heime');
    if (!chart) return;

    chart.data.datasets[0].backgroundColor = barColors();
    chart.update('none');
}));


/* --- Grafik 3: Die Auflösung (Aufnahmen STS vs. Bestand) --- */
function createStsChart() {
    const bestand = rows2018[rows2018.length - 1].total_dogs_shelter;
    const labels = [...STS.labels, 'Bestand Dez. 2025'];
    const rest = STS.total.map((total, index) => STS.verzicht[index] ? total - STS.verzicht[index] : null);

    return new Chart(document.getElementById('chart-sts'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Freiwillig abgegeben', data: [...STS.verzicht, null], backgroundColor: COLORS.cream },
                { label: 'Findel- und beschlagnahmte Hunde', data: [...rest, null], backgroundColor: COLORS.peach },
                { label: 'Aufnahmen, Aufteilung offen', data: [null, null, STS.total[2], null], backgroundColor: 'rgba(243, 239, 231, 0.4)' },
                { label: 'Bestand in allen Heimen', data: [null, null, null, bestand], backgroundColor: COLORS.bordeaux },
            ],
        },
        options: {
            indexAxis: 'y',
            layout: { padding: { right: 50 } },
            interaction: { mode: 'nearest', intersect: true },
            plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 12, color: COLORS.cream } },
                pointLabels: {
                    labels: [
                        { datasetIndex: 1, index: 0, text: formatNumber(STS.total[0]), position: 'right' },
                        { datasetIndex: 1, index: 1, text: formatNumber(STS.total[1]), position: 'right' },
                        { datasetIndex: 2, index: 2, text: formatNumber(STS.total[2]), position: 'right' },
                        { datasetIndex: 3, index: 3, text: formatNumber(bestand), position: 'right' },
                    ],
                },
                tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.x)}` } },
            },
            scales: {
                x: { stacked: true, max: 2000, grid: { color: COLORS.grid }, border: { display: false } },
                y: { stacked: true, grid: { display: false } },
            },
        },
    });
}


/* --- Schätzfrage --- */
const guess = document.getElementById('guess');
const pinTipp = document.getElementById('pin-tipp');
const pinReal = document.getElementById('pin-real');

function pinPosition(value) {
    return `${(value + 60) / 120 * 100}%`;
}

guess.addEventListener('input', () => {
    pinTipp.style.left = pinPosition(Number(guess.value));
    pinTipp.textContent = `Ihr Tipp: ${formatPercent(Number(guess.value))}`;
});

document.getElementById('guess-button').addEventListener('click', (event) => {
    tipp = Number(guess.value);
    guess.disabled = true;
    event.currentTarget.disabled = true;

    pinReal.style.opacity = '1';
    pinReal.style.left = pinPosition(realChange);

    const difference = Math.abs(tipp - realChange);
    const fact = `Die Zahl der Heimhunde ist um rund ${Math.abs(realChange)} Prozent gesunken, obwohl es im Land mehr Hunde gibt.`;
    setText('guess-result', difference === 0
        ? `Genau getroffen! ${fact}`
        : `Sie lagen ${difference} Prozentpunkte ${tipp > realChange ? 'zu hoch' : 'zu tief'}. ${fact}`);

    const echo = document.getElementById('guess-echo');
    echo.textContent = `Ihr Tipp im Prolog: ${formatPercent(tipp)}. Beim Bestand sind es ${formatPercent(realChange)}. Die Aufnahmen erzählen eine andere Geschichte.`;
    echo.hidden = false;

    if (Chart.getChart('chart-widerspruch')) drawChart('chart-widerspruch', createWiderspruchChart);

    document.getElementById('guess-replay').hidden = false;
});

document.getElementById('guess-replay').addEventListener('click', (event) => {
    tipp = null;
    guess.disabled = false;
    guess.value = 0;
    document.getElementById('guess-button').disabled = false;

    pinTipp.style.left = pinPosition(0);
    pinTipp.textContent = 'Ihr Tipp: ±0 %';
    pinReal.style.opacity = '0';
    pinReal.style.left = pinPosition(0);

    setText('guess-result', '');
    document.getElementById('guess-echo').hidden = true;
    event.currentTarget.hidden = true;

    if (Chart.getChart('chart-widerspruch')) drawChart('chart-widerspruch', createWiderspruchChart);
});


/* --- Navigation: dunkle Pille hinter dem aktuellen Kapitel --- */
const nav = document.querySelector('.nav');
const navPill = document.querySelector('.nav-pill');
const navLinks = document.querySelectorAll('.nav a');
const sections = [...navLinks].map(link => document.querySelector(link.getAttribute('href')));

let lastActiveIndex = -1;

function updateNav() {
    const readingLine = window.innerHeight * 0.4;
    let activeIndex = -1;

    sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= readingLine) {
            activeIndex = index;
        }
    });

    navLinks.forEach((link, index) => {
        link.classList.toggle('is-active', index === activeIndex);
    });

    if (activeIndex === -1) {
        navPill.classList.remove('is-visible');
        lastActiveIndex = -1;
        return;
    }

    const activeLink = navLinks[activeIndex];
    navPill.style.top = `${activeLink.offsetTop}px`;
    navPill.style.height = `${activeLink.offsetHeight}px`;
    navPill.style.width = `${activeLink.offsetWidth}px`;
    navPill.style.transform = `translateX(${activeLink.offsetLeft}px)`;
    navPill.classList.add('is-visible');

    if (activeIndex !== lastActiveIndex) {
        nav.scrollTo({ left: activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2 });
        lastActiveIndex = activeIndex;
    }
}

window.addEventListener('scroll', updateNav, { passive: true });
window.addEventListener('resize', updateNav);
updateNav();


/* --- Pfotenspur: erscheint vor dem Leser, verblasst hinter ihm --- */
const trail = document.getElementById('trail');
let paws = [];

function buildTrail() {
    trail.style.height = '0px';
    const height = document.documentElement.scrollHeight;
    const width = document.documentElement.clientWidth;
    trail.style.height = `${height}px`;
    trail.innerHTML = '';
    paws = [];

    // Kästen (Grafiken, Karten, Fotos): dort soll keine Pfote liegen
    const boxes = [...document.querySelectorAll('.chart-card, .info-card, .list-card, details, .polaroids, .sim, .button')]
        .map(box => {
            const r = box.getBoundingClientRect();
            return { left: r.left - 24, right: r.right + 24, top: r.top + window.scrollY - 24, bottom: r.bottom + window.scrollY + 24 };
        });

    // Breite des Inhalts (wie .container)
    const edge = Math.max(16, (width - 1120) / 2 + 32);

    // Freier Platz auf dieser Höhe: der breiteste Bereich ohne Kasten, also meist die Textspalte
    function freeSpace(y) {
        let parts = [[edge, width - edge]];
        boxes.filter(b => y > b.top && y < b.bottom).forEach(b => {
            parts = parts.flatMap(([from, to]) => [[from, Math.min(to, b.left)], [Math.max(from, b.right), to]])
                .filter(([from, to]) => to - from > 0);
        });
        return parts.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
    }

    for (let y = 600, i = 0; y < height - 200; y += 120, i++) {
        const space = freeSpace(y);
        if (!space || space[1] - space[0] < 80) continue;   // kein Platz: Pfote auslassen

        // in einer sanften Welle durch den freien Bereich, abwechselnd links und rechts
        const side = i % 2 ? 16 : -16;
        const middle = (space[0] + space[1]) / 2;
        const swing = (space[1] - space[0]) / 2 - 40;
        const x = middle + Math.sin(y / 500) * swing * 0.7 + side;

        const paw = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        paw.innerHTML = '<use href="#paw"/>';
        paw.style.left = `${x}px`;
        paw.style.top = `${y}px`;
        paw.style.setProperty('--r', `${180 + Math.cos(y / 500) * 30 + side / 2}deg`);
        trail.appendChild(paw);
        paws.push({ element: paw, y: y });
    }

    updateTrail();
}

function updateTrail() {
    const front = window.scrollY + window.innerHeight * 0.8;   // hier erscheinen Pfoten
    const back = front - window.innerHeight * 1.1;              // dahinter verblassen sie

    paws.forEach(paw => {
        paw.element.classList.toggle('on', paw.y < front && paw.y > back);
        paw.element.classList.toggle('gone', paw.y <= back);
    });
}

window.addEventListener('scroll', updateTrail, { passive: true });
window.addEventListener('resize', buildTrail);
window.addEventListener('load', buildTrail);

let trailTimer;
new ResizeObserver(() => {
    clearTimeout(trailTimer);
    trailTimer = setTimeout(buildTrail, 200);
}).observe(document.querySelector('main'));


/* --- Simulation: ein Tierheim im Zeitraffer --- */
const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');
const hardInput = document.getElementById('hard');

let dogs = [];
let arrivals = 0;
let lastTime = 0;
let spawnTimer = 0;
let visible = false;
let flash = 0;

function resizeCanvas() {
    const box = canvas.getBoundingClientRect();
    canvas.width = box.width * devicePixelRatio;
    canvas.height = box.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

function shelterBox() {
    const box = canvas.getBoundingClientRect();
    return { x: box.width * 0.26, y: 40, width: box.width * 0.48, height: box.height - 56, canvasWidth: box.width, canvasHeight: box.height };
}

function drawDog(x, y, size, fur, ear) {
    ctx.fillStyle = ear;
    ctx.beginPath(); ctx.ellipse(x - size * 0.85, y, size * 0.38, size * 0.75, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + size * 0.85, y, size * 0.38, size * 0.75, -0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath(); ctx.ellipse(x, y + size * 0.42, size * 0.52, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.bordeaux;
    ctx.beginPath(); ctx.arc(x - size * 0.38, y - size * 0.12, size * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + size * 0.38, y - size * 0.12, size * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y + size * 0.24, size * 0.2, size * 0.14, 0, 0, Math.PI * 2); ctx.fill();
}

function addDog() {
    const shelter = shelterBox();
    const staysLong = Math.random() * 100 < Number(hardInput.value);

    dogs.push({
        x: -12,
        y: shelter.canvasHeight / 2,
        targetX: shelter.x + 18 + Math.random() * (shelter.width - 36),
        targetY: shelter.y + 18 + Math.random() * (shelter.height - 36),
        state: 'kommt',
        staysLong: staysLong,
        stay: staysLong ? 24 + Math.random() * 14 : 1.6 + Math.random() * 2.4,   // Sekunden im Heim
        time: 0,
    });
    arrivals++;
}

function moveDogs(seconds) {
    const shelter = shelterBox();

    spawnTimer += seconds;
    if (spawnTimer > 0.55) {
        spawnTimer = 0;
        addDog();
    }

    dogs.forEach(dog => {
        if (dog.state === 'kommt' || dog.state === 'geht') {
            dog.x += (dog.targetX - dog.x) * seconds * 3 + (dog.state === 'geht' ? 40 * seconds : 0);
            dog.y += (dog.targetY - dog.y) * seconds * 3;
            if (dog.state === 'kommt' && Math.abs(dog.targetX - dog.x) < 2) dog.state = 'im Heim';
        } else {
            dog.time += seconds;
            if (dog.time > dog.stay) {
                dog.state = 'geht';
                dog.targetX = shelter.canvasWidth + 30;
                dog.targetY = shelter.canvasHeight / 2;
            }
        }
    });

    dogs = dogs.filter(dog => dog.x < shelter.canvasWidth + 20);
}

function drawSimulation() {
    const shelter = shelterBox();
    ctx.clearRect(0, 0, shelter.canvasWidth, shelter.canvasHeight);

    ctx.strokeStyle = COLORS.bordeaux;
    ctx.lineWidth = 2;
    ctx.strokeRect(shelter.x, shelter.y, shelter.width, shelter.height);

    ctx.fillStyle = COLORS.brown;
    ctx.font = 'bold 13px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ankunft', shelter.x / 2, 26);
    ctx.fillText('Tierheim', shelter.x + shelter.width / 2, 26);
    ctx.fillText('Neues Zuhause', shelter.x + shelter.width + (shelter.canvasWidth - shelter.x - shelter.width) / 2, 26);

    dogs.forEach(dog => {
        if (dog.staysLong) drawDog(dog.x, dog.y, 11, COLORS.brown, COLORS.bordeaux);
        else drawDog(dog.x, dog.y, 9, COLORS.peach, COLORS.orange);
    });

    if (flash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.7})`;
        ctx.fillRect(shelter.x, shelter.y, shelter.width, shelter.height);
    }

    setText('count-bestand', dogs.filter(dog => dog.state !== 'geht').length);
    setText('count-aufnahmen', arrivals);
}

function frame(now) {
    const seconds = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (visible && !REDUCE_MOTION) {
        moveDogs(seconds);
        flash = Math.max(0, flash - seconds * 1.2);
    }

    drawSimulation();
    requestAnimationFrame(frame);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(frame);

new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(canvas);

function setHard(value) {
    hardInput.value = value;
    setText('hard-value', `${value} %`);
}

hardInput.addEventListener('input', () => setHard(hardInput.value));

const steps = document.querySelectorAll('.step');

const stepObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const step = entry.target;

        steps.forEach(other => other.classList.toggle('is-active', other === step));
        setHard(step.dataset.hard);

        const mark = step.dataset.mark;
        document.getElementById('pill-bestand').classList.toggle('is-lit', mark === 'bestand' || mark === 'beide');
        document.getElementById('pill-aufnahmen').classList.toggle('is-lit', mark === 'aufnahmen' || mark === 'beide');

        if (step.dataset.foto) flash = 1;
    });
}, { rootMargin: '-45% 0px -45% 0px' });

steps.forEach(step => stepObserver.observe(step));


/* --- Hundebilder --- */

const BREEDS = {
    'mountain-bernese': 'Berner Sennenhund',
    'appenzeller': 'Appenzeller Sennenhund',
    'entlebucher': 'Entlebucher Sennenhund',
    'mix': 'Mischling',
    'chihuahua': 'Chihuahua',
    'pomeranian': 'Zwergspitz',
};

function breedName(url) {
    const slug = (url.split('/breeds/')[1] ?? '').split('/')[0];
    if (BREEDS[slug]) return BREEDS[slug];

    const [breed, sub] = slug.split('-');
    return [sub, breed].filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function showDog(polaroid, url) {
    polaroid.querySelector('img').src = url;
    polaroid.querySelector('img').alt = `Symbolbild: ${breedName(url)}`;
    polaroid.querySelector('.breed').textContent = breedName(url);
}

// Polaroids wie ein Karussell: links = vorheriger Hund, Mitte = aktueller, rechts = nächster.
function setupPolaroids(stack, images) {
    const count = images.length;
    let current = 0;   // Nummer des Hundes in der Mitte
    let busy = false;

    const card = {
        left: stack.querySelector('.polaroid--left'),
        center: stack.querySelector('.polaroid--center'),
        right: stack.querySelector('.polaroid--right'),
    };

    const image = (n) => images[((n % count) + count) % count]['image_dog'];

    function setPosition(element, position) {
        element.classList.remove('polaroid--left', 'polaroid--center', 'polaroid--right');
        element.classList.add(`polaroid--${position}`);
    }

    showDog(card.left, image(current - 1));
    showDog(card.center, image(current));
    showDog(card.right, image(current + 1));

    function turn(direction) {
        if (busy) return;
        busy = true;

        const forward = direction === 'vor';
        const leaving = forward ? card.left : card.right;
        current += forward ? 1 : -1;

        leaving.classList.add(forward ? 'fly-left' : 'fly-right');
        if (forward) {
            setPosition(card.right, 'center');
            setPosition(card.center, 'left');
            [card.left, card.center, card.right] = [card.center, card.right, leaving];
        } else {
            setPosition(card.left, 'center');
            setPosition(card.center, 'right');
            [card.left, card.center, card.right] = [leaving, card.left, card.center];
        }

        setTimeout(() => {
            leaving.classList.add('enter');
            leaving.classList.remove('fly-left', 'fly-right');
            setPosition(leaving, forward ? 'right' : 'left');
            showDog(leaving, image(forward ? current + 1 : current - 1));

            leaving.offsetWidth;   // Browser neu rechnen lassen, damit das Einblenden startet
            leaving.classList.remove('enter');
            busy = false;
        }, REDUCE_MOTION ? 0 : 500);
    }

    stack.addEventListener('click', (event) => {
        const clicked = event.target.closest('.polaroid');
        turn(clicked === card.left ? 'zurück' : 'vor');
    });

    stack.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') turn('zurück');
        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            turn('vor');
        }
    });
}


/* --- Start: Daten laden, Zahlen und Grafiken einsetzen --- */
try {
    const data = await loadData(ENDPUNKT);

    const december = data.filter(row => row.month === 12);
    const since2018 = december.filter(row => row.year >= 2018);
    const last = december[december.length - 1];

    rows2018 = since2018;
    shelterRows = december;
    realChange = Math.round(percentChange(since2018[0].total_dogs_shelter, last.total_dogs_shelter));

    setText('kpi-bestand', formatNumber(last.total_dogs_shelter));
    setText('pin-real', `Tatsächlich: ${formatPercent(realChange)}`);
} catch (error) {
    console.error('Daten konnten nicht geladen werden:', error);
}

updateHeimeText();
const toTop = document.getElementById('to-top');
function updateToTop() {
    toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight);
}
window.addEventListener('scroll', updateToTop, { passive: true });
updateToTop();

setupChart('chart-widerspruch', createWiderspruchChart);
setupChart('chart-heime', createHeimeChart);
setupChart('chart-sts', createStsChart);
buildTrail();

try {
    const images = await loadData(`${ENDPUNKT}?dataset=images`);
    setupPolaroids(document.getElementById('polaroids'), images);
} catch (error) {
    console.error('Bilder konnten nicht geladen werden:', error);
}
