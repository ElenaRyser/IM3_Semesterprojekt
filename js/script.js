/**
 * script.js – holt die Daten von unload.php und bringt sie auf die Seite.
 *
 * Aufbau dieser Datei:
 *   1. Daten holen (loadData) und Hilfsfunktionen zum Formatieren
 *   2. GRAFIKEN: Grundeinstellungen, Bausteine und 4 Grafik-Funktionen
 *   3. NAVIGATION: dunkle Pille zeigt das aktuelle Kapitel
 *   4. START: Daten laden, Kennzahlen einsetzen, Grafiken einrichten, Bilder einsetzen
 */

// Adresse unseres Endpunkts.
// Der Pfad zählt von index.html aus, nicht von dieser Datei aus.
const ENDPUNKT = 'php/unload.php';

// Holt JSON von einer Adresse und gibt es als JavaScript-Liste zurück.
// async/await: fetch() braucht einen Moment, await wartet auf die Antwort.
async function loadData(url) {
    const response = await fetch(url);

    // fetch() meldet bei 404 oder 500 KEINEN Fehler – darum selbst prüfen.
    if (!response.ok) {
        throw new Error(`Der Endpunkt antwortet mit Status ${response.status}.`);
    }

    // Prüfen, ob wirklich JSON zurückkommt (und keine HTML-Fehlerseite).
    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
        throw new Error('Die Antwort ist kein JSON. Öffne unload.php direkt im Browser.');
    }

    // Aus dem JSON-Text wird eine JavaScript-Liste
    return await response.json();
}

// Zahl im Schweizer Format: 552538 wird zu 552’538
function formatNumber(number) {
    return number.toLocaleString('de-CH');
}

// Veränderung in Prozent (nicht gerundet): von 2156 auf 1288 = −40.26
function percentChange(start, end) {
    return (end - start) / start * 100;
}

// Prozentwert gerundet und mit Vorzeichen: 9.7 wird "+10 %", −40.26 wird "−40 %"
function formatPercent(percent) {
    const rounded = Math.round(percent);

    if (rounded === 0) {
        return '0 %';
    }

    const sign = rounded > 0 ? '+' : '−';
    return `${sign}${Math.abs(rounded)} %`;
}

// Veränderung von start zu end als Text: "+10 %" oder "−40 %"
function formatChange(start, end) {
    return formatPercent(percentChange(start, end));
}

// Schreibt einen Text in das HTML-Element mit dieser id
function setText(id, text) {
    document.getElementById(id).textContent = text;
}

// ============================================================================
// GRAFIKEN (Chart.js)
// ============================================================================

// Farben der Grafiken (dieselben wie in style.css)
const COLORS = {
    cream: '#f3efe7',
    bordeaux: '#3b0f0f',
    orange: '#c9592f',
    peach: '#f2b48a',                   // helles Orange für Akzente auf dunklem Grund
    grid: 'rgba(243, 239, 231, 0.12)',  // feine Hilfslinien auf dunklem Grund
};

// Dauer der Animation "von links nach rechts zeichnen" in Millisekunden
const REVEAL_DURATION = 2000;

// --- Grundeinstellungen für ALLE Grafiken -----------------------------------
// So müssen wir das nicht bei jeder Grafik einzeln angeben.

Chart.defaults.font.family = 'Roboto, sans-serif';
Chart.defaults.color = 'rgba(243, 239, 231, 0.75)'; // Achsenbeschriftung: helles Creme
Chart.defaults.maintainAspectRatio = false;          // Höhe kommt aus dem CSS (.chart-box)
Chart.defaults.animation = false;                    // eigene Animation: siehe revealFromLeft

// Tooltip erscheint, sobald die Maus in der Nähe eines Werts ist
// (man muss nicht genau den kleinen Punkt treffen)
Chart.defaults.interaction.mode = 'index';
Chart.defaults.interaction.intersect = false;

// Tooltip: helles Kästchen mit dunkler Schrift, ohne farbiges Kästchen vor dem Text
Chart.defaults.plugins.tooltip.backgroundColor = COLORS.cream;
Chart.defaults.plugins.tooltip.titleColor = COLORS.bordeaux;
Chart.defaults.plugins.tooltip.bodyColor = COLORS.bordeaux;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.displayColors = false;

