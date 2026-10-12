const ENDPUNKT = 'php/unload.php';

const COLORS = {
    cream: '#f3efe7',
    bordeaux: '#3b0f0f',
    orange: '#c9592f',
    peach: '#f2b48a',
    grid: 'rgba(243, 239, 231, 0.12)',
};

// Dauer der Zeichen-Animation in Millisekunden
const REVEAL_DURATION = 2000;


/* --- Hilfsfunktionen --- */
async function loadData(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Endpunkt antwortet mit Status ${response.status}`);
    }

    return response.json();
}

// 552538 → 552’538
function formatNumber(number) {
    return number.toLocaleString('de-CH');
}

function percentChange(start, end) {
    return (end - start) / start * 100;
}

// 9.7 → "+10 %", −40.3 → "−40 %"
function formatPercent(percent) {
    const rounded = Math.round(percent);

    if (rounded > 0) return `+${rounded} %`;
    if (rounded < 0) return `−${Math.abs(rounded)} %`;
    return '0 %';
}

function setText(id, text) {
    document.getElementById(id).textContent = text;
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
// Verschiebung des Textes je nach Position: [Ausrichtung, x, y]
const LABEL_POSITIONS = {
    above:      ['center',  0, -14],
    aboveLeft:  ['right',   6, -14],
    aboveRight: ['left',   -6, -14],
    below:      ['center',  0,  22],
    belowLeft:  ['right',   6,  22],
    belowRight: ['left',   10,  20],
    right:      ['left',   10,   4],
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
        chart.$reveal = 0;
        const start = performance.now();

        function frame(now) {
            if (chart.$destroyed) return;

            chart.$reveal = Math.min((now - start) / REVEAL_DURATION, 1);
            chart.draw();

            if (chart.$reveal < 1) requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    },

    // Nur den Teil links vom "Vorhang" zeichnen
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

// Reihenfolge wichtig: Beschriftungen werden mit aufgedeckt
Chart.register(pointLabels, revealFromLeft);


/* --- Bausteine für die Grafiken --- */

// Fläche unter der Linie: oben kräftig, unten durchsichtig
function gradientFill(rgb) {
    return (context) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return null;

        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, `rgba(${rgb}, 0.7)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0)`);
        return gradient;
    };
}

// y-Achse mit Hilfslinien, ohne senkrechte Linie
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

// Grafik erst zeichnen, wenn sie ganz sichtbar ist.
// Der Button "Nochmals abspielen" zeichnet sie neu.
function setupChart(canvasId, createChart) {
    const box = document.getElementById(canvasId).parentElement;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].intersectionRatio >= 0.99) {
            drawChart(canvasId, createChart);
            observer.disconnect();
        }
    }, { threshold: 0.99 });

    observer.observe(box);

    document.querySelector(`.replay[data-chart="${canvasId}"]`)
        .addEventListener('click', () => drawChart(canvasId, createChart));
}


/* --- Grafik 1: eine Linie (Hunde-Fieber, Die Karte) --- */
function createLineChart(settings) {
    return new Chart(document.getElementById(settings.canvasId), {
        type: 'line',
        data: {
            labels: settings.labels,
            datasets: [{
                data: settings.values,
                borderColor: COLORS.cream,
                borderWidth: 3,
                backgroundColor: gradientFill(settings.fillRgb),
                fill: true,
                pointBackgroundColor: COLORS.bordeaux,
                pointBorderColor: COLORS.cream,
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
            }],
        },
        options: {
            layout: { padding: { top: 24, right: 16 } },
            plugins: {
                pointLabels: { labels: settings.pointLabels },
                tooltip: {
                    callbacks: {
                        label: (context) => `${formatNumber(context.parsed.y)} ${settings.unit}`,
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0 } },
                y: yAxis(settings.y.min, settings.y.max, settings.y.stepSize),
            },
        },
    });
}


/* --- Grafik 2: Im Tierheim, alle Monate --- */
function createShelterChart(months) {
    const values = months.map(row => row.total_dogs_shelter);
    const labels = months.map(row =>
        new Date(row.year, row.month - 1).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' }));

    const peakIndex = values.indexOf(Math.max(...values));
    const lastIndex = values.length - 1;

    return new Chart(document.getElementById('chart-tierheim'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                borderColor: COLORS.cream,
                borderWidth: 2.5,
                backgroundColor: gradientFill('243, 239, 231'),
                fill: true,
                tension: 0.2,
                // Punkt nur beim Höchststand und beim letzten Wert
                pointRadius: (context) => [peakIndex, lastIndex].includes(context.dataIndex) ? 5 : 0,
                pointBackgroundColor: COLORS.peach,
                pointBorderWidth: 0,
                pointHoverRadius: 5,
            }],
        },
        options: {
            layout: { padding: { top: 24, right: 56 } },
            plugins: {
                pointLabels: {
                    labels: [
                        { index: peakIndex, text: `Höchststand: ${formatNumber(values[peakIndex])}`, position: 'aboveRight' },
                        { index: lastIndex, text: formatNumber(values[lastIndex]), position: 'right' },
                    ],
                },
                tooltip: {
                    callbacks: {
                        label: (context) => `${formatNumber(context.parsed.y)} Hunde im Heim`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        // Nur Januar in geraden Jahren beschriften: 2016, 2018, …
                        callback: (value, index) => {
                            const row = months[index];
                            return row.month === 1 && row.year % 2 === 0 ? row.year : null;
                        },
                    },
                },
                y: yAxis(0, 2500, 500),
            },
        },
    });
}


/* --- Grafik 3: Veränderung seit 2018 in Prozent (Prolog, Paradoxon 1) --- */
function createChangeChart(settings) {
    const rows = settings.rows;
    const base = rows[0];
    const lastIndex = rows.length - 1;

    const datasets = settings.series.map(serie => ({
        label: serie.label,
        data: rows.map(row => percentChange(base[serie.key], row[serie.key])),
        absolute: rows.map(row => row[serie.key]),
        unit: serie.unit,
        borderColor: serie.color,
        backgroundColor: serie.color,
        borderWidth: 3,
        tension: 0.3,
        pointRadius: settings.showPoints ? 4 : 0,
        pointHoverRadius: 5,
    }));

    // Gestrichelte Linie bei 0 % = Stand 2018
    datasets.push({
        label: 'Stand 2018',
        data: rows.map(() => 0),
        borderColor: settings.textColor,
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        isBaseline: true,
    });

    // Endwert rechts neben jeder Linie
    const labels = settings.series.map((serie, index) => ({
        datasetIndex: index,
        index: lastIndex,
        text: formatPercent(datasets[index].data[lastIndex]),
        position: 'right',
        color: serie.labelColor ?? serie.color,
    }));

    return new Chart(document.getElementById(settings.canvasId), {
        type: 'line',
        data: {
            labels: rows.map(row => row.year),
            datasets: datasets,
        },
        options: {
            layout: { padding: { top: 10, right: 60 } },
            plugins: {
                pointLabels: { labels: labels },
                legend: {
                    display: settings.showLegend,
                    position: 'top',
                    align: 'start',
                    labels: {
                        color: settings.textColor,
                        usePointStyle: true,
                        pointStyle: 'line',
                        filter: (item, data) => !data.datasets[item.datasetIndex].isBaseline,
                    },
                },
                tooltip: {
                    filter: (item) => !item.dataset.isBaseline,
                    callbacks: {
                        // z. B. "Hunde im Heim: −40 % (1’288 Hunde)"
                        label: (context) => {
                            const percent = formatPercent(context.parsed.y);
                            const absolute = formatNumber(context.dataset.absolute[context.dataIndex]);
                            return `${context.dataset.label}: ${percent} (${absolute} ${context.dataset.unit})`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: settings.textColor, maxRotation: 0 },
                },
                y: yAxis(
                    settings.y.min, settings.y.max, settings.y.stepSize,
                    (value) => value === 0 ? 'Stand 2018' : formatPercent(value),
                    settings.textColor, settings.gridColor,
                ),
            },
        },
    });
}


/* --- Grafik 4: Hunde pro Tierheim als liegende Balken (Paradoxon 2) --- */
function createProHeimChart(rows) {
    const values = rows.map(row => Math.round(row.total_dogs_shelter / row.animal_shelter));

    return new Chart(document.getElementById('chart-pro-heim'), {
        type: 'bar',
        data: {
            labels: rows.map(row => row.year),
            datasets: [{
                data: values,
                backgroundColor: COLORS.peach,
                borderRadius: 4,
                barPercentage: 0.75,
            }],
        },
        options: {
            indexAxis: 'y',
            layout: { padding: { right: 36 } },
            interaction: { mode: 'index', axis: 'y', intersect: false },
            plugins: {
                pointLabels: {
                    labels: values.map((value, index) => ({ index: index, text: String(value), position: 'right' })),
                },
                tooltip: {
                    callbacks: {
                        // z. B. "51 Hunde pro Heim (2’156 Hunde ÷ 42 Heime)"
                        label: (context) => {
                            const row = rows[context.dataIndex];
                            return `${context.parsed.x} Hunde pro Heim (${formatNumber(row.total_dogs_shelter)} Hunde ÷ ${row.animal_shelter} Heime)`;
                        },
                    },
                },
            },
            scales: {
                x: { display: false, beginAtZero: true },
                y: { grid: { display: false }, border: { display: false } },
            },
        },
    });
}


/* --- Navigation: dunkle Pille hinter dem aktuellen Kapitel --- */
const nav = document.querySelector('.nav');
const navPill = document.querySelector('.nav-pill');
const navLinks = document.querySelectorAll('.nav a');
const sections = [...navLinks].map(link => document.querySelector(link.getAttribute('href')));

let lastActiveIndex = -1;

function updateNav() {
    // Aktiv ist der letzte Abschnitt, der über 40 % der Fensterhöhe gescrollt ist
    const readingLine = window.innerHeight * 0.4;
    let activeIndex = -1;

    sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= readingLine) {
            activeIndex = index;
        }
    });

    // Ganz unten: Fazit aktiv
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        activeIndex = sections.length - 1;
    }

    navLinks.forEach((link, index) => {
        link.classList.toggle('is-active', index === activeIndex);
    });

    // Im Hero: keine Pille
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

    // Handy: aktives Kapitel in die Mitte der Navigation wischen
    if (activeIndex !== lastActiveIndex) {
        nav.scrollTo({ left: activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2 });
        lastActiveIndex = activeIndex;
    }
}

window.addEventListener('scroll', updateNav, { passive: true });
window.addEventListener('resize', updateNav);
updateNav();


/* --- Start: Daten laden, Zahlen und Grafiken einsetzen --- */
try {
    const data = await loadData(ENDPUNKT);

    // Eine Zeile pro Jahr: jeweils Dezember
    const december = data.filter(row => row.month === 12);
    const since2018 = december.filter(row => row.year >= 2018);

    const first = december[0];
    const base = since2018[0];
    const last = december[december.length - 1];

    // Kennzahlen
    setText('kpi-land', formatNumber(last.registered_dogs));
    setText('kpi-land-date', `Dezember ${last.year}`);

    setText('kpi-heim', formatNumber(last.total_dogs_shelter));
    setText('kpi-heim-date', `Dezember ${last.year}`);

    setText('kpi-p1-land', formatPercent(percentChange(base.registered_dogs, last.registered_dogs)));
    setText('kpi-p1-heim', formatPercent(percentChange(base.total_dogs_shelter, last.total_dogs_shelter)));

    setText('kpi-heime', last.animal_shelter);
    setText('kpi-heime-date', last.year);
    setText('kpi-heime-start', first.animal_shelter);
    setText('kpi-heime-end', last.animal_shelter);

    setText('kpi-pro-heim-start', Math.round(base.total_dogs_shelter / base.animal_shelter));
    setText('kpi-pro-heim-end', Math.round(last.total_dogs_shelter / last.animal_shelter));

    // Grafiken
    setupChart('chart-prolog', () => createChangeChart({
        canvasId: 'chart-prolog',
        rows: since2018,
        series: [
            { label: 'Tierheime', key: 'animal_shelter', unit: 'Heime', color: COLORS.bordeaux },
            { label: 'Hunde im Heim', key: 'total_dogs_shelter', unit: 'Hunde', color: COLORS.cream, labelColor: COLORS.bordeaux },
        ],
        showLegend: true,
        showPoints: false,
        textColor: COLORS.bordeaux,
        gridColor: 'rgba(59, 15, 15, 0.15)',
        y: { min: -50, max: 150, stepSize: 50 },
    }));

    const maxDogs = Math.max(...december.map(row => row.registered_dogs));
    const maxIndex = december.findIndex(row => row.registered_dogs === maxDogs);

    setupChart('chart-hunde-land', () => createLineChart({
        canvasId: 'chart-hunde-land',
        labels: december.map(row => row.year),
        values: december.map(row => row.registered_dogs),
        unit: 'Hunde',
        fillRgb: '243, 239, 231',
        y: { min: 450000, max: 575000, stepSize: 25000 },
        pointLabels: [
            { index: 0, text: formatNumber(first.registered_dogs), position: 'belowRight' },
            { index: maxIndex, text: `Höchststand ${december[maxIndex].year}: ${formatNumber(maxDogs)}`, position: 'aboveLeft' },
            { index: december.length - 1, text: formatNumber(last.registered_dogs), position: 'belowLeft' },
        ],
    }));

    setupChart('chart-tierheim', () => createShelterChart(data));

    setupChart('chart-p1', () => createChangeChart({
        canvasId: 'chart-p1',
        rows: since2018,
        series: [
            { label: 'Hunde im Land', key: 'registered_dogs', unit: 'Hunde', color: COLORS.peach },
            { label: 'Hunde im Heim', key: 'total_dogs_shelter', unit: 'Hunde', color: COLORS.cream },
        ],
        showLegend: false,
        showPoints: true,
        textColor: 'rgba(243, 239, 231, 0.75)',
        gridColor: COLORS.grid,
        y: { min: -50, max: 20, stepSize: 10 },
    }));

    setupChart('chart-heime', () => createLineChart({
        canvasId: 'chart-heime',
        labels: december.map(row => row.year),
        values: december.map(row => row.animal_shelter),
        unit: 'Tierheime',
        fillRgb: '201, 89, 47',
        y: { min: 0, max: 100, stepSize: 25 },
        pointLabels: [
            { index: 0, text: String(first.animal_shelter), position: 'belowRight' },
            { index: december.length - 1, text: String(last.animal_shelter), position: 'above' },
        ],
    }));

    setupChart('chart-pro-heim', () => createProHeimChart(since2018));
} catch (error) {
    console.error('Daten konnten nicht geladen werden:', error);
}


/* --- Hundebilder --- */

function imageUrl(images, n) {
    const length = images.length;
    return images[((n % length) + length) % length].image_dog;
}

function setupPolaroids(stack, images, start){
    const left = stack.querySelector('.polaroid--left');
    const center = stack.querySelector('.polaroid--center');
    const right = stack.querySelector('.polaroid--right');
    let timer;

    function show() {
        left.querySelector('img').src = imageUrl(images, start);
        center.querySelector('img').src = imageUrl(images, start + 1);
        right.querySelector('img').src = imageUrl(images, start + 2);
    }

    function move(step) {
        start = start + step;
        show();

        clearInterval(timer);
        timer = setInterval(() => move(1), 10000);
    }

    left.addEventListener('click', () => move(-1));
    right.addEventListener('click', () => move(1));

    show();
    timer = setInterval(() => move(1), 10000);
}

try {
    const images = await loadData(`${ENDPUNKT}?dataset=images`);

    document.querySelectorAll('.polaroids').forEach((stack, index) => {
        setupPolaroids(stack, images, index * 3);
    });

    const photo = document.querySelector('.photo-card img');
    let photoIndex = 6;
    photo.src = imageUrl(images, photoIndex);

    setInterval(() => {
        photoIndex = photoIndex + 1;
        photo.src = imageUrl(images, photoIndex);
    }, 10000);
} catch (error) {
    console.error('Bilder konnten nicht geladen werden:', error);
}
