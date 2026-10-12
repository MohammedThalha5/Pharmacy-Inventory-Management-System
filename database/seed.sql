-- ============================================================
--  Sample data. Dates are relative to today, so the dashboard always
--  shows a realistic mix of healthy, low, expiring and expired stock.
--  Run after schema.sql:  mysql -u root -p pharmacy_db < database/seed.sql
--  (The admin login is created automatically when the server first starts.)
-- ============================================================
USE pharmacy_db;

INSERT INTO categories (id, name) VALUES
 (1,'Analgesics'),(2,'Antibiotics'),(3,'Diabetes Care'),(4,'Cardiovascular'),
 (5,'Gastrointestinal'),(6,'Respiratory & Allergy'),(7,'Vitamins & Supplements'),
 (8,'First Aid'),(9,'Medical Devices');

INSERT INTO suppliers (id, name, contact_person, phone, email, address) VALUES
 (1,'Southern Pharma Distributors','R. Venkatesh','+91 98765 43210','orders@southernpharma.example','12, Market Road, Madurai'),
 (2,'Cauvery Medical Agencies','S. Lakshmi','+91 98430 11223','sales@cauverymed.example','48, Anna Salai, Tiruchirappalli'),
 (3,'Lotus Healthcare Supplies','M. Imran','+91 90030 55671','hello@lotushealth.example','7, Cross Cut Road, Coimbatore'),
 (4,'Nila Cold Chain & Devices','K. Priyadharshini','+91 97910 88452','care@nilacold.example','21, Harbour Link, Chennai');

INSERT INTO medicines
 (id, sku, name, generic_name, category_id, manufacturer, dosage_form, strength, unit, unit_price, gst_percent, reorder_level, requires_prescription, rack_location) VALUES
 (1 ,'MED-0001','Paracetamol','Acetaminophen',1,'Generic','Tablet','500 mg','strip',32.00,5,40,0,'A1'),
 (2 ,'MED-0002','Ibuprofen','Ibuprofen',1,'Generic','Tablet','400 mg','strip',48.00,5,30,0,'A1'),
 (3 ,'MED-0003','Diclofenac Gel','Diclofenac',1,'Generic','Gel','1% w/w','tube',86.00,5,15,0,'A2'),
 (4 ,'MED-0004','Amoxicillin','Amoxicillin',2,'Generic','Capsule','500 mg','strip',118.00,5,25,1,'B1'),
 (5 ,'MED-0005','Azithromycin','Azithromycin',2,'Generic','Tablet','500 mg','strip',142.00,5,20,1,'B1'),
 (6 ,'MED-0006','Ciprofloxacin','Ciprofloxacin',2,'Generic','Tablet','500 mg','strip',96.00,5,20,1,'B2'),
 (7 ,'MED-0007','Doxycycline','Doxycycline',2,'Generic','Capsule','100 mg','strip',74.00,5,20,1,'B2'),
 (8 ,'MED-0008','Metformin','Metformin',3,'Generic','Tablet','500 mg','strip',28.00,5,50,1,'C1'),
 (9 ,'MED-0009','Glimepiride','Glimepiride',3,'Generic','Tablet','2 mg','strip',64.00,5,30,1,'C1'),
 (10,'MED-0010','Insulin Glargine','Insulin glargine',3,'Generic','Injection','100 IU/mL','vial',780.00,5,8,1,'Fridge 1'),
 (11,'MED-0011','Amlodipine','Amlodipine',4,'Generic','Tablet','5 mg','strip',36.00,5,40,1,'D1'),
 (12,'MED-0012','Atorvastatin','Atorvastatin',4,'Generic','Tablet','10 mg','strip',92.00,5,35,1,'D1'),
 (13,'MED-0013','Telmisartan','Telmisartan',4,'Generic','Tablet','40 mg','strip',88.00,5,30,1,'D2'),
 (14,'MED-0014','Pantoprazole','Pantoprazole',5,'Generic','Tablet','40 mg','strip',112.00,5,40,0,'E1'),
 (15,'MED-0015','Omeprazole','Omeprazole',5,'Generic','Capsule','20 mg','strip',58.00,5,30,0,'E1'),
 (16,'MED-0016','Oral Rehydration Salts','ORS',5,'Generic','Powder','21.8 g','sachet',24.00,5,60,0,'E2'),
 (17,'MED-0017','Cetirizine','Cetirizine',6,'Generic','Tablet','10 mg','strip',26.00,5,50,0,'F1'),
 (18,'MED-0018','Montelukast','Montelukast',6,'Generic','Tablet','10 mg','strip',124.00,5,25,1,'F1'),
 (19,'MED-0019','Salbutamol Inhaler','Salbutamol',6,'Generic','Inhaler','100 mcg','inhaler',168.00,5,12,1,'F2'),
 (20,'MED-0020','Cough Syrup','Dextromethorphan',6,'Generic','Syrup','100 mL','bottle',98.00,12,25,0,'F2'),
 (21,'MED-0021','Vitamin D3','Cholecalciferol',7,'Generic','Capsule','60000 IU','strip',112.00,12,30,0,'G1'),
 (22,'MED-0022','Vitamin B-Complex','B vitamins',7,'Generic','Tablet',NULL,'strip',42.00,12,40,0,'G1'),
 (23,'MED-0023','Calcium + Vitamin D3','Calcium carbonate',7,'Generic','Tablet','500 mg','strip',138.00,12,25,0,'G2'),
 (24,'MED-0024','Povidone-Iodine','Povidone-iodine',8,'Generic','Solution','5% w/v','bottle',72.00,12,20,0,'H1'),
 (25,'MED-0025','Adhesive Bandage','—',8,'Generic','Dressing','Pack of 10','pack',45.00,12,40,0,'H2'),
 (26,'MED-0026','Absorbent Cotton','—',8,'Generic','Dressing','100 g','roll',58.00,12,20,0,'H2'),
 (27,'MED-0027','Digital Thermometer','—',9,'Generic','Device',NULL,'piece',240.00,18,10,0,'J1'),
 (28,'MED-0028','Glucometer Test Strips','—',9,'Generic','Device','Pack of 25','box',650.00,18,10,0,'J1'),
 (29,'MED-0029','Hand Sanitizer','Isopropyl alcohol',8,'Generic','Solution','100 mL','bottle',65.00,18,30,0,'H1');

