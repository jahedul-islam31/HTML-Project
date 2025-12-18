// Simple client-only app using localStorage to persist data.
// Keeps serial ids for flights and tickets.

const storageKey = 'cce_air_data_v1';

const defaultState = {
  flights: [],
  bookings: [],
  flightCounter: 1,
  ticketCounter: 1000
};

let state = loadState();

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  return JSON.parse(JSON.stringify(defaultState));
}

/* Services (like BookingService in Java) */
function addFlight(name, from, to, date, time, seats, price) {
  const f = {
    id: state.flightCounter++,
    name, source:from, destination:to, date, time,
    seats: parseInt(seats,10), price: parseFloat(price)
  };
  state.flights.push(f);
  saveState();
  return f;
}

function getFlights() { return state.flights; }
function getBookings() { return state.bookings; }

function bookFlight(passengers, contact, flightId, seatCount) {
  seatCount = parseInt(seatCount, 10);
  const f = state.flights.find(x=>x.id===+flightId);
  if (!f) return {error:'No flight'};
  if (seatCount<=0 || seatCount>f.seats) return {error:'Not enough seats'};
  f.seats -= seatCount;
  const booking = {
    ticketId: state.ticketCounter++,
    passengers, contact, flightId: f.id, seatCount
  };
  state.bookings.push(booking);
  saveState();
  return {booking};
}

function cancelBooking(ticketId) {
  ticketId = +ticketId;
  const idx = state.bookings.findIndex(b=>b.ticketId===ticketId);
  if (idx===-1) return false;
  const b = state.bookings[idx];
  const f = state.flights.find(f=>f.id===b.flightId);
  if (f) f.seats += b.seatCount;
  state.bookings.splice(idx,1);
  saveState();
  return true;
}

/* UI helpers */
const output = document.getElementById('output');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalOk = document.getElementById('modal-ok');
const modalCancel = document.getElementById('modal-cancel');

function showModal(contentHtml, okHandler, showCancel=true) {
  modalBody.innerHTML = contentHtml;
  modal.classList.remove('hidden');
  modalOk.onclick = () => { okHandler(); closeModal(); };
  modalCancel.style.display = showCancel ? 'inline-block' : 'none';
  modalCancel.onclick = closeModal;
}

function closeModal(){ modal.classList.add('hidden'); modalBody.innerHTML=''; }

/* Render tables */
function renderFlightsTable() {
  const flights = getFlights();
  if (flights.length===0) {
    output.innerHTML = '<p class="small">No flights added yet.</p>';
    return;
  }
  let html = `<table class="table"><thead><tr>
    <th>ID</th><th>Name</th><th>From</th><th>To</th><th>Date</th><th>Time</th><th>Seats</th><th>Price</th>
  </tr></thead><tbody>`;
  flights.forEach(f=>{
    html += `<tr><td>${f.id}</td><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.source)}</td>
      <td>${escapeHtml(f.destination)}</td><td>${f.date}</td><td>${f.time}</td><td>${f.seats}</td><td>${f.price}</td></tr>`;
  });
  html += '</tbody></table>';
  output.innerHTML = html;
}

function renderBookingsTable() {
  const bookings = getBookings();
  if (bookings.length===0) {
    output.innerHTML = '<p class="small">No bookings yet.</p>';
    return;
  }
  let html = `<table class="table"><thead><tr>
    <th>Ticket ID</th><th>Passengers</th><th>Flight ID</th><th>Seats</th><th>Contact</th>
  </tr></thead><tbody>`;
  bookings.forEach(b=>{
    html += `<tr><td>${b.ticketId}</td><td>${escapeHtml(b.passengers.join(', '))}</td>
      <td>${b.flightId}</td><td>${b.seatCount}</td><td>${escapeHtml(b.contact)}</td></tr>`;
  });
  html += '</tbody></table>';
  output.innerHTML = html;
}

/* Events from buttons */
document.getElementById('btnAddFlight').addEventListener('click', ()=>{
  const form = `
    <label>Flight Name</label><input id="f_name" />
    <label>From</label><input id="f_from" />
    <label>To</label><input id="f_to" />
    <label>Date (YYYY-MM-DD)</label><input id="f_date" placeholder="2025-12-31" />
    <label>Time (HH:MM)</label><input id="f_time" placeholder="14:30" />
    <label>Seats</label><input id="f_seats" type="number" />
    <label>Price (BDT)</label><input id="f_price" type="number" step="0.01" />
  `;
  showModal(form, ()=>{
    try {
      const name = by('f_name').value.trim();
      const from = by('f_from').value.trim();
      const to = by('f_to').value.trim();
      const date = by('f_date').value.trim();
      const time = by('f_time').value.trim();
      const seats = by('f_seats').value.trim();
      const price = by('f_price').value.trim();
      if (!name || !from || !to) throw 'Fill required';
      addFlight(name, from, to, date||'-', time||'-', seats||0, price||0);
      output.innerHTML = `<p>✅ Flight added: ${escapeHtml(name)} (ID ${state.flightCounter-1})</p>`;
    } catch(e) {
      alert('Invalid input.');
    }
  });
});

document.getElementById('btnBook').addEventListener('click', ()=>{
  // ask simple form: flight id, seat count, contact, then passenger names
  const form = `
    <label>Flight ID</label><input id="b_fid" type="number" />
    <label>Number of Seats</label><input id="b_count" type="number" />
    <label>Contact (email/phone)</label><input id="b_contact" />
  `;
  showModal(form, ()=>{
    const fid = by('b_fid').value.trim();
    const count = +by('b_count').value.trim();
    const contact = by('b_contact').value.trim();
    if (!fid || !count || count<=0) { alert('Enter valid values'); return; }
    // collect passenger names one by one
    const passengers = [];
    (function ask(i){
      if (i>count) {
        const res = bookFlight(passengers, contact, +fid, count);
        if (res.error) {
          output.innerHTML = `<p class="small">❌ ${res.error}</p>`;
        } else {
          const b = res.booking;
          output.innerHTML = `<p>🎉 Booking success. Ticket ID: ${b.ticketId}<br>Flight: ${b.flightId}</p>`;
        }
        return;
      }
      const name = prompt('Enter passenger '+i+' name:');
      if (!name) { alert('Passenger name required'); return; }
      passengers.push(name);
      ask(i+1);
    })(1);
  });
});

document.getElementById('btnShowFlights').addEventListener('click', renderFlightsTable);
document.getElementById('btnShowBookings').addEventListener('click', renderBookingsTable);

document.getElementById('btnCancelBooking').addEventListener('click', ()=>{
  const html = `<label>Ticket ID to cancel</label><input id="cancel_id" />`;
  showModal(html, ()=>{
    const id = by('cancel_id').value.trim();
    if (!id) { alert('Provide ID'); return; }
    const ok = cancelBooking(+id);
    output.innerHTML = ok ? `<p>✅ Cancelled ticket ${id}</p>` : `<p>❌ No ticket ${id}</p>`;
  });
});

document.getElementById('btnComingSoon').addEventListener('click', ()=>{
  output.innerHTML = `<p>🚀 Upcoming: export PDF, refunds, admin dashboard, loyalty points.</p>`;
});

/* small helpers */
function by(id){ return document.getElementById(id); }
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

/* initial render */
output.innerHTML = `<p class="small">Welcome! Add flights and start booking. This app stores data locally in your browser.</p>`;
renderFlightsTable();
