<?php
/**
 * Extract: Hundebilder von der Dog CEO API
 *
 * Holt Bild-URLs von https://dog.ceo und speichert sie in data/dog_images.json.
 * Gibt es die Datei schon, wird nur sie gelesen – die API wird nicht nochmals
 * abgefragt. So dauert nicht jeder Lauf lange.
 *
 * Neue Bilder holen: data/dog_images.json löschen
 * oder die Datei im Browser mit ?refresh=1 aufrufen.
 *
 * Nur Rohdaten: Prüfen macht transform.php, Speichern in der DB macht load.php.
 *
 * Rückgabe: Liste von Bild-URLs, z. B. ['https://images.dog.ceo/breeds/.../1.jpg', ...]
 */

declare(strict_types=1);

$imageCachePath = __DIR__ . '/../data/dog_images.json';
$imageCount = 127; // gleich viele Bilder wie Monate in den CSV-Daten
$refreshImages = isset($_GET['refresh']);

$dogImageUrls = [];

if (!$refreshImages && is_file($imageCachePath)) {
    // Gespeicherte Bilder verwenden
    $dogImageUrls = json_decode(file_get_contents($imageCachePath), true) ?? [];
} else {
    // Die API liefert höchstens 50 Bilder pro Anfrage, darum in Paketen holen.
    $apiAttempts = 0;

    while (count($dogImageUrls) < $imageCount && $apiAttempts < 10) {
        $apiAttempts++;
        $batchSize = min(50, $imageCount - count($dogImageUrls));

        $ch = curl_init("https://dog.ceo/api/breeds/image/random/{$batchSize}");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $response = curl_exec($ch);

        $data = is_string($response) ? json_decode($response, true) : null;

        if (!is_array($data['message'] ?? null)) {
            continue; // Anfrage fehlgeschlagen, nochmals versuchen
        }

        array_push($dogImageUrls, ...$data['message']);
    }

    // Nur speichern, wenn wirklich Bilder angekommen sind
    if ($dogImageUrls !== []) {
        file_put_contents(
            $imageCachePath,
            json_encode($dogImageUrls, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }
}

// Direkt im Browser geöffnet: Daten zur Kontrolle anzeigen
if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    header('Content-Type: text/plain; charset=utf-8');
    print_r($dogImageUrls);
    echo count($dogImageUrls) . " Bild-URLs\n";
}

return $dogImageUrls;
