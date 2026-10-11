<?php
/**
 * Extract: Hunde im Tierheim (CSV)
 *
 * Liest data/total_dogs_shelter.csv und gibt jede Zeile als assoziatives Array zurück.
 * Leere Zeilen werden übersprungen, Spaltennamen ohne Leerzeichen.
 *
 * Rückgabe: [['Year' => '2016', 'Month' => '1', 'AnimalCentre' => '...'], ...]
 */

$handle = fopen(__DIR__ . '/../data/total_dogs_shelter.csv', 'r');

// Erste Zeile = Spaltennamen
$header = array_map('trim', fgetcsv($handle, null, ',', '"', ''));

$totalDogsShelter = [];
while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
    if ($row[0] === '' || $row[0] === null) {
        continue; // leere Zeile
    }
    $totalDogsShelter[] = array_combine($header, $row);
}
fclose($handle);

// Direkt im Browser geöffnet: Daten zur Kontrolle anzeigen
if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    header('Content-Type: text/plain; charset=utf-8');
    print_r($totalDogsShelter);
    echo count($totalDogsShelter) . " Zeilen\n";
}

return $totalDogsShelter;