// Legende standardmässig aus (nur die Prolog-Grafik braucht eine)
Chart.defaults.plugins.legend.display = false;

// --- Bausteine, die alle Grafiken verwenden ---------------------------------

// Plugin: schreibt einzelne Werte direkt an die Grafik, z. B. "91" oder "Höchststand: 2'308".
// Welche Werte, steht bei jeder Grafik unter options.plugins.pointLabels.labels:
//   { index: 9, text: '91', position: 'above' }
//   datasetIndex: welche Linie (Standard 0), color: Schriftfarbe (Standard Creme)
//   position: 'above' (über dem Punkt), 'aboveLeft' (über dem Punkt, nach links),
//             'below', 'belowRight', 'belowLeft' oder 'right' (rechts daneben)
// Chart.js ruft afterDatasetsDraw jedes Mal auf, nachdem die Linien gezeichnet wurden.
const pointLabels = {
    id: 'pointLabels',
    afterDatasetsDraw(chart, args, options) {
        const labels = options.labels ?? [];
        const { ctx } = chart;

        ctx.save();
        ctx.font = 'bold 13px Roboto, sans-serif';

        for (const label of labels) {
            // Der Punkt (bzw. Balken), an den die Beschriftung gehört
            const point = chart.getDatasetMeta(label.datasetIndex ?? 0).data[label.index];
            if (!point) {
                continue;
            }

            const { x, y } = point;
            ctx.fillStyle = label.color ?? COLORS.cream;

            if (label.position === 'right') {
                ctx.textAlign = 'left';
                ctx.fillText(label.text, x + 10, y + 4);
            } else if (label.position === 'below') {
                ctx.textAlign = 'center';
                ctx.fillText(label.text, x, y + 22);
            } else if (label.position === 'belowRight') {
                ctx.textAlign = 'left';
                ctx.fillText(label.text, x + 10, y + 20);
            } else if (label.position === 'belowLeft') {
                ctx.textAlign = 'right';
                ctx.fillText(label.text, x + 6, y + 22);
            } else if (label.position === 'aboveLeft') {
                ctx.textAlign = 'right';
                ctx.fillText(label.text, x + 6, y - 14);
            } else {
                ctx.textAlign = 'center';            // 'above'
                ctx.fillText(label.text, x, y - 14);
            }
        }

        ctx.restore();
    },
};

// Plugin: deckt die Grafik gleichmässig von links nach rechts auf –
// wie ein Vorhang, der zur Seite gezogen wird. So sieht es aus,
// als würde die Linie gezeichnet (bei Balken: als würden sie wachsen).
// Funktionsweise: Vor dem Zeichnen legen wir eine "Schablone" (clip)
// über die Grafik. Nur was links vom Vorhang liegt, wird sichtbar.
// Bei jedem Bild (Frame) rückt der Vorhang ein Stück nach rechts.
const revealFromLeft = {
    id: 'revealFromLeft',

    // Wird einmal aufgerufen, wenn die Grafik erstellt wird: Animation starten
    afterInit(chart) {
        chart.$reveal = 0; // 0 = nichts sichtbar, 1 = alles sichtbar
        const start = performance.now();

        // requestAnimationFrame ruft die Funktion beim nächsten Bild des Bildschirms auf
        // (ca. 60-mal pro Sekunde) – dadurch läuft die Bewegung flüssig.
        const frame = (now) => {
            if (chart.$destroyed) {
                return; // Grafik wurde inzwischen gelöscht (z. B. "Nochmals abspielen")
            }
            // Wie weit sind wir? Gleichmässig von 0 bis 1 (linear)
            chart.$reveal = Math.min((now - start) / REVEAL_DURATION, 1);
            chart.draw();

            if (chart.$reveal < 1) {
                requestAnimationFrame(frame);
            }
        };
        requestAnimationFrame(frame);
    },

    // Vor dem Zeichnen der Linien: Schablone bis zur aktuellen Vorhang-Position
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        // 10 px Zugabe links, damit die runden Punkte am Rand ganz sichtbar sind;
        // rechts zusätzlich Platz für die Beschriftungen neben dem letzten Punkt
        const left = chartArea.left - 10;
        const width = (chart.width - left) * chart.$reveal;

        ctx.save();
        ctx.beginPath();
        ctx.rect(left, 0, width, chart.height);
        ctx.clip();
    },

    // Nach dem Zeichnen der Linien: Schablone wieder wegnehmen
    afterDatasetsDraw(chart) {
        chart.ctx.restore();
    },

    // Grafik wird gelöscht: Animation stoppen
    afterDestroy(chart) {
        chart.$destroyed = true;
    },
};

