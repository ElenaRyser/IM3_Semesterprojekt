/**
 * script.js – holt die Daten von unload.php und bringt sie auf die Seite.
 *
 * Schritt 1: Daten holen und in der Konsole anzeigen.
 * Schritt 2: Dezember-Werte herausfiltern (eine Zeile pro Jahr).
 * Schritt 3: Kennzahlen (grosse Zahlen in den Grafik-Karten) einsetzen.
 * Schritt 4: Hundebilder in die Polaroids und die Bildkarte einsetzen.
 * Grafiken: mit Chart.js, eine Funktion pro Grafik.
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

// Veränderung in Prozent, gerundet und mit Vorzeichen: "+10 %" oder "−40 %"
function formatChange(start, end) {
    const percent = Math.round((end - start) / start * 100);
    const sign = percent > 0 ? '+' : '−';
    return `${sign}${Math.abs(percent)} %`;
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
    grid: 'rgba(243, 239, 231, 0.12)', // feine Hilfslinien
};

// Grundeinstellungen für ALLE Grafiken.
// So müssen wir das nicht bei jeder Grafik einzeln angeben.
Chart.defaults.font.family = 'Roboto, sans-serif';
Chart.defaults.color = 'rgba(243, 239, 231, 0.75)'; // Achsenbeschriftung: helles Creme
Chart.defaults.maintainAspectRatio = false;          // Höhe kommt aus dem CSS (.chart-box)

// Tooltip (erscheint beim Darüberfahren): helles Kästchen mit dunkler Schrift
Chart.defaults.plugins.tooltip.backgroundColor = COLORS.cream;
Chart.defaults.plugins.tooltip.titleColor = COLORS.bordeaux;
Chart.defaults.plugins.tooltip.bodyColor = COLORS.bordeaux;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.displayColors = false; // kein farbiges Kästchen vor dem Text

// --- Bausteine, die mehrere Grafiken verwenden können -----------------------

// Dauer der Animation "von links nach rechts zeichnen" in Millisekunden
const REVEAL_DURATION = 2000;

// Plugin: deckt die Grafik gleichmässig von links nach rechts auf –
// wie ein Vorhang, der zur Seite gezogen wird. So sieht es aus,
// als würde die Linie gezeichnet.
// Funktionsweise: Vor dem Zeichnen der Linie legen wir eine "Schablone" (clip)
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

    // Vor dem Zeichnen der Linie: Schablone bis zur aktuellen Vorhang-Position
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        // 10 px Zugabe links und rechts, damit die runden Punkte am Rand ganz sichtbar sind
        const left = chartArea.left - 10;
        const width = (chartArea.width + 20) * chart.$reveal;

        ctx.save();
        ctx.beginPath();
        ctx.rect(left, 0, width, chart.height);
        ctx.clip();
    },

    // Nach dem Zeichnen der Linie: Schablone wieder wegnehmen
    afterDatasetsDraw(chart) {
        chart.ctx.restore();
    },

    // Grafik wird gelöscht: Animation stoppen
    afterDestroy(chart) {
        chart.$destroyed = true;
    },
};

// Fläche unter der Linie: Farbverlauf von Orange (oben) zu durchsichtig (unten)
function gradientFill(context) {
    const { ctx, chartArea } = context.chart;

    // Beim allerersten Zeichnen ist die Grösse der Grafik noch nicht bekannt
    if (!chartArea) {
        return null;
    }

    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, 'rgba(201, 89, 47, 0.7)');
    gradient.addColorStop(1, 'rgba(201, 89, 47, 0)');
    return gradient;
}

// Plugin: schreibt den ersten und den letzten Wert direkt an die Linie (wie im Figma).
// Chart.js ruft afterDatasetsDraw jedes Mal auf, nachdem die Linie gezeichnet wurde.
const endLabels = {
    id: 'endLabels',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const points = chart.getDatasetMeta(0).data;
        const values = chart.data.datasets[0].data;
        const lastIndex = points.length - 1;

        ctx.save();
        ctx.font = 'bold 14px Roboto, sans-serif';
        ctx.fillStyle = COLORS.cream;

        for (const index of [0, lastIndex]) {
            // Position des Punkts auf dem Canvas
            const { x, y } = points[index];
            const text = formatNumber(values[index]);

            if (index === 0) {
                ctx.textAlign = 'left';
                ctx.fillText(text, x + 10, y + 20); // erster Wert: rechts unterhalb
            } else {
                ctx.textAlign = 'center';
                ctx.fillText(text, x, y - 14);      // letzter Wert: oberhalb
            }
        }

        ctx.restore();
    },
};

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

// --- Die einzelnen Grafiken -------------------------------------------------

// Grafik "Die Karte": Anzahl Tierheime, Stand Dezember 2016–2025
function createHeimeChart(december) {
    return new Chart(document.getElementById('chart-heime'), {
        type: 'line',
        data: {
            // x-Achse: die Jahre
            labels: december.map(row => row.year),
            datasets: [{
                label: 'Tierheime',
                // y-Werte: Anzahl Tierheime pro Jahr
                data: december.map(row => row.animal_shelter),
                borderColor: COLORS.cream,         // Linie: Creme
                borderWidth: 3,
                backgroundColor: gradientFill,     // Fläche: Farbverlauf
                fill: true,                        // Fläche unter der Linie füllen
                pointBackgroundColor: COLORS.bordeaux, // Punkte: innen Bordeaux …
                pointBorderColor: COLORS.cream,        // … mit Creme-Rand
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
            }],
        },
        // Plugins: Beschriftung "11" und "91" an der Linie, Aufdecken von links nach rechts.
        // Reihenfolge wichtig: endLabels zuerst, damit auch die Beschriftung
        // erst erscheint, wenn der "Vorhang" sie erreicht.
        plugins: [endLabels, revealFromLeft],
        options: {
            animation: false, // Chart.js-eigene Animation aus – wir animieren mit revealFromLeft
            // Platz oben und rechts, damit die Beschriftung "91" nicht abgeschnitten wird
            layout: { padding: { top: 24, right: 12 } },
            // Tooltip erscheint, sobald die Maus in der Nähe eines Jahres ist
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false }, // nur eine Linie, Legende unnötig
                tooltip: {
                    callbacks: {
                        // Text im Tooltip, z. B. "91 Tierheime"
                        label: (context) => `${formatNumber(context.parsed.y)} Tierheime`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false }, // keine senkrechten Linien
                    ticks: { maxRotation: 0 }, // Jahre nie schräg stellen (auf dem Handy werden einige ausgelassen)
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { stepSize: 25 },
                    grid: { color: COLORS.grid },
                    border: { display: false }, // keine senkrechte Achsenlinie
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

    // Die drei Jahre, die wir für die Kennzahlen brauchen
    const first = december[0];                                // 2016
    const base = december.find(row => row.year === 2018);    // Vergleichsjahr 2018
    const last = december[december.length - 1];              // 2025

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

    // Grafiken einrichten (gezeichnet werden sie erst, wenn sie ganz sichtbar sind)
    setupChart('chart-heime', () => createHeimeChart(december));
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