-- Batches: quantities and expiry offsets chosen to show every status
INSERT INTO batches (id, medicine_id, supplier_id, batch_no, quantity, cost_price, mfg_date, expiry_date) VALUES
 (1 , 1,1,'PCM-2411',120, 22.40, DATE_SUB(CURDATE(), INTERVAL 8 MONTH), DATE_ADD(CURDATE(), INTERVAL 310 DAY)),
 (2 , 1,1,'PCM-2503', 60, 22.40, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 520 DAY)),
 (3 , 2,1,'IBU-2407', 18, 33.60, DATE_SUB(CURDATE(), INTERVAL 9 MONTH), DATE_ADD(CURDATE(), INTERVAL 145 DAY)),
 (4 , 3,2,'DCG-2502', 34, 60.00, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), DATE_ADD(CURDATE(), INTERVAL 260 DAY)),
 (5 , 4,2,'AMX-2406', 14, 82.00, DATE_SUB(CURDATE(), INTERVAL 12 MONTH),DATE_ADD(CURDATE(), INTERVAL 24 DAY)),
 (6 , 4,2,'AMX-2412', 40, 82.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 400 DAY)),
 (7 , 5,2,'AZI-2409', 45, 99.00, DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 190 DAY)),
 (8 , 6,3,'CIP-2310', 12, 67.00, DATE_SUB(CURDATE(), INTERVAL 22 MONTH),DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
 (9 , 6,3,'CIP-2501', 30, 67.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 330 DAY)),
 (10, 7,3,'DOX-2408', 55, 52.00, DATE_SUB(CURDATE(), INTERVAL 10 MONTH),DATE_ADD(CURDATE(), INTERVAL 60 DAY)),
 (11, 8,1,'MET-2410',160, 19.60, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), DATE_ADD(CURDATE(), INTERVAL 365 DAY)),
 (12, 9,1,'GLM-2404', 22, 45.00, DATE_SUB(CURDATE(), INTERVAL 14 MONTH),DATE_ADD(CURDATE(), INTERVAL 40 DAY)),
 (13,10,4,'INS-2501',  6,546.00, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), DATE_ADD(CURDATE(), INTERVAL 95 DAY)),
 (14,11,1,'AML-2412', 95, 25.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 450 DAY)),
 (15,12,3,'ATV-2409', 70, 64.00, DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 280 DAY)),
 (16,13,3,'TEL-2411', 48, 61.00, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), DATE_ADD(CURDATE(), INTERVAL 330 DAY)),
 (17,14,2,'PAN-2410',110, 78.00, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), DATE_ADD(CURDATE(), INTERVAL 210 DAY)),
 (18,14,2,'PAN-2305',  8, 78.00, DATE_SUB(CURDATE(), INTERVAL 24 MONTH),DATE_SUB(CURDATE(), INTERVAL 30 DAY)),
 (19,15,2,'OMP-2503', 64, 40.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), DATE_ADD(CURDATE(), INTERVAL 500 DAY)),
 (20,16,1,'ORS-2412',150, 16.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 600 DAY)),
 (21,17,1,'CET-2410', 85, 18.00, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), DATE_ADD(CURDATE(), INTERVAL 420 DAY)),
 (22,18,3,'MON-2406',  0, 87.00, DATE_SUB(CURDATE(), INTERVAL 10 MONTH),DATE_ADD(CURDATE(), INTERVAL 150 DAY)),
 (23,19,4,'SAL-2501',  9,118.00, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), DATE_ADD(CURDATE(), INTERVAL 230 DAY)),
 (24,20,1,'CGH-2409', 40, 69.00, DATE_SUB(CURDATE(), INTERVAL 13 MONTH),DATE_ADD(CURDATE(), INTERVAL 20 DAY)),
 (25,21,4,'VD3-2411', 90, 78.00, DATE_SUB(CURDATE(), INTERVAL 4 MONTH), DATE_ADD(CURDATE(), INTERVAL 360 DAY)),
 (26,22,1,'VBC-2410',130, 29.00, DATE_SUB(CURDATE(), INTERVAL 5 MONTH), DATE_ADD(CURDATE(), INTERVAL 270 DAY)),
 (27,23,4,'CAL-2412', 52, 97.00, DATE_SUB(CURDATE(), INTERVAL 11 MONTH),DATE_ADD(CURDATE(), INTERVAL 75 DAY)),
 (28,24,3,'POV-2501', 36, 50.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 640 DAY)),
 (29,25,1,'BND-2502', 70, 31.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 900 DAY)),
 (30,26,1,'COT-2503', 18, 40.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), DATE_ADD(CURDATE(), INTERVAL 800 DAY)),
 (31,27,4,'THM-2501', 14,168.00, DATE_SUB(CURDATE(), INTERVAL 3 MONTH), DATE_ADD(CURDATE(), INTERVAL 1500 DAY)),
 (32,28,4,'GTS-2412', 20,455.00, DATE_SUB(CURDATE(), INTERVAL 10 MONTH),DATE_ADD(CURDATE(), INTERVAL 55 DAY)),
 (33,29,1,'SNZ-2503', 66, 48.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), DATE_ADD(CURDATE(), INTERVAL 700 DAY));