// Beide Plugins für ALLE Grafiken anmelden.
// Reihenfolge wichtig: pointLabels zuerst, damit auch die Beschriftungen
// erst erscheinen, wenn der "Vorhang" sie erreicht.
Chart.register(pointLabels, revealFromLeft);

// Fläche unter einer Linie: Farbverlauf von oben (kräftig) nach unten (durchsichtig).
// rgb: Farbe als "Rot, Grün, Blau", z. B. '201, 89, 47' für Orange
function gradientFill(rgb) {
    return (context) => {
        const { ctx, chartArea } = context.chart;

        // Beim allerersten Zeichnen ist die Grösse der Grafik noch nicht bekannt
        if (!chartArea) {
            return null;
        }

        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, `rgba(${rgb}, 0.7)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0)`);
        return gradient;
    };
}

// Zeichnet eine Grafik (neu). Gibt es auf dem Canvas schon eine,
// wird sie zuerst gelöscht – so startet die Animation wieder von vorne.
function drawChart(canvasId, createChart) {
    Chart.getChart(canvasId)?.destroy();
    createChart();
}

// Richtet eine Grafik ein:
// 1. Sie wird erst gezeichnet, wenn sie komplett im Bild ist (Animation nur beim ersten Mal).
// 2. Der Button "Nochmals abspielen" zeichnet sie neu.
// canvasId:    id des <canvas>, z. B. 'chart-heime'
// createChart: Funktion, die die Grafik erstellt
function setupChart(canvasId, createChart) {
    // Wir beobachten den Rahmen um das Canvas (.chart-box), nicht das Canvas selbst:
    // Ein leeres Canvas ist 300 px breit und auf dem Handy breiter als der Bildschirm,
    // dann wäre es nie "ganz sichtbar".
    const box = document.getElementById(canvasId).parentElement;

    // Der IntersectionObserver meldet, wie viel vom Element sichtbar ist.
    // threshold 0.99 = "fast 100 %" (ganz genau 1 wird wegen Rundung manchmal nie erreicht)
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].intersectionRatio >= 0.99) {
            drawChart(canvasId, createChart);
            observer.disconnect(); // nicht mehr beobachten: Animation nur beim ersten Mal
        }
    }, { threshold: 0.99 });

    observer.observe(box);

    // Button "Nochmals abspielen": gehört über data-chart="…" zu diesem Canvas
    const replayButton = document.querySelector(`.replay[data-chart="${canvasId}"]`);
    replayButton.addEventListener('click', () => drawChart(canvasId, createChart));
}

// --- Funktion 1: Liniengrafik mit einer Linie ---------------------------------
// Für "Die Karte" (Tierheime) und "Hunde-Fieber" (registrierte Hunde).
// Einstellungen (settings):
//   canvasId     id des <canvas>
//   labels       x-Achse, z. B. [2016, …, 2025]
//   values       y-Werte, z. B. [11, …, 91]
//   unit         Text im Tooltip nach der Zahl, z. B. 'Tierheime'
//   fillRgb      Farbe der Fläche unter der Linie, z. B. '201, 89, 47'
//   y            Achse: { min, max, stepSize }
//   pointLabels  Beschriftungen an der Linie (siehe Plugin pointLabels)
function createLineChart(settings) {
    return new Chart(document.getElementById(settings.canvasId), {
        type: 'line',
        data: {
            labels: settings.labels,
            datasets: [{
                data: settings.values,
                borderColor: COLORS.cream,                  // Linie: Creme
                borderWidth: 3,
                backgroundColor: gradientFill(settings.fillRgb),
                fill: true,                                 // Fläche unter der Linie füllen
                pointBackgroundColor: COLORS.bordeaux,      // Punkte: innen Bordeaux …
                pointBorderColor: COLORS.cream,             // … mit Creme-Rand
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
            }],
        },
        options: {
            // Platz oben und rechts, damit die Beschriftungen nicht abgeschnitten werden
            layout: { padding: { top: 24, right: 16 } },
            plugins: {
                pointLabels: { labels: settings.pointLabels },
                tooltip: {
                    callbacks: {
                        // Text im Tooltip, z. B. "91 Tierheime"
                        label: (context) => `${formatNumber(context.parsed.y)} ${settings.unit}`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },  // keine senkrechten Linien
                    ticks: { maxRotation: 0 }, // Jahre nie schräg (auf dem Handy werden einige ausgelassen)
                },
                y: {
                    min: settings.y.min,
                    max: settings.y.max,
                    ticks: {
                        stepSize: settings.y.stepSize,
                        callback: (value) => formatNumber(value), // 500000 → 500’000
                    },
                    grid: { color: COLORS.grid },
                    border: { display: false }, // keine senkrechte Achsenlinie
                },
            },
        },
    });
}

