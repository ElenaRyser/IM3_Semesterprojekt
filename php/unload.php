<?php
/**
 * Unload – liest Daten aus der Datenbank für die Grafiken
 *
 * Diese Datei stellt alle für die Visualisierungen benötigten Daten bereit:
 * - Monatliche Statistiken
 * - Jährliche Aggregate
 * - Prozentuale Veränderungen seit 2018
 * - Validierte Bild-URLs
 *
 * Output: JSON für Frontend / Grafiken
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/../config.php';

if (!is_file($configPath)) {
    http_response_code(503);
    exit(json_encode(['error' => 'config.php fehlt im Hauptordner.']));
}

require $configPath;

try {
    $pdo = new PDO($dsn, $username, $password, $options);

    // Monatliche Statistiken (sortiert nach Year, Month)
    $monthlyResult = $pdo->query(
        'SELECT id, year, month, dogsInLand, dogsInShelter, dogShelters 
         FROM monthly_dog_statistics 
         ORDER BY year ASC, month ASC'
    );
    $monthlyData = $monthlyResult->fetchAll();

    // Jährliche Aggregate (Durchschnitte pro Jahr)
    $yearlyResult = $pdo->query(
        'SELECT year,
                COUNT(*) AS months,
                ROUND(AVG(dogsInLand)) AS dogsInLandAvg,
                ROUND(AVG(dogsInShelter)) AS dogsInShelterAvg,
                ROUND(AVG(dogShelters)) AS dogSheltersAvg,
                MIN(dogsInLand) AS dogsInLandMin,
                MAX(dogsInLand) AS dogsInLandMax,
                MIN(dogsInShelter) AS dogsInShelterMin,
                MAX(dogsInShelter) AS dogsInShelterMax,
                MIN(dogShelters) AS dogSheltersMin,
                MAX(dogShelters) AS dogSheltersMax
         FROM monthly_dog_statistics
         GROUP BY year
         ORDER BY year'
    );
    $yearlyData = $yearlyResult->fetchAll();

    // Baseline 2018 Dezember für prozentuale Veränderung
    $baselineResult = $pdo->query(
        'SELECT dogsInLand, dogsInShelter 
         FROM monthly_dog_statistics 
         WHERE year = 2018 AND month = 12'
    );
    $baseline = $baselineResult->fetch();

    // Prozentuale Veränderung seit 2018
    $percentChangeData = [];
    if ($baseline) {
        $percentResult = $pdo->query(
            'SELECT year, month, dogsInLand, dogsInShelter 
             FROM monthly_dog_statistics 
             WHERE year >= 2018 
             ORDER BY year ASC, month ASC'
        );

        foreach ($percentResult->fetchAll() as $row) {
            $pctLand = $baseline['dogsInLand'] > 0
                ? (($row['dogsInLand'] - $baseline['dogsInLand']) / $baseline['dogsInLand'] * 100)
                : 0;
            $pctShelter = $baseline['dogsInShelter'] > 0
                ? (($row['dogsInShelter'] - $baseline['dogsInShelter']) / $baseline['dogsInShelter'] * 100)
                : 0;

            $percentChangeData[] = [
                'year' => (int)$row['year'],
                'month' => (int)$row['month'],
                'percentChangeDogsInLand' => round($pctLand, 2),
                'percentChangeDogsInShelter' => round($pctShelter, 2),
            ];
        }
    }

    // Validierte Bilder
    $imagesResult = $pdo->query(
        'SELECT id, imageUrl, validated 
         FROM dog_images 
         WHERE validated = TRUE 
         ORDER BY createdAt DESC 
         LIMIT 50'
    );
    $imageData = $imagesResult->fetchAll();

    // Audit-Daten
    $auditResult = $pdo->query('SELECT metric, value FROM etl_audit ORDER BY createdAt DESC');
    $auditData = [];
    foreach ($auditResult->fetchAll() as $row) {
        $auditData[$row['metric']] = $row['value'];
    }

    // Output strukturiert für Grafiken
    $output = [
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'monthlyData' => $monthlyData,
        'yearlyData' => $yearlyData,
        'percentChangeData' => $percentChangeData,
        'images' => $imageData,
        'audit' => $auditData,
        'metadata' => [
            'totalMonths' => count($monthlyData),
            'totalYears' => count($yearlyData),
            'totalImages' => count($imageData),
            'dataRange' => [
                'startYear' => !empty($monthlyData) ? (int)$monthlyData[0]['year'] : null,
                'endYear' => !empty($monthlyData) ? (int)$monthlyData[count($monthlyData)-1]['year'] : null,
            ]
        ]
    ];

    echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage()
    ]);
}
?>
