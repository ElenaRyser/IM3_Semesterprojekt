-- ============================================================================
-- DATENBANKSCHEMA FÜR HUNDEDATEN-PROJEKT
-- ============================================================================

-- Tabelle: Monatliche Hunde-Statistiken
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

-- Tabelle: Hunde-Bilder (URLs von Dog CEO API)
CREATE TABLE IF NOT EXISTS dog_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    imageUrl VARCHAR(500) NOT NULL,
    validated TINYINT(1) DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_validated (validated)
);
