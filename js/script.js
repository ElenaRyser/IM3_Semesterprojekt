/**
 * script.js – holt die Daten von unload.php und bringt sie auf die Seite.
 *
 * Schritt 1: Daten holen und in der Konsole anzeigen.
 * Schritt 2: Dezember-Werte herausfiltern (eine Zeile pro Jahr).
 * Schritt 3: Kennzahlen (grosse Zahlen in den Grafik-Karten) einsetzen.
 * Schritt 4: Hundebilder in die Polaroids und die Bildkarte einsetzen.
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

// Startpunkt: Daten holen und zum Testen in der Konsole ausgeben.
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
