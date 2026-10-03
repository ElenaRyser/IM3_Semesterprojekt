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
 * - $dogImageData: Bild-URLs und Validierung
 */


// ============================================================================
// 1. EXTRACT-DATEIEN LADEN
// ============================================================================

/**
 * CSV-Datei lesen und in assoziatives Array umwandeln
 */
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

// CSV-Dateien laden
$dogsInLandRaw = loadCsvData('../data/registered_dogs.csv');
$dogsInShelterRaw = loadCsvData('../data/total_dogs_shelter.csv');
$dogSheltersRaw = loadCsvData('../data/animal_shelters.csv');

// ============================================================================
// 2. TRANSFORMATIONS-FUNKTIONEN
// ============================================================================

/**
 * Konvertiert String zu Integer
 */
function toInt(string $value): ?int {
    $cleaned = trim($value);
    if ($cleaned === '' || $cleaned === null) {
        return null;
    }
    return (int) $cleaned;
}

/**
 * Erstellt einen eindeutigen Schlüssel für Year+Month Kombination
 */
function getMonthKey(int $year, int $month): string {
    return "{$year}-{$month}";
}

// ============================================================================
// 3. CSV-DATEN TRANSFORMIEREN UND ZUSAMMENFÜHREN
// ============================================================================

// Speichere die Daten nach Year+Month als Schlüssel
$monthlyDataMap = [];

// Verarbeite: Hunde im Land (registered_dogs.csv)
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

// Verarbeite: Hunde in Tierheimen (total_dogs_shelter.csv)
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

// Verarbeite: Registrierte Tierheime (animal_shelters.csv)
// (AnimalCentre hier = Anzahl Tierheime, wird zu dogShelters)
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

// Konvertiere Map zu sortiertem Array (nach Year, dann Month)
$monthlyDogData = array_values($monthlyDataMap);
usort($monthlyDogData, function($a, $b) {
    if ($a['year'] !== $b['year']) {
        return $a['year'] <=> $b['year'];
    }
    return $a['month'] <=> $b['month'];
});

// ============================================================================
// 4. API-BILDER SAMMELN
// ============================================================================

/**
 * Holt ein validiertes Bild von der Dog CEO API
 */
function fetchValidatedDogImage(): ?string {
    $url = 'https://dog.ceo/api/breeds/image/random';

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);

    if (!$response) {
        return null;
    }

    $data = json_decode($response, true);
    return $data['message'] ?? null;
}

/**
 * Prüft, ob eine URL auf ein gültiges Bild zeigt
 */
function isValidImage(string $url): bool {
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

    return $httpCode >= 200 && $httpCode < 300;
}

// Sammle Bilder (hier: nur 1 für Demo, später kann das erweitert werden)
$dogImageData = [];
$imageUrl = fetchValidatedDogImage();

if ($imageUrl && isValidImage($imageUrl)) {
    $dogImageData[] = [
        'imageUrl' => $imageUrl,
        'validated' => true,
    ];
}

// ============================================================================
// 5. RETURN DATA
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


/*$output = [
    'monthlyDogData' => $monthlyDogData,
    'dogImageData' => $dogImageData,
    'metadata' => [
        'totalMonths' => count($monthlyDogData),
        'totalImages' => count($dogImageData),
        'timestamp' => date('Y-m-d H:i:s'),
    ],
];

echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
*/