// --- Funktion 2: "Im Tierheim" – alle Monate als Fläche -----------------------
// Zeigt die Hunde im Tierheim für jeden Monat 2016–2025.
// Hervorgehoben: der Höchststand und der letzte Wert.
// months: alle Monatszeilen aus unload.php
function createShelterChart(months) {
    const values = months.map(row => row.total_dogs_shelter);

    // Monatsname für den Tooltip, z. B. "Dezember 2017"
    const labels = months.map(row =>
        new Date(row.year, row.month - 1).toLocaleDateString('de-CH', { month: 'long', year: 'numeric' }));

    // Wo ist der Höchststand? Und wo der letzte Wert?
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
                backgroundColor: gradientFill('243, 239, 231'), // Fläche: Creme-Verlauf
                fill: true,
                tension: 0.2, // Linie leicht abgerundet
                // Nur Höchststand und letzter Wert bekommen einen Punkt
                pointRadius: (context) => [peakIndex, lastIndex].includes(context.dataIndex) ? 5 : 0,
                pointBackgroundColor: COLORS.peach,
                pointBorderWidth: 0,
                pointHoverRadius: 5,
            }],
        },
        options: {
            layout: { padding: { top: 24, right: 56 } }, // rechts Platz für "1'288"
            plugins: {
                pointLabels: {
                    labels: [
                        { index: peakIndex, text: `Höchststand: ${formatNumber(values[peakIndex])}`, position: 'above' },
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
                        autoSkip: false, // wir bestimmen selbst, welche Beschriftungen erscheinen
                        maxRotation: 0,
                        // Nur jeden Januar eines geraden Jahres beschriften: 2016, 2018, …
                        callback: (value, index) => {
                            const row = months[index];
                            return row.month === 1 && row.year % 2 === 0 ? row.year : null;
                        },
                    },
                },
                y: {
                    min: 0,
                    max: 2500,
                    ticks: {
                        stepSize: 500,
                        callback: (value) => formatNumber(value),
                    },
                    grid: { color: COLORS.grid },
                    border: { display: false },
                },
            },
        },
    });
}

