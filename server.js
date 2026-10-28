require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Connect to PostgreSQL (settings come from the .env file)
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// Test route: counts the records in the table
app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM health_facilities');
    res.json({ ok: true, total: Number(result.rows[0].count) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Get all facilities (with optional filters)
app.get('/api/facilities', async (req, res) => {
  try {
    const { type, district, search } = req.query;
    const conditions = [];
    const values = [];

    if (type) {
      values.push(type);
      conditions.push('facility_type = $' + values.length);
    }
    if (district) {
      values.push(district);
      conditions.push('district = $' + values.length);
    }
    if (search) {
      values.push('%' + search + '%');
      conditions.push('name ILIKE $' + values.length);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT id, name, facility_type, district, address, phone, emergency, beds,
              ST_X(geom) AS lng, ST_Y(geom) AS lat
       FROM health_facilities
       ${where}
       ORDER BY id`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Could not load facilities' });
  }
});
// Check the data sent from the form
function validateFacility(body) {
  const errors = [];
  const types = ['Hospital', 'Clinic', 'Health Center'];
  const districts = ['Rawalpindi', 'Islamabad'];

  const name = (body.name || '').trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (name.length < 3 || name.length > 150) {
    errors.push('Name must be 3 to 150 characters.');
  }
  if (!types.includes(body.facility_type)) {
    errors.push('Choose a valid facility type.');
  }
  if (!districts.includes(body.district)) {
    errors.push('Choose a valid district.');
  }
  if (body.lat === '' || body.lat == null || isNaN(lat) || lat < 33.4 || lat > 33.9) {
    errors.push('Latitude must be a number between 33.4 and 33.9.');
  }
  if (body.lng === '' || body.lng == null || isNaN(lng) || lng < 72.8 || lng > 73.4) {
    errors.push('Longitude must be a number between 72.8 and 73.4.');
  }

  let beds = null;
  if (body.beds !== '' && body.beds != null) {
    beds = Number(body.beds);
    if (!Number.isInteger(beds) || beds < 0 || beds > 5000) {
      errors.push('Beds must be a whole number from 0 to 5000.');
    }
  }

  const phone = (body.phone || '').trim();
  if (phone.length > 30) errors.push('Phone is too long.');

  const address = (body.address || '').trim();
  if (address.length > 300) errors.push('Address is too long.');

  return {
    errors,
    data: {
      name,
      facility_type: body.facility_type,
      district: body.district,
      address: address || null,
      phone: phone || null,
      emergency: body.emergency === true || body.emergency === 'true',
      beds,
      lat,
      lng
    }
  };
}

// Add a new facility
app.post('/api/facilities', async (req, res) => {
  const { errors, data } = validateFacility(req.body);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const result = await pool.query(
      `INSERT INTO health_facilities
         (name, facility_type, district, address, phone, emergency, beds, geom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))
       RETURNING id, name, facility_type, district, address, phone, emergency, beds,
                 ST_X(geom) AS lng, ST_Y(geom) AS lat`,
      [data.name, data.facility_type, data.district, data.address, data.phone,
       data.emergency, data.beds, data.lng, data.lat]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: ['Could not save the facility.'] });
  }
});

// Update an existing facility
app.put('/api/facilities/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ errors: ['Invalid id.'] });
  }

  const { errors, data } = validateFacility(req.body);
  if (errors.length) return res.status(400).json({ errors });

  try {
    const result = await pool.query(
      `UPDATE health_facilities
       SET name = $1, facility_type = $2, district = $3, address = $4,
           phone = $5, emergency = $6, beds = $7,
           geom = ST_SetSRID(ST_MakePoint($8, $9), 4326)
       WHERE id = $10
       RETURNING id, name, facility_type, district, address, phone, emergency, beds,
                 ST_X(geom) AS lng, ST_Y(geom) AS lat`,
      [data.name, data.facility_type, data.district, data.address, data.phone,
       data.emergency, data.beds, data.lng, data.lat, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ errors: ['Facility not found.'] });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ errors: ['Could not update the facility.'] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});