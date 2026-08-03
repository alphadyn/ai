const storageKey = "northstar-ehr-state-v1";

const initialPatients = [
  {
    id: 1,
    name: "Maya Thompson",
    mrn: "MRN-10482",
    age: 41,
    sex: "Female",
    status: "Stable",
    priority: "Routine",
    diagnosis: "Type 2 diabetes, hypertension",
    lastVisit: "2 days ago",
    provider: "Dr. Elena Ruiz",
    room: "Suite 3B",
    allergies: ["Penicillin", "Latex"],
    medications: ["Metformin 500 mg", "Lisinopril 10 mg", "Atorvastatin 20 mg"],
    vitals: { bp: "118/76", hr: 72, temp: "98.4°F", spO2: "98%" },
    labs: ["A1C 6.8", "LDL 96", "Creatinine 0.9"],
    notes: [
      {
        title: "Medication review",
        summary: "Patient reports strong adherence and no new symptoms.",
        type: "Primary care",
        time: "Today • 09:15"
      }
    ],
    appointments: [
      { time: "08:30", title: "Annual wellness review", location: "Exam Room 2" },
      { time: "14:00", title: "Lab follow-up", location: "Lab Desk" }
    ],
    billing: { balance: 1260, insurance: "Blue Cross" }
  },
  {
    id: 2,
    name: "Jonathan Lee",
    mrn: "MRN-20811",
    age: 58,
    sex: "Male",
    status: "Monitoring",
    priority: "Urgent",
    diagnosis: "Post-op recovery, mild chest discomfort",
    lastVisit: "Today",
    provider: "Dr. Amir Hassan",
    room: "Recovery 1",
    allergies: ["Shellfish"],
    medications: ["Warfarin 2 mg", "Acetaminophen 500 mg"],
    vitals: { bp: "132/88", hr: 84, temp: "99.0°F", spO2: "97%" },
    labs: ["INR 2.1", "Hemoglobin 13.2", "WBC 8.4"],
    notes: [
      {
        title: "Post-op recovery",
        summary: "Patient remains stable after procedure. Encourage mobility and hydration.",
        type: "Post-op follow-up",
        time: "Today • 11:40"
      }
    ],
    appointments: [
      { time: "10:00", title: "Cardiac recheck", location: "Telemetry Unit" },
      { time: "16:30", title: "Discharge planning", location: "Nursing Station" }
    ],
    billing: { balance: 2140, insurance: "Aetna" }
  },
  {
    id: 3,
    name: "Sofia Alvarez",
    mrn: "MRN-31544",
    age: 33,
    sex: "Female",
    status: "Stable",
    priority: "Routine",
    diagnosis: "Pregnancy follow-up",
    lastVisit: "Yesterday",
    provider: "Dr. Priya Singh",
    room: "Suite 4A",
    allergies: ["None listed"],
    medications: ["Prenatal vitamin", "Folic acid 400 mcg"],
    vitals: { bp: "112/70", hr: 68, temp: "98.7°F", spO2: "99%" },
    labs: ["Rh positive", "Hemoglobin 11.9", "Glucose 91"],
    notes: [
      {
        title: "Prenatal visit",
        summary: "No concerning symptoms. Continue routine monitoring.",
        type: "Primary care",
        time: "Yesterday • 15:20"
      }
    ],
    appointments: [
      { time: "09:00", title: "Ultrasound review", location: "Imaging" },
      { time: "13:20", title: "Supportive counseling", location: "Room 4A" }
    ],
    billing: { balance: 835, insurance: "United Healthcare" }
  }
];

let patients = loadPatients();
let selectedPatientId = loadSelectedPatient();

function loadPatients() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.patients) return parsed.patients;
    }
  } catch (error) {
    console.warn("Unable to load saved patients", error);
  }
  return initialPatients;
}

function loadSelectedPatient() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.selectedPatientId) return parsed.selectedPatientId;
    }
  } catch (error) {
    console.warn("Unable to load selected patient", error);
  }
  return initialPatients[0].id;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({ patients, selectedPatientId }));
}

function getSelectedPatient() {
  return patients.find((patient) => patient.id === selectedPatientId) || patients[0];
}

