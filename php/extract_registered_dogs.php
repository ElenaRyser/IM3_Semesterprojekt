<?php
/**
 * Extract: Registrierte Hunde im Land (CSV)
 *
 * Liest data/registered_dogs.csv und gibt jede Zeile als assoziatives Array zurück.
 * Leere Zeilen werden übersprungen, Spaltennamen ohne Leerzeichen.
 *
 * Rückgabe: [['Year' => '2016', 'Month' => '1', 'Total' => '485504'], ...]
 */

$handle = fopen(__DIR__ . '/../data/registered_dogs.csv', 'r');

// Erste Zeile = Spaltennamen
$header = array_map('trim', fgetcsv($handle, null, ',', '"', ''));

$registeredDogs = [];
while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
    if ($row[0] === '' || $row[0] === null) {
        continue; // leere Zeile
    }
    $registeredDogs[] = array_combine($header, $row);
}
fclose($handle);

// Direkt im Browser geöffnet: Daten zur Kontrolle anzeigen
if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    header('Content-Type: text/plain; charset=utf-8');
    print_r($registeredDogs);
    echo count($registeredDogs) . " Zeilen\n";
}

return $registeredDogs;