// --- Funktion 3: Veränderung in Prozent seit 2018 (zwei Linien) ---------------
// Für "Prolog" (Tierheime / Hunde im Heim) und "P1" (Hunde im Land / Hunde im Heim).
// Alle Werte werden mit dem ersten Jahr (2018) verglichen: 2018 = 0 %.
// Einstellungen (settings):
//   canvasId    id des <canvas>
//   rows        Dezember-Zeilen ab 2018
//   series      die Linien: [{ label, key, unit, color, labelColor }]
//               key = Spalte aus den Daten, z. B. 'animal_shelter'
//   showLegend  Legende oben anzeigen? (true/false)
//   showPoints  Punkte auf den Linien? (true/false)
//   textColor   Farbe der Achsenbeschriftung (für helle Karten dunkel)
//   gridColor   Farbe der Hilfslinien
//   y           Achse: { min, max, stepSize }
function createChangeChart(settings) {
    const base = settings.rows[0];                // Vergleichsjahr 2018
    const lastIndex = settings.rows.length - 1;

    // Pro Linie: Prozentwerte für die Grafik, absolute Werte für den Tooltip
    const datasets = settings.series.map(serie => ({
        label: serie.label,
        data: settings.rows.map(row => percentChange(base[serie.key], row[serie.key])),
        absolute: settings.rows.map(row => row[serie.key]), // eigene Angabe, nutzen wir im Tooltip
        unit: serie.unit,
        borderColor: serie.color,
        backgroundColor: serie.color,
        borderWidth: 3,
        tension: 0.3,
        pointRadius: settings.showPoints ? 4 : 0,
        pointHoverRadius: 5,
    }));

    // Gestrichelte Linie bei 0 % = "Stand 2018"
    datasets.push({
        label: 'Stand 2018',
        data: settings.rows.map(() => 0),
        borderColor: settings.textColor,
        borderWidth: 1,
        borderDash: [5, 5], // gestrichelt: 5 px Strich, 5 px Lücke
        pointRadius: 0,
        pointHoverRadius: 0,
        isBaseline: true,   // eigene Angabe: diese Linie nicht im Tooltip/in der Legende
    });

    // Endwert jeder Linie rechts daneben schreiben, z. B. "+10 %"
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
            labels: settings.rows.map(row => row.year),
            datasets: datasets,
        },
        options: {
            layout: { padding: { top: 10, right: 60 } }, // rechts Platz für "+117 %"
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
                        // Die gestrichelte 0-Linie nicht in der Legende zeigen
                        filter: (item, data) => !data.datasets[item.datasetIndex].isBaseline,
                    },
                },
                tooltip: {
                    // Die gestrichelte 0-Linie nicht im Tooltip zeigen
                    filter: (item) => !item.dataset.isBaseline,
                    callbacks: {
                        // Prozent UND absolute Zahl, z. B. "Hunde im Heim: −40 % (1’288 Hunde)"
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
                y: {
                    min: settings.y.min,
                    max: settings.y.max,
                    ticks: {
                        stepSize: settings.y.stepSize,
                        color: settings.textColor,
                        // 0 heisst "Stand 2018", sonst Prozent mit Vorzeichen
                        callback: (value) => value === 0 ? 'Stand 2018' : formatPercent(value),
                    },
                    grid: { color: settings.gridColor },
                    border: { display: false },
                },
            },
        },
    });
}

