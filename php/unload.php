<?php
/**
 * Unload – liest die Daten aus der Datenbank und liefert sie als JSON.
 *
 * script.js ruft diese Datei bei jedem Seitenaufruf mit fetch() ab.
 *
 * Schritt 1: Grundgerüst – nur die Verbindung zur Datenbank testen.
 */

// Dem Browser sagen: Die Antwort ist JSON, nicht HTML.
// Muss vor jeder Ausgabe stehen.
header('Content-Type: application/json; charset=utf-8');

// Zugangsdaten laden ($dsn, $username, $password, $options).
// config.php liegt einen Ordner höher, im Hauptordner des Projekts.
require __DIR__ . '/../config.php';

try {
    // Verbindung zur Datenbank aufbauen
    $pdo = new PDO($dsn, $username, $password, $options);

    // Nur zum Testen: Wenn wir hier ankommen, steht die Verbindung.
    echo json_encode(['message' => 'Verbindung steht']);
} catch (Throwable $error) {
    // Etwas ist schiefgegangen: Statuscode 500 setzen,
    // die genaue Meldung ins Server-Log schreiben (nicht in den Browser)
    // und eine kurze Fehlermeldung als JSON zurückgeben.
    http_response_code(500);
    error_log('unload.php: ' . $error->getMessage());

    echo json_encode(['error' => 'Daten konnten nicht geladen werden.']);
}
