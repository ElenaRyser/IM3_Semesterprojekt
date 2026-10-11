<?php
/**
 * Transform: Datenaufbereitung für die Datenbank
 *
 * Holt die Rohdaten aus den 4 Extract-Dateien:
 * - extract_registered_dogs.php (CSV: Hunde im Land)
 * - extract_total_dogs_shelter.php (CSV: Hunde im Tierheim)
 * - extract_animal_shelters.php (CSV: Registrierte Tierheime)
 * - extract_image_dog.php (API: Bild-URLs, gespeichert in data/dog_images.json)
 *
 * Kein Datenbankzugriff – das macht erst load.php.
 *
 * Output: 2 Arrays
 * - $monthlyDogData: Monatliche Statistiken (year, month, dogsInLand, dogsInShelter, dogShelters)
 * - $dogImageData: Geprüfte Bild-URLs (imageUrl, validated)
 */

// ============================================================================
// 1. ROHDATEN AUS DEN EXTRACTS HOLEN
// ============================================================================

$dogsInLandRaw = include __DIR__ . '/extract_registered_dogs.php';
$dogsInShelterRaw = include __DIR__ . '/extract_total_dogs_shelter.php';
$dogSheltersRaw = include __DIR__ . '/extract_animal_shelters.php';
$dogImageUrlsRaw = include __DIR__ . '/extract_image_dog.php';

// ============================================================================
// 2. HILFSFUNKTIONEN
// ============================================================================

function toInt(string $value): ?int {
    $cleaned = trim($value);
    if ($cleaned === '' || $cleaned === null) {
        return null;
    }
    return (int) $cleaned;
}

function getMonthKey(int $year, int $month): string {
    return "{$year}-{$month}";
}

function hasImageExtension(string $url): bool {
    $extension = strtolower(pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
    return in_array($extension, ['jpg', 'jpeg', 'png'], true);
}

/**
 * Prüft mit HEAD-Requests, ob die Bilder erreichbar sind.
 * Die Anfragen laufen parallel (curl_multi), darum dauert das nur wenige Sekunden.
 */
function filterReachableImages(array $urls): array {
    $multi = curl_multi_init();
    curl_multi_setopt($multi, CURLMOPT_MAX_TOTAL_CONNECTIONS, 20);

    $handles = [];
    foreach ($urls as $url) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_NOBODY, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_multi_add_handle($multi, $ch);
        $handles[$url] = $ch;
    }

    do {
        curl_multi_exec($multi, $running);
        curl_multi_select($multi);
    } while ($running > 0);

    $reachable = [];
    foreach ($handles as $url => $ch) {
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($httpCode >= 200 && $httpCode < 300) {
            $reachable[] = $url;
        }
        curl_multi_remove_handle($multi, $ch);
    }
    curl_multi_close($multi);

    return $reachable;
}

// ============================================================================
// 3. MONATSDATEN TRANSFORMIEREN
// ============================================================================

$monthlyDataMap = [];

foreach ($dogsInLandRaw as $row) {
    $year = toInt($row['Year']);
    $month = toInt($row['Month']);
    $total = toInt($row['Total']);

    if ($year === null || $month === null) {
        continue;
    }

    $key = getMonthKey($year, $month);

    if (!isset($monthlyDataMap[$key])) {
        $monthlyDataMap[$key] = [
            'year' => $year,
            'month' => $month,
            'dogsInLand' => null,
            'dogsInShelter' => null,
            'dogShelters' => null,
        ];
    }

    $monthlyDataMap[$key]['dogsInLand'] = $total;
}

foreach ($dogsInShelterRaw as $row) {
    $year = toInt($row['Year']);
    $month = toInt($row['Month']);
    $animalCentre = toInt($row['AnimalCentre']);

    if ($year === null || $month === null) {
        continue;
    }

    $key = getMonthKey($year, $month);

    if (!isset($monthlyDataMap[$key])) {
        $monthlyDataMap[$key] = [
            'year' => $year,
            'month' => $month,
            'dogsInLand' => null,
            'dogsInShelter' => null,
            'dogShelters' => null,
        ];
    }

    $monthlyDataMap[$key]['dogsInShelter'] = $animalCentre;
}

foreach ($dogSheltersRaw as $row) {
    $year = toInt($row['Year']);
    $month = toInt($row['Month']);
    $animalCentre = toInt($row['AnimalCentre']);

    if ($year === null || $month === null) {
        continue;
    }

    $key = getMonthKey($year, $month);

    if (!isset($monthlyDataMap[$key])) {
        $monthlyDataMap[$key] = [
            'year' => $year,
            'month' => $month,
            'dogsInLand' => null,
            'dogsInShelter' => null,
            'dogShelters' => null,
        ];
    }

    $monthlyDataMap[$key]['dogShelters'] = $animalCentre;
}

$monthlyDogData = array_values($monthlyDataMap);
usort($monthlyDogData, function($a, $b) {
    if ($a['year'] !== $b['year']) {
        return $a['year'] <=> $b['year'];
    }
    return $a['month'] <=> $b['month'];
});

// ============================================================================
// 4. BILD-URLs PRÜFEN
// ============================================================================

// Nur Texte, nur jpg/png, keine doppelten URLs
$candidateUrls = array_filter($dogImageUrlsRaw, 'is_string');
$candidateUrls = array_filter($candidateUrls, 'hasImageExtension');
$candidateUrls = array_values(array_unique($candidateUrls));

// Nur Bilder, die wirklich erreichbar sind
$dogImageData = [];
foreach (filterReachableImages($candidateUrls) as $url) {
    $dogImageData[] = [
        'imageUrl' => $url,
        'validated' => 1,
    ];
}

// ============================================================================
// 5. DATEN ZURÜCKGEBEN
// ============================================================================

return [
    'monthlyDogData' => $monthlyDogData,
    'dogImageData' => $dogImageData,
    'metadata' => [
        'totalMonths' => count($monthlyDogData),
        'totalImages' => count($dogImageData),
        'timestamp' => date('Y-m-d H:i:s'),
    ],
];