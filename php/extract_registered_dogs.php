<?php
/**
 * Code-Along 08: CSV lesen (Extract)
 *
 * Dritte Extract-Quelle: eine echte CSV-Datei. Wir lesen das Shark Attack File
 * (GSAF) ein und verwandeln jede Zeile in ein assoziatives Array. Kein Endpunkt,
 * kein Filter - nur lesen. PHP gibt hier reinen Text aus.
 *
 * Gleiche Idee wie bei JSON und API: Quelle -> PHP-Array von Datensätzen.
 * Echte Daten sind unordentlich: viele leere Zeilen, Spaltennamen mit
 * Leerzeichen. Damit gehen wir hier bewusst um.
 */

header('Content-Type: text/plain; charset=utf-8');

// 1. Die CSV-Datei zum Lesen öffnen.
//    Tipp: fopen('data/attacks.csv', 'r')
$handle = fopen('../data/registered_dogs.csv', 'r');

// 2. Die erste Zeile ist die Kopfzeile mit den Spaltennamen. Sie lesen und die
//    Leerzeichen entfernen (manche heissen z. B. "Species " mit Leerzeichen).
//    Tipp: array_map('trim', fgetcsv($handle, null, ',', '"', ''))
$header = array_map('trim', fgetcsv($handle, null, ',', '"', ''));
print_r($header);

// 3. Alle weiteren Zeilen in einer while-Schleife lesen.
//    - Leere Zeilen überspringen (wenn die erste Spalte leer ist: continue).
//    - Sonst mit array_combine($header, $row) ein assoziatives Array pro Angriff
//      bauen und in $attacks sammeln.
$dogs = [];
while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {
    if ($row[0] === '') {
        continue; // leere Zeile
    }
    $dogs[] = array_combine($header, $row);
}
fclose($handle);
print_r($dogs);
// print_r($dogs[0]);
print_r(count($dogs));

// 4. Datei schliessen (fclose) und die Struktur prüfen:
//    Spaltennamen und Anzahl Angriffe ausgeben.


// 5. Die ersten 5 Angriffe ausgeben, z. B. Year, Country und Activity.
