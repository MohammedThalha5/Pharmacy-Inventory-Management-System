-- ============================================================
--  Medstock · Pharmacy Inventory Management System
--  MySQL 8.0.16+ schema
--  Run:  mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS pharmacy_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pharmacy_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW  IF EXISTS v_medicine_stock;
DROP TABLE IF EXISTS stock_adjustments, sale_items, sales, purchase_items, purchases,
                     batches, medicines, suppliers, categories, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- Users (staff who sign in) ----------
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          ENUM('admin','pharmacist') NOT NULL DEFAULT 'pharmacist',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Categories ----------
CREATE TABLE categories (
  id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ---------- Suppliers ----------
CREATE TABLE suppliers (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  contact_person VARCHAR(100),
  phone          VARCHAR(30),
  email          VARCHAR(120),
  address        VARCHAR(255),
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_suppliers_name (name)
) ENGINE=InnoDB;

-- ---------- Medicines (the catalogue; stock lives in batches) ----------
CREATE TABLE medicines (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sku                   VARCHAR(30) UNIQUE,
  name                  VARCHAR(150) NOT NULL,
  generic_name          VARCHAR(150),
  category_id           INT UNSIGNED,
  manufacturer          VARCHAR(120),
  dosage_form           VARCHAR(40),
  strength              VARCHAR(40),
  unit                  VARCHAR(20)   NOT NULL DEFAULT 'strip',
  unit_price            DECIMAL(10,2) NOT NULL,
  gst_percent           DECIMAL(4,1)  NOT NULL DEFAULT 5.0,
  reorder_level         INT UNSIGNED  NOT NULL DEFAULT 10,
  requires_prescription TINYINT(1)    NOT NULL DEFAULT 0,
  rack_location         VARCHAR(40),
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_med_price CHECK (unit_price >= 0),
  CONSTRAINT fk_med_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_med_name (name),
  INDEX idx_med_category (category_id),
  INDEX idx_med_active (is_active)
) ENGINE=InnoDB;

-- ---------- Purchases (stock-in from suppliers) ----------
CREATE TABLE purchases (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_id   INT UNSIGNED NOT NULL,
  invoice_no    VARCHAR(50),
  purchase_date DATE NOT NULL,
  total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes         VARCHAR(255),
  created_by    INT UNSIGNED,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pur_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pur_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pur_date (purchase_date)
) ENGINE=InnoDB;

-- ---------- Batches (each delivery lot, with its own expiry) ----------
CREATE TABLE batches (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medicine_id INT UNSIGNED NOT NULL,
  supplier_id INT UNSIGNED,
  purchase_id INT UNSIGNED,
  batch_no    VARCHAR(50)  NOT NULL,
  quantity    INT UNSIGNED NOT NULL DEFAULT 0,
  cost_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  mfg_date    DATE,
  expiry_date DATE NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_batch_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_batch_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  UNIQUE KEY uq_batch (medicine_id, batch_no),
  INDEX idx_batch_expiry (expiry_date),
  INDEX idx_batch_fefo (medicine_id, expiry_date)
) ENGINE=InnoDB;

CREATE TABLE purchase_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  batch_no    VARCHAR(50)  NOT NULL,
  quantity    INT UNSIGNED NOT NULL,
  cost_price  DECIMAL(10,2) NOT NULL,
  mfg_date    DATE,
  expiry_date DATE NOT NULL,
  CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id)
) ENGINE=InnoDB;

-- ---------- Sales ----------
CREATE TABLE sales (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_no     VARCHAR(30) NOT NULL UNIQUE,
  customer_name  VARCHAR(100),
  customer_phone VARCHAR(30),
  payment_method ENUM('Cash','UPI','Card') NOT NULL DEFAULT 'Cash',
  subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax            DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(12,2) NOT NULL DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL DEFAULT 0,
  sold_by        INT UNSIGNED,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sale_user FOREIGN KEY (sold_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sales_created (created_at)
) ENGINE=InnoDB;

-- One row per batch the stock was taken from (first-expiry-first-out)
CREATE TABLE sale_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id     INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  batch_id    INT UNSIGNED NOT NULL,
  quantity    INT UNSIGNED NOT NULL,
  unit_price  DECIMAL(10,2) NOT NULL,
  gst_percent DECIMAL(4,1)  NOT NULL DEFAULT 0,
  line_total  DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_si_sale     FOREIGN KEY (sale_id)     REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_si_batch    FOREIGN KEY (batch_id)    REFERENCES batches(id),
  INDEX idx_si_medicine (medicine_id)
) ENGINE=InnoDB;

-- ---------- Stock adjustments (write-offs of expired / damaged stock) ----------
CREATE TABLE stock_adjustments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id   INT UNSIGNED NOT NULL,
  change_qty INT NOT NULL,
  reason     VARCHAR(150) NOT NULL,
  user_id    INT UNSIGNED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_adj_batch FOREIGN KEY (batch_id) REFERENCES batches(id),
  CONSTRAINT fk_adj_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- View: sellable stock per medicine ----------
-- "stock" excludes expired batches, so expired medicine can never be sold.
CREATE VIEW v_medicine_stock AS
SELECT
  medicine_id,
  SUM(CASE WHEN expiry_date >= CURDATE() THEN quantity ELSE 0 END) AS stock,
  SUM(CASE WHEN expiry_date <  CURDATE() THEN quantity ELSE 0 END) AS expired_qty,
  MIN(CASE WHEN expiry_date >= CURDATE() AND quantity > 0 THEN expiry_date END) AS next_expiry
FROM batches
GROUP BY medicine_id;
