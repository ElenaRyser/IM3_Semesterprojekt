<?php

header('Content-Type: text/plain; charset=utf-8');

// 1. Die CSV-Datei zum Lesen öffnen.
//    Tipp: fopen('data/attacks.csv', 'r')
$handle = fopen('../data/animal_shelters.csv', 'r');

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
