// Create the map, centered between Rawalpindi and Islamabad
const map = L.map('map').setView([33.65, 73.06], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

// Filter elements
const searchInput = document.getElementById('searchInput');
const typeSelect = document.getElementById('typeSelect');
const districtSelect = document.getElementById('districtSelect');
const emergencyCheck = document.getElementById('emergencyCheck');
const resetBtn = document.getElementById('resetBtn');
const countText = document.getElementById('countText');
const facilityList = document.getElementById('facilityList');

// Form elements
const facilityForm = document.getElementById('facilityForm');
const formTitle = document.getElementById('formTitle');
const formMessage = document.getElementById('formMessage');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const facilityId = document.getElementById('facilityId');
const fName = document.getElementById('fName');
const fType = document.getElementById('fType');
const fDistrict = document.getElementById('fDistrict');
const fAddress = document.getElementById('fAddress');
const fPhone = document.getElementById('fPhone');
const fBeds = document.getElementById('fBeds');
const fEmergency = document.getElementById('fEmergency');
const fLat = document.getElementById('fLat');
const fLng = document.getElementById('fLng');

// Facilities currently shown (used by the Edit button)
let shownFacilities = [];

// Marker color for each facility type
const colors = {
  'Hospital': '#dc3545',
  'Clinic': '#198754',
  'Health Center': '#fd7e14'
};

function makeIcon(type) {
  const color = colors[type] || '#0b5ed7';
  return L.divIcon({
    className: '',
    html: '<div style="background:' + color + ';width:18px;height:18px;' +
          'border-radius:50%;border:3px solid white;' +
          'box-shadow:0 0 4px rgba(0,0,0,0.6);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10]
  });
}

// Stops page text from being treated as HTML
function esc(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

// Load facilities from the API using the current filters
async function loadFacilities() {
  try {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.append('search', searchInput.value.trim());
    if (typeSelect.value) params.append('type', typeSelect.value);
    if (districtSelect.value) params.append('district', districtSelect.value);

    const response = await fetch('/api/facilities?' + params.toString());
    if (!response.ok) throw new Error('Server error');
    let facilities = await response.json();

    if (emergencyCheck.checked) {
      facilities = facilities.filter(function (f) { return f.emergency; });
    }

    showFacilities(facilities);
  } catch (err) {
    alert('Could not load facilities: ' + err.message);
  }
}

function showFacilities(facilities) {
  shownFacilities = facilities;
  markersLayer.clearLayers();
  facilityList.innerHTML = '';
  countText.textContent = 'Showing ' + facilities.length + ' facilities';

  facilities.forEach(function (f) {
    const marker = L.marker([f.lat, f.lng], { icon: makeIcon(f.facility_type) });
    marker.bindPopup(
      '<b>' + esc(f.name) + '</b><br>' +
      'Type: ' + esc(f.facility_type) + '<br>' +
      'District: ' + esc(f.district) + '<br>' +
      'Address: ' + esc(f.address || 'N/A') + '<br>' +
      'Emergency: ' + (f.emergency ? 'Yes' : 'No') + '<br>' +
      'Beds: ' + (f.beds !== null ? f.beds : 'N/A') + '<br>' +
      'Phone: ' + esc(f.phone || 'N/A') + '<br><br>' +
      '<button type="button" onclick="editFacility(' + f.id + ')">Edit this facility</button>'
    );
    marker.addTo(markersLayer);

    const li = document.createElement('li');
    li.innerHTML = '<b>' + esc(f.name) + '</b><br><small>' +
                   esc(f.facility_type) + ' | ' + esc(f.district) + '</small>';
    li.addEventListener('click', function () {
      map.setView([f.lat, f.lng], 16);
      marker.openPopup();
    });
    facilityList.appendChild(li);
  });
}

// ---------- Filters ----------
searchInput.addEventListener('input', loadFacilities);
typeSelect.addEventListener('change', loadFacilities);
districtSelect.addEventListener('change', loadFacilities);
emergencyCheck.addEventListener('change', loadFacilities);

resetBtn.addEventListener('click', function () {
  searchInput.value = '';
  typeSelect.value = '';
  districtSelect.value = '';
  emergencyCheck.checked = false;
  loadFacilities();
  map.setView([33.65, 73.06], 12);
});

// ---------- Form ----------
function showMessage(text, kind) {
  formMessage.className = 'message ' + kind;
  formMessage.innerHTML = text;
}

function clearForm() {
  facilityForm.reset();
  facilityId.value = '';
  formTitle.textContent = 'Add New Facility';
  saveBtn.textContent = 'Save facility';
  formMessage.className = 'message';
  formMessage.innerHTML = '';
}

// Click on the map to fill latitude and longitude
map.on('click', function (e) {
  fLat.value = e.latlng.lat.toFixed(6);
  fLng.value = e.latlng.lng.toFixed(6);
});

// Called by the Edit button inside the popup
function editFacility(id) {
  const f = shownFacilities.find(function (x) { return x.id === id; });
  if (!f) return;

  facilityId.value = f.id;
  fName.value = f.name;
  fType.value = f.facility_type;
  fDistrict.value = f.district;
  fAddress.value = f.address || '';
  fPhone.value = f.phone || '';
  fBeds.value = f.beds !== null ? f.beds : '';
  fEmergency.checked = f.emergency;
  fLat.value = f.lat;
  fLng.value = f.lng;

  formTitle.textContent = 'Update Facility (ID ' + f.id + ')';
  saveBtn.textContent = 'Update facility';
  formMessage.className = 'message';
  formMessage.innerHTML = '';

  map.closePopup();
  facilityForm.scrollIntoView({ behavior: 'smooth' });
}

// Check the form in the browser first
function checkForm() {
  const errors = [];
  const lat = Number(fLat.value.trim());
  const lng = Number(fLng.value.trim());

  if (fName.value.trim().length < 3) errors.push('Name must be at least 3 characters.');
  if (!fType.value) errors.push('Choose a facility type.');
  if (!fDistrict.value) errors.push('Choose a district.');
  if (fLat.value.trim() === '' || isNaN(lat) || lat < 33.4 || lat > 33.9) {
    errors.push('Latitude must be between 33.4 and 33.9.');
  }
  if (fLng.value.trim() === '' || isNaN(lng) || lng < 72.8 || lng > 73.4) {
    errors.push('Longitude must be between 72.8 and 73.4.');
  }
  if (fBeds.value !== '') {
    const beds = Number(fBeds.value);
    if (!Number.isInteger(beds) || beds < 0 || beds > 5000) {
      errors.push('Beds must be a whole number from 0 to 5000.');
    }
  }
  return errors;
}

facilityForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const errors = checkForm();
  if (errors.length) {
    showMessage(errors.map(esc).join('<br>'), 'error');
    return;
  }

  const body = {
    name: fName.value.trim(),
    facility_type: fType.value,
    district: fDistrict.value,
    address: fAddress.value.trim(),
    phone: fPhone.value.trim(),
    beds: fBeds.value,
    emergency: fEmergency.checked,
    lat: fLat.value.trim(),
    lng: fLng.value.trim()
  };

  const id = facilityId.value;
  const url = id ? '/api/facilities/' + id : '/api/facilities';
  const method = id ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();

    if (!response.ok) {
      showMessage((result.errors || ['Something went wrong.']).map(esc).join('<br>'), 'error');
      return;
    }

    const text = (method === 'POST' ? 'Added: ' : 'Updated: ') +
                 esc(result.name) + ' (ID ' + result.id + ')';
    clearForm();
    showMessage(text, 'success');
    loadFacilities();
    map.setView([result.lat, result.lng], 15);
  } catch (err) {
    showMessage('Could not reach the server.', 'error');
  }
});

cancelBtn.addEventListener('click', clearForm);

loadFacilities();