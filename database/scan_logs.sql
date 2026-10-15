CREATE DATABASE IF NOT EXISTS authentifi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE authentifi;

CREATE TABLE IF NOT EXISTS SCAN_LOGS (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(64) NOT NULL,
    scan_time DATETIME NOT NULL,
    ip_address VARCHAR(45) NULL,
    location_data VARCHAR(255) NULL,
    anomaly_flag BOOLEAN DEFAULT 0,
    INDEX idx_product_code (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS PRODUCTS (
    code_hash CHAR(64) PRIMARY KEY,
    brand VARCHAR(160) NOT NULL,
    model VARCHAR(160) NOT NULL,
    serial_id VARCHAR(160) NULL,
    batch_id VARCHAR(160) NULL,
    uid VARCHAR(160) NULL,
    description TEXT NULL,
    manufacturer_name VARCHAR(200) NOT NULL,
    manufacturer_location VARCHAR(255) NOT NULL,
    salt CHAR(32) NOT NULL,
    issued_at DATETIME(3) NOT NULL,
    activated_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS OWNERSHIP_LOGS (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    product_code CHAR(64) NOT NULL,
    owner_address VARCHAR(42) NOT NULL,
    transfer_time DATETIME NOT NULL,
    INDEX idx_ownership_product (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
