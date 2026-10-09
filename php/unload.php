<?php
/**
 * Unload – liest die Daten aus der Datenbank und liefert sie als JSON.
 *
 * script.js ruft diese Datei bei jedem Seitenaufruf mit fetch() ab.
 *
 *   unload.php                  Monatsdaten 2016–2025 (für alle Grafiken)
 *   unload.php?dataset=images   Bild-URLs der Hunde (für die Polaroids)
 */

// Dem Browser sagen: Die Antwort ist JSON, nicht HTML.
// Muss vor jeder Ausgabe stehen.
header('Content-Type: application/json; charset=utf-8');

// Zugangsdaten laden ($dsn, $username, $password, $options).
// config.php liegt einen Ordner höher, im Hauptordner des Projekts.
require __DIR__ . '/../config.php';

// Welcher Datensatz wird verlangt? Steht in der URL hinter ?dataset=
// ?? 'months': Fehlt der Parameter, liefern wir die Monatsdaten.
// trim() entfernt Leerzeichen, z. B. aus kopierten URLs.
$dataset = trim($_GET['dataset'] ?? 'months');

// Erlaubnisliste: Nur diese zwei Werte sind gültig.
// Alles andere wird mit einer Fehlermeldung abgelehnt.
$allowedDatasets = ['months', 'images'];

if (!in_array($dataset, $allowedDatasets, true)) {
    // 400 heisst: Die Anfrage war falsch, nicht der Server.
    http_response_code(400);

    echo json_encode([
        'error' => 'Unbekannter Datensatz.',
        'allowed' => $allowedDatasets,
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

try {
    // Verbindung zur Datenbank aufbauen
    $pdo = new PDO($dsn, $username, $password, $options);

    if ($dataset === 'images') {
        // Nur Bilder, die beim Laden geprüft wurden (validated = 1).
        // AS image_dog: Name aus unserem Datenvertrag.
        // Die neusten Bilder zuerst.
        $sql = 'SELECT imageUrl AS image_dog
                FROM dog_images
                WHERE validated = 1
                ORDER BY createdAt DESC';
    } else {
        // Nur die Spalten holen, die das Frontend braucht (kein SELECT *).
        // Mit AS bekommt jede Spalte direkt den Namen aus unserem Datenvertrag.
        // WHERE: Unsere Story geht nur von 2016 bis 2025, darum nur diese Jahre.
        // ORDER BY sorgt dafür, dass die Monate immer der Reihe nach kommen.
        $sql = 'SELECT year,
                       month,
                       dogShelters   AS animal_shelter,
                       dogsInShelter AS total_dogs_shelter,
                       dogsInLand    AS registered_dogs
                FROM monthly_dog_statistics
                WHERE year BETWEEN 2016 AND 2025
                ORDER BY year, month';
    }

    // Abfrage ausführen und alle Zeilen als Liste (PHP-Array) holen
    $rows = $pdo->query($sql)->fetchAll();

    // Die Liste als JSON ausgeben.
    // JSON_UNESCAPED_SLASHES: URLs bleiben lesbar (https:// statt https:\/\/).
    // JSON_UNESCAPED_UNICODE: Umlaute bleiben lesbar.
    echo json_encode($rows, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    // Etwas ist schiefgegangen: Statuscode 500 setzen,
    // die genaue Meldung ins Server-Log schreiben (nicht in den Browser)
    // und eine kurze Fehlermeldung als JSON zurückgeben.
    http_response_code(500);
    error_log('unload.php: ' . $error->getMessage());

    echo json_encode(['error' => 'Daten konnten nicht geladen werden.']);
}
