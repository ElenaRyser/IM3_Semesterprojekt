-- ============================================================================
-- DATENBANKSCHEMA FÜR HUNDEDATEN-PROJEKT
-- ============================================================================

-- Tabelle: Monatliche Hunde-Statistiken
-- Kombiniert alle 3 Metriken (Hunde im Land, im Tierheim, Tierheime)
CREATE TABLE IF NOT EXISTS monthly_dog_statistics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    year INT NOT NULL,
    month INT NOT NULL,
    dogsInLand INT,
    dogsInShelter INT,
    dogShelters INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_year_month (year, month),
    INDEX idx_year (year),
    INDEX idx_month (month)
);

-- Tabelle: Hunde-Bilder (visuelles Extra)
-- Speichert validierte Bild-URLs von der Dog CEO API
CREATE TABLE IF NOT EXISTS dog_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    imageUrl VARCHAR(500) NOT NULL UNIQUE,
    validated BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_validated (validated)
);

-- Tabelle: ETL-Audit
-- Speichert Kontrollzahlen und Metriken aus dem Transform-Prozess
CREATE TABLE IF NOT EXISTS etl_audit (
    id INT PRIMARY KEY AUTO_INCREMENT,
    metric VARCHAR(255) NOT NULL,
    value TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_metric (metric)
);