// --- Funktion 4: "P2" – Hunde pro Tierheim als liegende Balken ----------------
// rows: Dezember-Zeilen ab 2018
function createProHeimChart(rows) {
    // Hunde pro Heim = Hunde im Heim ÷ Anzahl Heime, gerundet
    const values = rows.map(row => Math.round(row.total_dogs_shelter / row.animal_shelter));

    return new Chart(document.getElementById('chart-pro-heim'), {
        type: 'bar',
        data: {
            labels: rows.map(row => row.year),
            datasets: [{
                data: values,
                backgroundColor: COLORS.peach,
                borderRadius: 4,
                barPercentage: 0.75, // Balken etwas schmaler als der Platz pro Jahr
            }],
        },
        options: {
            indexAxis: 'y', // Balken liegen (Jahre auf der y-Achse)
            layout: { padding: { right: 36 } }, // Platz für die Zahl am Balkenende
            // Tooltip, sobald die Maus auf der Höhe eines Balkens ist
            interaction: { mode: 'index', axis: 'y', intersect: false },
            plugins: {
                // Zahl am Ende jedes Balkens
                pointLabels: {
                    labels: values.map((value, index) => ({ index: index, text: String(value), position: 'right' })),
                },
                tooltip: {
                    callbacks: {
                        // Ergebnis UND Rechnung, z. B. "51 Hunde pro Heim (2’156 Hunde ÷ 42 Heime)"
                        label: (context) => {
                            const row = rows[context.dataIndex];
                            return `${context.parsed.x} Hunde pro Heim (${formatNumber(row.total_dogs_shelter)} Hunde ÷ ${row.animal_shelter} Heime)`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    display: false, // keine Achse unten: die Zahlen stehen an den Balken
                    beginAtZero: true,
                },
                y: {
                    grid: { display: false },
                    border: { display: false },
                },
            },
        },
    });
}

// ============================================================================
// NAVIGATION: zeigt immer an, in welchem Kapitel man gerade ist
// ============================================================================

const nav = document.querySelector('.nav');
const navPill = document.querySelector('.nav-pill');
const navLinks = document.querySelectorAll('.nav a');

// Zu jedem Link den passenden Abschnitt suchen: href="#prolog" → <section id="prolog">
const sections = [...navLinks].map(link => document.querySelector(link.getAttribute('href')));

// Merkt sich das zuletzt aktive Kapitel (-1 = keines, z. B. im Hero)
let lastActiveIndex = -1;

function updateNav() {
    // "Leselinie" bei 40 % der Fensterhöhe: Aktiv ist der letzte Abschnitt,
    // dessen Anfang schon über diese Linie gescrollt wurde.
    const readingLine = window.innerHeight * 0.4;
    let activeIndex = -1;

    sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= readingLine) {
            activeIndex = index;
        }
    });

    // Ganz unten angekommen: letztes Kapitel (Fazit) aktiv
    const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
    if (atBottom) {
        activeIndex = sections.length - 1;
    }

    // Helle Schrift beim aktiven Link, bei allen anderen nicht
    navLinks.forEach((link, index) => {
        link.classList.toggle('is-active', index === activeIndex);
    });

    // Im Hero (vor dem Prolog): Pille ausblenden
    if (activeIndex === -1) {
        navPill.classList.remove('is-visible');
        lastActiveIndex = -1;
        return;
    }

    // Pille genau hinter den aktiven Link schieben.
    // offsetLeft/offsetWidth: Position und Breite des Links innerhalb der Navigation.
    // Die Bewegung macht CSS weich (transition bei .nav-pill).
    const activeLink = navLinks[activeIndex];
    navPill.style.top = `${activeLink.offsetTop}px`;
    navPill.style.height = `${activeLink.offsetHeight}px`;
    navPill.style.width = `${activeLink.offsetWidth}px`;
    navPill.style.transform = `translateX(${activeLink.offsetLeft}px)`;
    navPill.classList.add('is-visible');

    // Handy: Navigation so wischen, dass das aktive Kapitel in der Mitte sichtbar ist.
    // Nur wenn das Kapitel wechselt – sonst würde man beim eigenen Wischen gestört.
    // (Auf dem Desktop passt alles hinein, dann bewirkt das nichts.)
    if (activeIndex !== lastActiveIndex) {
        nav.scrollTo({ left: activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2 });
        lastActiveIndex = activeIndex;
    }
}

// Bei jedem Scrollen und bei Änderung der Fenstergrösse neu prüfen
window.addEventListener('scroll', updateNav, { passive: true });
window.addEventListener('resize', updateNav);
updateNav(); // einmal beim Laden

// ============================================================================
// START
// ============================================================================