function renderPatientList() {
  const searchTerm = document.getElementById("patientSearch").value.toLowerCase();
  const filtered = patients.filter((patient) =>
    `${patient.name} ${patient.mrn}`.toLowerCase().includes(searchTerm)
  );

  const list = document.getElementById("patientList");
  if (!filtered.length) {
    list.innerHTML = '<p class="mini-card">No patients matched your search.</p>';
    return;
  }

  list.innerHTML = filtered
    .map((patient) => {
      const active = patient.id === selectedPatientId ? "active" : "";
      return `
        <button class="patient-card ${active}" data-id="${patient.id}">
          <strong>${patient.name}</strong>
          <span>${patient.mrn} • ${patient.priority}</span>
          <span>${patient.status}</span>
        </button>
      `;
    })
    .join("");
}

function renderPatientDetail() {
  const detail = document.getElementById("patientDetail");
  const patient = getSelectedPatient();

  detail.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Current patient</p>
        <h3>${patient.name}</h3>
        <p>${patient.mrn} • ${patient.age} years • ${patient.sex}</p>
      </div>
      <span class="pill">${patient.priority}</span>
    </div>

    <div class="detail-grid">
      <article class="mini-card">
        <h4>Demographics</h4>
        <ul>
          <li>Primary diagnosis: ${patient.diagnosis}</li>
          <li>Provider: ${patient.provider}</li>
          <li>Care location: ${patient.room}</li>
          <li>Last visit: ${patient.lastVisit}</li>
        </ul>
      </article>

      <article class="mini-card">
        <h4>Latest vitals</h4>
        <ul>
          <li>Blood pressure: ${patient.vitals.bp}</li>
          <li>Heart rate: ${patient.vitals.hr} bpm</li>
          <li>Temperature: ${patient.vitals.temp}</li>
          <li>SpO₂: ${patient.vitals.spO2}</li>
        </ul>
      </article>

      <article class="mini-card">
        <h4>Allergies & meds</h4>
        <ul>
          <li>Allergies: ${patient.allergies.join(", ")}</li>
          <li>Medications: ${patient.medications.join(", ")}</li>
        </ul>
      </article>

      <article class="mini-card">
        <h4>Lab markers</h4>
        <ul>
          ${patient.labs.map((lab) => `<li>${lab}</li>`).join("")}
        </ul>
      </article>
    </div>

    <div class="mini-card" style="margin-top:12px;">
      <h4>Recent notes</h4>
      <ul>
        ${patient.notes
          .map(
            (note) => `<li><strong>${note.title}</strong> — ${note.summary} <em>(${note.type}, ${note.time})</em></li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

function renderAppointments() {
  const patient = getSelectedPatient();
  const container = document.getElementById("appointmentsList");
  container.innerHTML = patient.appointments
    .map(
      (appointment) => `
        <div class="list-item">
          <strong>${appointment.time} • ${appointment.title}</strong>
          <span>${appointment.location}</span>
        </div>
      `
    )
    .join("");
}

function renderSnapshot() {
  const patient = getSelectedPatient();
  const container = document.getElementById("snapshotPanel");
  container.innerHTML = `
    <div class="snapshot-item">
      <span>Care team</span>
      <strong>${patient.provider}</strong>
    </div>
    <div class="snapshot-item">
      <span>Outstanding balance</span>
      <strong>$${patient.billing.balance}</strong>
    </div>
    <div class="snapshot-item">
      <span>Insurance</span>
      <strong>${patient.billing.insurance}</strong>
    </div>
    <div class="snapshot-item">
      <span>Next follow-up</span>
      <strong>${patient.appointments[1].title}</strong>
    </div>
  `;
}

function render() {
  renderPatientList();
  renderPatientDetail();
  renderAppointments();
  renderSnapshot();
  saveState();
}

function handlePatientSelection(id) {
  selectedPatientId = Number(id);
  render();
}

function attachEvents() {
  document.getElementById("patientSearch").addEventListener("input", renderPatientList);

  document.getElementById("patientList").addEventListener("click", (event) => {
    const card = event.target.closest(".patient-card");
    if (card) handlePatientSelection(card.dataset.id);
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });

  document.getElementById("quickEncounterBtn").addEventListener("click", () => {
    document.getElementById("encounterForm").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("encounterForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const patient = getSelectedPatient();
    const note = {
      title: form.title.value.trim() || "Untitled encounter",
      summary: form.summary.value.trim() || "No summary captured.",
      type: form.type.value,
      time: `Today • ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    };

    patient.notes.unshift(note);
    patient.appointments.unshift({ time: "Now", title: note.title, location: "Clinical note" });
    render();

    document.getElementById("encounterStatus").textContent = `Encounter saved for ${patient.name}.`;
    form.reset();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const patient = getSelectedPatient();
    alert(`Exporting summary for ${patient.name} to PDF/CSV.`);
  });
}

attachEvents();
render();
