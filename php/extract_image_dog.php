<?php

declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

function fetchJson(string $url): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    return json_decode($response, true);
}

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
    curl_close($ch);

    return $httpCode >= 200 && $httpCode < 300;
}

function countCsvRows(string $filePath): int {
    $handle = fopen($filePath, 'r');
    if (!$handle) {
        return 0;
    }

    fgetcsv($handle, null, ',', '"', '');
    $count = 0;

    while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
        if ($row[0] !== '' && $row[0] !== null) {
            $count++;
        }
    }

    fclose($handle);
    return $count;
}

$configPath = __DIR__ . '/../config.php';

if (!is_file($configPath)) {
    http_response_code(503);
    exit("Fehler: config.php fehlt.\n");
}

require $configPath;

try {
    $pdo = new PDO($dsn, $username, $password, $options);
    echo "✓ Datenbankverbindung steht.\n\n";

    $targetCount = countCsvRows('../data/registered_dogs.csv');
    echo "Zielanzahl (aus CSV): {$targetCount} Bilder\n";

    $currentCount = (int)$pdo->query('SELECT COUNT(*) FROM dog_images')->fetchColumn();
    echo "Aktuelle Anzahl in DB: {$currentCount} Bilder\n\n";

    if ($currentCount >= $targetCount) {
        echo "✓ Datenbank ist bereits vollständig gefüllt!\n";
        exit(0);
    }

    $needed = $targetCount - $currentCount;
    echo "Es werden {$needed} weitere Bilder benötigt.\n";
    echo "Fetche Bilder...\n\n";

    $apiUrl = 'https://dog.ceo/api/breeds/image/random';
    $insertImage = $pdo->prepare(
        'INSERT INTO dog_images (imageUrl, validated) VALUES (:imageUrl, :validated)'
    );

    $inserted = 0;
    $attempts = 0;
    $maxAttempts = $needed * 5;

    while ($inserted < $needed && $attempts < $maxAttempts) {
        $attempts++;

        $data = fetchJson($apiUrl);
        if (!isset($data['message'])) {
            echo "Fehler beim Abrufen von dog.ceo API\n";
            continue;
        }

        $imageUrl = $data['message'];
        $isValid = isValidImage($imageUrl);

        if ($isValid) {
            $insertImage->execute([
                'imageUrl' => $imageUrl,
                'validated' => 1,
            ]);

            $inserted++;
            $progress = $inserted . '/' . $needed;
            echo "[{$progress}] ✓ {$imageUrl}\n";
        }
    }

    echo "\n✓ Fertig! {$inserted} Bilder eingefügt.\n";

    $finalCount = (int)$pdo->query('SELECT COUNT(*) FROM dog_images')->fetchColumn();
    echo "Datenbank enthält jetzt {$finalCount} Bilder.\n";

} catch (Throwable $error) {
    http_response_code(500);
    exit("Fehler: " . $error->getMessage() . "\n");
}