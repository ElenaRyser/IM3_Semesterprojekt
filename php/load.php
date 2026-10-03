<?php
/**
 * Load – schreibt die bereinigten Monatsdaten mit PDO in MySQL.
 *
 * Vorher sql/schema.sql in phpMyAdmin ausführen. Danach diese Datei einmal
 * über die eigene Domain aufrufen.
 *
 * Diese Datei ist der letzte Schritt des ETL-Prozesses:
 *
 *   transform.php -> PHP-Arrays -> vorbereitete INSERTs -> MySQL
 *
 * Alle Schreiboperationen laufen in einer Transaktion. Entweder wird der
 * komplette neue Datenstand gespeichert oder bei einem Fehler gar nichts.
 */

declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

$configPath = __DIR__ . '/../config.php';

echo "Konfiguration: {$configPath}\n";

if (!is_file($configPath)) {
    http_response_code(503);
    exit("config.php fehlt im Hauptordner des Projekts.\n");
}

require $configPath;

$result = include __DIR__ . '/transform.php';

if (!is_array($result)) {
    die("FEHLER: transform.php hat kein Array zurückgegeben.\n");
}

echo "Transform wurde erfolgreich geladen.\n";
echo "Keys: " . implode(', ', array_keys($result)) . "\n";

$monthlyData = $result['monthlyDogData'];
$imageData = $result['dogImageData'];
$metadata = $result['metadata'];

echo "Transform liefert " . count($monthlyData) . " Monatsdaten.\n";
echo "Transform liefert " . count($imageData) . " Bilder.\n\n";

try {
    $pdo = new PDO($dsn, $username, $password, $options);
    echo "Verbindung steht.\n\n";

    $pdo->beginTransaction();

    $deletedStats = $pdo->exec('DELETE FROM monthly_dog_statistics');
    $deletedImages = $pdo->exec('DELETE FROM dog_images');
    $pdo->exec('DELETE FROM etl_audit');

    echo $deletedStats . " alte Monatsdaten gelöscht.\n";
    echo $deletedImages . " alte Bilder gelöscht.\n\n";

    $insertStat = $pdo->prepare(
        'INSERT INTO monthly_dog_statistics
            (year, month, dogsInLand, dogsInShelter, dogShelters)
         VALUES
            (:year, :month, :dogsInLand, :dogsInShelter, :dogShelters)'
    );

    foreach ($monthlyData as $row) {
        $insertStat->execute([
            'year' => $row['year'],
            'month' => $row['month'],
            'dogsInLand' => $row['dogsInLand'],
            'dogsInShelter' => $row['dogsInShelter'],
            'dogShelters' => $row['dogShelters'],
        ]);
    }

    $insertImage = $pdo->prepare(
        'INSERT INTO dog_images (imageUrl, validated) VALUES (:imageUrl, :validated)'
    );

    foreach ($imageData as $row) {
        $insertImage->execute([
            'imageUrl' => $row['imageUrl'],
            'validated' => (int)$row['validated'],
        ]);
    }

    $insertAudit = $pdo->prepare(
        'INSERT INTO etl_audit (metric, value) VALUES (:metric, :value)'
    );

    foreach ($metadata as $metric => $value) {
        if (!is_array($value)) {
            $insertAudit->execute([
                'metric' => $metric,
                'value' => (string)$value,
            ]);
        }
    }

    $pdo->commit();

    echo count($monthlyData) . " Monatsdaten geschrieben.\n";
    echo count($imageData) . " Bilder geschrieben.\n\n";

    $totalStats = $pdo->query('SELECT COUNT(*) FROM monthly_dog_statistics')->fetchColumn();
    echo "In monthly_dog_statistics stehen jetzt {$totalStats} Zeilen.\n\n";

    $totalImages = $pdo->query('SELECT COUNT(*) FROM dog_images')->fetchColumn();
    echo "In dog_images stehen jetzt {$totalImages} Zeilen.\n\n";

    $check = $pdo->query(
        'SELECT year, COUNT(*) AS months, 
                MIN(dogsInLand) AS minLand, MAX(dogsInLand) AS maxLand,
                MIN(dogsInShelter) AS minShelter, MAX(dogsInShelter) AS maxShelter,
                MIN(dogShelters) AS minShelters, MAX(dogShelters) AS maxShelters
         FROM monthly_dog_statistics
         GROUP BY year
         ORDER BY year'
    );

    echo "Datenbereich pro Jahr:\n";
    foreach ($check->fetchAll() as $year) {
        echo "  {$year['year']}: {$year['months']} Monate\n";
        echo "    - Hunde im Land: {$year['minLand']} – {$year['maxLand']}\n";
        echo "    - Hunde im Tierheim: {$year['minShelter']} – {$year['maxShelter']}\n";
        echo "    - Tierheime: {$year['minShelters']} – {$year['maxShelters']}\n";
    }

} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    exit("Load fehlgeschlagen: " . $error->getMessage() . "\n");
}
?>
