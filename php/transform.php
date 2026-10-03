<?php
/**
 * Transform: Datenaufbereitung für die Datenbank
 *
 * Kombiniert die Rohdaten aus 4 Extract-Dateien:
 * - extract_registered_dogs.php (CSV: Hunde im Land)
 * - extract_total_dogs_shelter.php (CSV: Hunde im Tierheim)
 * - extract_animal_shelters.php (CSV: Registrierte Tierheime)
 * - extract_image_dog.php (API: Bild-URLs)
 *
 * Output: 2 Arrays
 * - $monthlyDogData: Monatliche Statistiken (year, month, dogsInLand, dogsInShelter, dogShelters)
 * - $dogImageData: Bild-URLs und Validierung (URLs nur, keine Dateien)
 */

// ============================================================================
// 1. CSV-DATEI LADEN
// ============================================================================

function loadCsvData(string $filePath): array {
    $data = [];
    $handle = fopen($filePath, 'r');

    if (!$handle) {
        return [];
    }

    $header = array_map('trim', fgetcsv($handle, null, ',', '"', ''));

    while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
        if ($row[0] === '' || $row[0] === null) {
            continue;
        }
        $data[] = array_combine($header, $row);
    }

    fclose($handle);
    return $data;
}

$dogsInLandRaw = loadCsvData('../data/registered_dogs.csv');
$dogsInShelterRaw = loadCsvData('../data/total_dogs_shelter.csv');
$dogSheltersRaw = loadCsvData('../data/animal_shelters.csv');

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

function isValidImageUrl(string $url): bool {
    $extension = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));

    if (!in_array($extension, ['jpg', 'jpeg', 'png'])) {
        return false;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $httpCode >= 200 && $httpCode < 300;
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
// 4. BILD-URLs VALIDIEREN (von extract_image_dog.php)
// ============================================================================

$dogImageData = [];

// extract_image_dog.php liefert URL via echo – diese auslesen
$imageUrl = trim(shell_exec('php ' . __DIR__ . '/extract_image_dog.php'));

if (!empty($imageUrl)) {
    $isValid = isValidImageUrl($imageUrl);
    $dogImageData[] = [
        'imageUrl' => $imageUrl,
        'validated' => $isValid ? 1 : 0,
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