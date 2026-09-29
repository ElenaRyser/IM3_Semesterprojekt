<?php

function fetchJson(string $url): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    return json_decode($response, true);
}

// Prüft, ob die URL auf ein gültiges Bild zeigt
function isValidImage(string $url): bool {
    $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

    // Nur JPG, JPEG oder PNG erlauben
    if (!in_array($extension, ['jpg', 'jpeg', 'png'])) {
        return false;
    }

    // Prüfen, ob die URL erreichbar ist
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    curl_exec($ch);

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode >= 200 && $httpCode < 300;
}

header('Content-Type: text/plain; charset=utf-8');

$url = 'https://dog.ceo/api/breeds/image/random';

// Solange nach einem gültigen Bild suchen
do {
    $data = fetchJson($url);
    $bild = $data['message'];
} while (!isValidImage($bild));

// Gültigen Link ausgeben
echo $bild . "\n";