// Daten holen, Kennzahlen einsetzen, Grafiken einrichten.
// try/catch: Geht etwas schief, steht die Fehlermeldung in der Konsole.
try {
    const data = await loadData(ENDPUNKT);
    console.log('Daten geladen:', data.length, 'Monate');

    // Nur die Dezember-Zeilen behalten: eine Zeile pro Jahr (2016–2025).
    // Fast alle Grafiken zeigen den "Stand Dezember".
    const december = data.filter(row => row.month === 12);
    console.log('Dezember-Werte:', december.length, 'Jahre');

    // Dezember-Zeilen ab dem Vergleichsjahr 2018 (für Prolog, P1 und P2)
    const since2018 = december.filter(row => row.year >= 2018);

    // Die drei Jahre, die wir für die Kennzahlen brauchen
    const first = december[0];                // 2016
    const base = since2018[0];                // Vergleichsjahr 2018
    const last = december[december.length - 1]; // 2025

    // --- Kennzahlen (grosse Zahlen in den Grafik-Karten) ---

    // Hunde-Fieber: registrierte Hunde
    setText('kpi-land', formatNumber(last.registered_dogs));
    setText('kpi-land-date', `Dezember ${last.year}`);

    // Im Tierheim: Hunde im Heim
    setText('kpi-heim', formatNumber(last.total_dogs_shelter));
    setText('kpi-heim-date', `Dezember ${last.year}`);

    // P1: Veränderung seit 2018
    setText('kpi-p1-land', formatChange(base.registered_dogs, last.registered_dogs));
    setText('kpi-p1-heim', formatChange(base.total_dogs_shelter, last.total_dogs_shelter));

    // Die Karte: Anzahl Tierheime
    setText('kpi-heime', last.animal_shelter);
    setText('kpi-heime-date', last.year);
    setText('kpi-heime-start', first.animal_shelter);
    setText('kpi-heime-end', last.animal_shelter);

    // P2: Hunde pro Heim = Hunde im Heim geteilt durch Anzahl Heime
    setText('kpi-pro-heim-start', Math.round(base.total_dogs_shelter / base.animal_shelter));
    setText('kpi-pro-heim-end', Math.round(last.total_dogs_shelter / last.animal_shelter));

    // --- Grafiken einrichten (gezeichnet werden sie erst, wenn sie ganz sichtbar sind) ---

    // Prolog: Tierheime und Hunde im Heim, Veränderung seit 2018 (helle Karte, dunkle Schrift)
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

    // Hunde-Fieber: registrierte Hunde
    const maxLandIndex = december.findIndex(row =>
        row.registered_dogs === Math.max(...december.map(r => r.registered_dogs)));

    setupChart('chart-hunde-land', () => createLineChart({
        canvasId: 'chart-hunde-land',
        labels: december.map(row => row.year),
        values: december.map(row => row.registered_dogs),
        unit: 'Hunde',
        fillRgb: '243, 239, 231', // Creme
        y: { min: 450000, max: 575000, stepSize: 25000 },
        pointLabels: [
            { index: 0, text: formatNumber(first.registered_dogs), position: 'belowRight' },
            {
                index: maxLandIndex,
                text: `Höchststand ${december[maxLandIndex].year}: ${formatNumber(december[maxLandIndex].registered_dogs)}`,
                position: 'aboveLeft',
            },
            { index: december.length - 1, text: formatNumber(last.registered_dogs), position: 'belowLeft' },
        ],
    }));

    // Im Tierheim: alle Monate
    setupChart('chart-tierheim', () => createShelterChart(data));

    // P1: Hunde im Land und Hunde im Heim, Veränderung seit 2018
    setupChart('chart-p1', () => createChangeChart({
        canvasId: 'chart-p1',
        rows: since2018,
        series: [
            { label: 'Hunde im Land', key: 'registered_dogs', unit: 'Hunde', color: COLORS.peach },
            { label: 'Hunde im Heim', key: 'total_dogs_shelter', unit: 'Hunde', color: COLORS.cream },
        ],
        showLegend: false, // die Kennzahl-Pillen über der Grafik ersetzen die Legende
        showPoints: true,
        textColor: 'rgba(243, 239, 231, 0.75)',
        gridColor: COLORS.grid,
        y: { min: -50, max: 20, stepSize: 10 },
    }));

    // Die Karte: Anzahl Tierheime
    setupChart('chart-heime', () => createLineChart({
        canvasId: 'chart-heime',
        labels: december.map(row => row.year),
        values: december.map(row => row.animal_shelter),
        unit: 'Tierheime',
        fillRgb: '201, 89, 47', // Orange
        y: { min: 0, max: 100, stepSize: 25 },
        pointLabels: [
            { index: 0, text: String(first.animal_shelter), position: 'belowRight' },
            { index: december.length - 1, text: String(last.animal_shelter), position: 'above' },
        ],
    }));

    // P2: Hunde pro Tierheim
    setupChart('chart-pro-heim', () => createProHeimChart(since2018));
} catch (error) {
    console.error('Daten konnten nicht geladen werden:', error);
}

// Hundebilder: eigener try/catch, damit ein Fehler bei den Bildern
// nicht auch die Zahlen und Grafiken stoppt.
try {
    const images = await loadData(`${ENDPUNKT}?dataset=images`);
    console.log('Bilder geladen:', images.length);

    // Alle <img class="dog-image"> auf der Seite (Polaroids und Bildkarte)
    const imageElements = document.querySelectorAll('.dog-image');

    // Jedem Bild-Platz eine URL geben.
    // % (Rest beim Teilen): Gibt es weniger Bilder als Plätze,
    // fängt die Liste wieder von vorne an (0, 1, 2, 0, 1, 2 …).
    imageElements.forEach((img, index) => {
        img.src = images[index % images.length].image_dog;
    });
} catch (error) {
    console.error('Bilder konnten nicht geladen werden:', error);
}