-- A week of sales so the dashboard chart has something to show
INSERT INTO sales (id, invoice_no, customer_name, payment_method, created_at) VALUES
 (1 ,'INV-000001','Walk-in','Cash',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY),'10:20:00')),
 (2 ,'INV-000002','Meena R.','UPI',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 6 DAY),'17:45:00')),
 (3 ,'INV-000003','Walk-in','Cash',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY),'11:05:00')),
 (4 ,'INV-000004','Karthik S.','Card',TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 5 DAY),'18:30:00')),
 (5 ,'INV-000005','Walk-in','UPI',   TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY),'09:40:00')),
 (6 ,'INV-000006','Lakshmi N.','Cash',TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 4 DAY),'16:10:00')),
 (7 ,'INV-000007','Walk-in','Cash',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY),'12:25:00')),
 (8 ,'INV-000008','Dr. Ibrahim Clinic','Card',TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 3 DAY),'15:50:00')),
 (9 ,'INV-000009','Walk-in','UPI',   TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY),'10:10:00')),
 (10,'INV-000010','Senthil K.','Cash',TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY),'19:00:00')),
 (11,'INV-000011','Walk-in','Cash',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY),'09:15:00')),
 (12,'INV-000012','Priya D.','UPI',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY),'13:35:00')),
 (13,'INV-000013','Walk-in','Cash',  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY),'17:20:00')),
 (14,'INV-000014','Anand V.','Cash', TIMESTAMP(CURDATE(),'08:30:00')),
 (15,'INV-000015','Walk-in','UPI',   TIMESTAMP(CURDATE(),'08:55:00')),
 (16,'INV-000016','Fathima B.','Card',TIMESTAMP(CURDATE(),'09:10:00'));

INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, gst_percent, line_total)
SELECT t.sale_id, t.medicine_id, t.batch_id, t.qty, m.unit_price, m.gst_percent, t.qty * m.unit_price
FROM (
  SELECT 1 AS sale_id, 1 AS medicine_id, 1 AS batch_id, 3 AS qty UNION ALL
  SELECT 1, 17, 21, 2 UNION ALL
  SELECT 2, 8, 11, 4 UNION ALL SELECT 2, 11, 14, 2 UNION ALL SELECT 2, 12, 15, 1 UNION ALL
  SELECT 3, 14, 17, 2 UNION ALL SELECT 3, 16, 20, 6 UNION ALL
  SELECT 4, 4, 6, 2 UNION ALL SELECT 4, 5, 7, 1 UNION ALL SELECT 4, 22, 26, 2 UNION ALL
  SELECT 5, 1, 1, 4 UNION ALL SELECT 5, 20, 24, 1 UNION ALL
  SELECT 6, 8, 11, 3 UNION ALL SELECT 6, 9, 12, 2 UNION ALL SELECT 6, 10, 13, 1 UNION ALL
  SELECT 7, 2, 3, 3 UNION ALL SELECT 7, 3, 4, 1 UNION ALL
  SELECT 8, 4, 6, 6 UNION ALL SELECT 8, 6, 9, 4 UNION ALL SELECT 8, 14, 17, 5 UNION ALL SELECT 8, 25, 29, 4 UNION ALL
  SELECT 9, 1, 1, 5 UNION ALL SELECT 9, 29, 33, 2 UNION ALL
  SELECT 10, 11, 14, 4 UNION ALL SELECT 10, 12, 15, 3 UNION ALL SELECT 10, 13, 16, 2 UNION ALL
  SELECT 11, 17, 21, 3 UNION ALL SELECT 11, 16, 20, 8 UNION ALL
  SELECT 12, 21, 25, 2 UNION ALL SELECT 12, 23, 27, 1 UNION ALL SELECT 12, 22, 26, 3 UNION ALL
  SELECT 13, 1, 1, 6 UNION ALL SELECT 13, 2, 3, 2 UNION ALL SELECT 13, 20, 24, 2 UNION ALL
  SELECT 14, 8, 11, 5 UNION ALL SELECT 14, 11, 14, 3 UNION ALL
  SELECT 15, 1, 1, 2 UNION ALL SELECT 15, 17, 21, 2 UNION ALL SELECT 15, 24, 28, 1 UNION ALL
  SELECT 16, 19, 23, 1 UNION ALL SELECT 16, 15, 19, 3 UNION ALL SELECT 16, 27, 31, 1
) t
JOIN medicines m ON m.id = t.medicine_id;

-- Work out subtotal, GST and total for each seeded sale
UPDATE sales s
JOIN (
  SELECT sale_id,
         SUM(line_total)                  AS st,
         SUM(line_total * gst_percent/100) AS tx
  FROM sale_items GROUP BY sale_id
) x ON x.sale_id = s.id
SET s.subtotal = x.st,
    s.tax      = ROUND(x.tx, 2),
    s.total    = ROUND(x.st + x.tx - s.discount, 2);

-- Keep AUTO_INCREMENT ahead of the seeded ids
ALTER TABLE sales AUTO_INCREMENT = 17;
