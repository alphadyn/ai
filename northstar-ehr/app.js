const storageKey = "northstar-ehr-state-v3";

const rolePermissions = {
  clinician: {
    label: "Clinician",
    actions: ["encounter:create", "appointment:complete", "task:complete", "patient:select", "report:export"]
  },
  admin: {
    label: "Admin",
    actions: ["appointment:cancel", "appointment:complete", "patient:select", "report:export", "audit:view", "billing:view"]
  }
};

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
      { id: "a-101", time: "08:30", title: "Annual wellness review", location: "Exam Room 2", status: "Scheduled" },
      { id: "a-102", time: "14:00", title: "Lab follow-up", location: "Lab Desk", status: "Scheduled" }
    ],
    billing: { balance: 1260, insurance: "Blue Cross", claimStatus: "Submitted", lastPayment: "2026-08-01" },
    chartCompleted: true,
    medicationReviewed: true,
    carePlan: {
      followUpDate: "2026-08-12",
      tasks: [
        { label: "Review A1C trend", status: "Open" },
        { label: "Confirm home blood pressure log", status: "Open" }
      ]
    }
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
      { id: "a-201", time: "10:00", title: "Cardiac recheck", location: "Telemetry Unit", status: "In Progress" },
      { id: "a-202", time: "16:30", title: "Discharge planning", location: "Nursing Station", status: "Scheduled" }
    ],
    billing: { balance: 2140, insurance: "Aetna", claimStatus: "Pending review", lastPayment: "2026-07-28" },
    chartCompleted: false,
    medicationReviewed: false,
    carePlan: {
      followUpDate: "2026-08-05",
      tasks: [
        { label: "Confirm discharge readiness", status: "Open" },
        { label: "Repeat pain assessment", status: "Open" }
      ]
    }
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
      { id: "a-301", time: "09:00", title: "Ultrasound review", location: "Imaging", status: "Scheduled" },
      { id: "a-302", time: "13:20", title: "Supportive counseling", location: "Room 4A", status: "Scheduled" }
    ],
    billing: { balance: 835, insurance: "United Healthcare", claimStatus: "Paid", lastPayment: "2026-08-02" },
    chartCompleted: true,
    medicationReviewed: true,
    carePlan: {
      followUpDate: "2026-08-19",
      tasks: [
        { label: "Upload ultrasound report", status: "Open" }
      ]
    }
  }
];

function safeLocalStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return "Not scheduled";
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function createAppointmentId() {
  return `a-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

function normalizeTask(task) {
  if (typeof task === "string") {
    return { label: task, status: "Open" };
  }

  return {
    label: task.label,
    status: task.status || "Open"
  };
}

function normalizeAppointment(appointment) {
  return {
    id: appointment.id || createAppointmentId(),
    time: appointment.time,
    title: appointment.title,
    location: appointment.location,
    status: appointment.status || "Scheduled"
  };
}

function normalizePatient(patient) {
  return {
    ...patient,
    chartCompleted: Boolean(patient.chartCompleted),
    medicationReviewed: patient.medicationReviewed !== false,
    appointments: (patient.appointments || []).map(normalizeAppointment),
    carePlan: {
      followUpDate: patient.carePlan?.followUpDate || "",
      tasks: (patient.carePlan?.tasks || []).map(normalizeTask)
    },
    billing: {
      claimStatus: "Pending review",
      lastPayment: "Not recorded",
      ...patient.billing
    }
  };
}

function normalizeAuditEntry(entry) {
  return {
    id: entry.id || `audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    actorRole: entry.actorRole || "clinician",
    actorLabel: entry.actorLabel || rolePermissions[entry.actorRole || "clinician"].label,
    action: entry.action || "system:event",
    patientName: entry.patientName || "System",
    details: entry.details || "No details provided"
  };
}

function normalizeCurrentUser(user) {
  const role = rolePermissions[user?.role] ? user.role : "clinician";
  return {
    role,
    label: rolePermissions[role].label
  };
}

function loadPatients() {
  const storage = safeLocalStorage();

  try {
    const saved = storage?.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.patients) {
        return parsed.patients.map(normalizePatient);
      }
    }
  } catch (error) {
    console.warn("Unable to load saved patients", error);
  }

  return initialPatients.map(normalizePatient);
}

function loadAuditTrail() {
  const storage = safeLocalStorage();

  try {
    const saved = storage?.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.auditTrail) {
        return parsed.auditTrail.map(normalizeAuditEntry);
      }
    }
  } catch (error) {
    console.warn("Unable to load audit trail", error);
  }

  return [];
}

function loadCurrentUser() {
  const storage = safeLocalStorage();

  try {
    const saved = storage?.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.currentUser) return normalizeCurrentUser(parsed.currentUser);
    }
  } catch (error) {
    console.warn("Unable to load current user", error);
  }

  return normalizeCurrentUser({ role: "clinician" });
}

function loadSelectedPatient(patients) {
  const storage = safeLocalStorage();

  try {
    const saved = storage?.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.selectedPatientId) return parsed.selectedPatientId;
    }
  } catch (error) {
    console.warn("Unable to load selected patient", error);
  }

  return patients[0]?.id;
}

let patients = loadPatients();
let selectedPatientId = loadSelectedPatient(patients);
let currentUser = loadCurrentUser();
let auditTrail = loadAuditTrail();
let currentView = loadCurrentView();

function saveState() {
  const storage = safeLocalStorage();
  storage?.setItem(storageKey, JSON.stringify({ patients, selectedPatientId, currentUser, auditTrail, currentView }));
}

function loadCurrentView() {
  const storage = safeLocalStorage();

  try {
    const saved = storage?.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.currentView) return parsed.currentView;
    }
  } catch (error) {
    console.warn("Unable to load current view", error);
  }

  return "overview";
}

function getSelectedPatient() {
  return patients.find((patient) => patient.id === selectedPatientId) || patients[0];
}

function getRoleLabel(role) {
  return rolePermissions[role]?.label || role;
}

function hasPermission(role, action) {
  return Boolean(rolePermissions[role]?.actions.includes(action));
}

function appendAuditEntry(entry) {
  auditTrail.unshift(normalizeAuditEntry(entry));
  auditTrail = auditTrail.slice(0, 30);
}

function recordAudit(action, patientName, details) {
  appendAuditEntry({
    action,
    patientName,
    details,
    actorRole: currentUser.role,
    actorLabel: currentUser.label
  });
}

function evaluatePermission(role, action, patientName) {
  if (hasPermission(role, action)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `${getRoleLabel(role)} role cannot ${action.replace(":", " ")}.`,
    audit: {
      action: `${action}:denied`,
      patientName,
      details: `${getRoleLabel(role)} attempted ${action}.`
    }
  };
}

function setCurrentRole(role) {
  const nextUser = normalizeCurrentUser({ role });
  currentUser = nextUser;
  appendAuditEntry({
    action: "role:switch",
    patientName: "System",
    details: `Switched active role to ${nextUser.label}.`,
    actorRole: nextUser.role,
    actorLabel: nextUser.label
  });
  saveState();
  return currentUser;
}

function setCurrentView(view) {
  currentView = view;
  saveState();
}

function getDetailCardsForView(patient, openTasks) {
  const cardsByView = {
    overview: [
      {
        title: "Demographics",
        items: [
          `Primary diagnosis: ${patient.diagnosis}`,
          `Provider: ${patient.provider}`,
          `Care location: ${patient.room}`,
          `Last visit: ${patient.lastVisit}`
        ]
      },
      {
        title: "Latest vitals",
        items: [
          `Blood pressure: ${patient.vitals.bp}`,
          `Heart rate: ${patient.vitals.hr} bpm`,
          `Temperature: ${patient.vitals.temp}`,
          `SpO₂: ${patient.vitals.spO2}`
        ]
      },
      {
        title: "Allergies & meds",
        items: [
          `Allergies: ${patient.allergies.join(", ")}`,
          `Medications: ${patient.medications.join(", ")}`,
          `Medication review: ${patient.medicationReviewed ? "Completed" : "Pending"}`
        ]
      },
      {
        title: "Care plan",
        items: [
          `Follow-up date: ${formatDisplayDate(patient.carePlan.followUpDate)}`,
          `Chart status: ${patient.chartCompleted ? "Completed" : "In progress"}`,
          `Open tasks: ${openTasks.length}`
        ],
        action: "task"
      },
      {
        title: "Lab markers",
        items: patient.labs
      },
      {
        title: "Revenue cycle",
        items: [
          `Outstanding balance: ${formatCurrency(patient.billing.balance)}`,
          `Insurance: ${patient.billing.insurance}`,
          `Claim status: ${patient.billing.claimStatus}`,
          `Last payment: ${patient.billing.lastPayment}`
        ]
      }
    ],
    patients: [
      {
        title: "Demographics",
        items: [
          `Primary diagnosis: ${patient.diagnosis}`,
          `Provider: ${patient.provider}`,
          `Care location: ${patient.room}`,
          `Last visit: ${patient.lastVisit}`
        ]
      },
      {
        title: "Care plan",
        items: [
          `Follow-up date: ${formatDisplayDate(patient.carePlan.followUpDate)}`,
          `Priority: ${patient.priority}`,
          `Open tasks: ${openTasks.length}`
        ],
        action: "task"
      }
    ],
    appointments: [
      {
        title: "Schedule summary",
        items: patient.appointments.map(
          (appointment) => `${appointment.time} • ${appointment.title} • ${appointment.status}`
        )
      },
      {
        title: "Care plan",
        items: [
          `Next follow-up: ${formatDisplayDate(patient.carePlan.followUpDate)}`,
          `Open tasks: ${openTasks.length}`,
          `Chart status: ${patient.chartCompleted ? "Completed" : "In progress"}`
        ]
      }
    ],
    labs: [
      {
        title: "Latest vitals",
        items: [
          `Blood pressure: ${patient.vitals.bp}`,
          `Heart rate: ${patient.vitals.hr} bpm`,
          `Temperature: ${patient.vitals.temp}`,
          `SpO₂: ${patient.vitals.spO2}`
        ]
      },
      {
        title: "Lab markers",
        items: patient.labs
      },
      {
        title: "Medication profile",
        items: [
          `Allergies: ${patient.allergies.join(", ")}`,
          `Medications: ${patient.medications.join(", ")}`,
          `Medication review: ${patient.medicationReviewed ? "Completed" : "Pending"}`
        ]
      }
    ],
    billing: [
      {
        title: "Revenue cycle",
        items: [
          `Outstanding balance: ${formatCurrency(patient.billing.balance)}`,
          `Insurance: ${patient.billing.insurance}`,
          `Claim status: ${patient.billing.claimStatus}`,
          `Last payment: ${patient.billing.lastPayment}`
        ]
      },
      {
        title: "Patient status",
        items: [
          `Patient: ${patient.name}`,
          `Priority: ${patient.priority}`,
          `Provider: ${patient.provider}`
        ]
      }
    ]
  };

  return cardsByView[currentView] || cardsByView.overview;
}

function getVisibleSections(view) {
  return {
    overviewSection: view === "overview",
    recordsSection: view === "overview" || view === "patients" || view === "labs" || view === "billing",
    operationsSection: view === "overview" || view === "appointments" || view === "billing",
    encounterSection: view === "overview" || view === "patients" || view === "labs",
    auditSection: view === "overview" || view === "billing" || view === "appointments"
  };
}

function renderNavigation() {
  document.querySelectorAll(".nav-link").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === currentView);
  });
}

function applyViewState() {
  const visibility = getVisibleSections(currentView);
  Object.entries(visibility).forEach(([sectionId, visible]) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.classList.toggle("hidden-section", !visible);
  });
}

function parseVitalsInput(rawVitals) {
  const nextVitals = {};
  const input = rawVitals.trim();

  if (!input) return nextVitals;

  const segments = input.split(",").map((segment) => segment.trim()).filter(Boolean);

  segments.forEach((segment) => {
    const lower = segment.toLowerCase();

    if (lower.startsWith("bp")) {
      nextVitals.bp = segment.replace(/^bp\s*/i, "").trim();
    } else if (lower.startsWith("hr")) {
      const match = segment.match(/(\d+)/);
      if (match) nextVitals.hr = Number(match[1]);
    } else if (lower.startsWith("temp")) {
      nextVitals.temp = segment.replace(/^temp\s*/i, "").trim();
    } else if (lower.startsWith("spo2") || lower.includes("spo")) {
      nextVitals.spO2 = segment.replace(/^spo2?\s*/i, "").trim();
    }
  });

  return nextVitals;
}

function calculateDashboardStats(patientList) {
  const totalPatients = patientList.length || 1;
  const totalAppointments = patientList.reduce((count, patient) => count + patient.appointments.length, 0);
  const completedCharts = patientList.filter((patient) => patient.chartCompleted).length;
  const medicationReviewed = patientList.filter((patient) => patient.medicationReviewed).length;
  const overdueTasks = patientList.reduce(
    (count, patient) => count + patient.carePlan.tasks.filter((task) => task.status !== "Done").length,
    0
  );
  const criticalFollowups = patientList.filter((patient) => {
    const dueDate = patient.carePlan.followUpDate ? new Date(`${patient.carePlan.followUpDate}T00:00:00`) : null;
    const isOverdue = dueDate ? dueDate.getTime() < Date.now() : false;
    return patient.priority === "Urgent" || isOverdue;
  }).length;

  return {
    patientsToday: patientList.length,
    patientsTodayMeta: `${totalAppointments} scheduled visits`,
    completedCharts,
    completedChartsMeta: `${Math.round((completedCharts / totalPatients) * 100)}% completion rate`,
    criticalFollowups,
    criticalFollowupsMeta: `${overdueTasks} open care tasks`,
    medicationReconciliation: `${Math.round((medicationReviewed / totalPatients) * 100)}%`,
    medicationReconciliationMeta: `${medicationReviewed} patient charts reviewed`
  };
}

function applyEncounterToPatient(patient, encounter) {
  const updatedVitals = parseVitalsInput(encounter.vitals || "");
  const note = {
    title: encounter.title.trim() || "Untitled encounter",
    summary: encounter.summary.trim() || "No summary captured.",
    type: encounter.type,
    time: `Today • ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
  };

  patient.notes.unshift(note);
  patient.chartCompleted = true;
  patient.medicationReviewed = true;
  patient.lastVisit = "Today";
  patient.status = encounter.followup ? "Follow-up scheduled" : "Stable";
  patient.vitals = { ...patient.vitals, ...updatedVitals };

  if (encounter.followup) {
    patient.carePlan.followUpDate = encounter.followup;
    patient.carePlan.tasks.unshift({ label: `Complete ${note.title.toLowerCase()} follow-up`, status: "Open" });
    patient.appointments.unshift(
      normalizeAppointment({
        time: formatDisplayDate(encounter.followup),
        title: `Follow-up: ${note.title}`,
        location: patient.room,
        status: "Scheduled"
      })
    );
  }

  return note;
}

function createEncounterForPatient(patient, encounter, role = currentUser.role) {
  const permission = evaluatePermission(role, "encounter:create", patient.name);
  if (!permission.allowed) {
    return permission;
  }

  const note = applyEncounterToPatient(patient, encounter);
  appendAuditEntry({
    action: "encounter:create",
    patientName: patient.name,
    details: `Saved encounter \"${note.title}\" and updated the care plan.`,
    actorRole: role,
    actorLabel: getRoleLabel(role)
  });
  return { allowed: true, note };
}

function updateAppointmentStatus(patientId, appointmentId, nextStatus, role = currentUser.role) {
  const patient = patients.find((item) => item.id === patientId);
  if (!patient) return { allowed: false, message: "Patient not found." };

  const appointment = patient.appointments.find((item) => item.id === appointmentId);
  if (!appointment) return { allowed: false, message: "Appointment not found." };

  const action = nextStatus === "Cancelled" ? "appointment:cancel" : "appointment:complete";
  const permission = evaluatePermission(role, action, patient.name);
  if (!permission.allowed) {
    return permission;
  }

  appointment.status = nextStatus;
  if (nextStatus === "Completed") {
    patient.chartCompleted = true;
    patient.status = "Stable";
  }

  appendAuditEntry({
    action,
    patientName: patient.name,
    details: `${appointment.title} marked ${nextStatus.toLowerCase()}.`,
    actorRole: role,
    actorLabel: getRoleLabel(role)
  });

  saveState();
  return { allowed: true, appointment };
}

function markTaskDone(patient, role = currentUser.role) {
  const permission = evaluatePermission(role, "task:complete", patient.name);
  if (!permission.allowed) {
    return permission;
  }

  const nextOpenTask = patient.carePlan.tasks.find((task) => task.status !== "Done");
  if (!nextOpenTask) return { allowed: true, changed: false };
  nextOpenTask.status = "Done";
  appendAuditEntry({
    action: "task:complete",
    patientName: patient.name,
    details: `Completed task \"${nextOpenTask.label}\".`,
    actorRole: role,
    actorLabel: getRoleLabel(role)
  });
  return { allowed: true, changed: true, task: nextOpenTask };
}

function buildExportPayload(patient) {
  return {
    exportedAt: new Date().toISOString(),
    exportedBy: currentUser.label,
    patient: {
      name: patient.name,
      mrn: patient.mrn,
      provider: patient.provider,
      diagnosis: patient.diagnosis,
      priority: patient.priority,
      status: patient.status,
      chartCompleted: patient.chartCompleted,
      medicationReviewed: patient.medicationReviewed,
      vitals: patient.vitals,
      billing: patient.billing,
      followUpDate: patient.carePlan.followUpDate,
      appointments: patient.appointments,
      tasks: patient.carePlan.tasks,
      notes: patient.notes
    }
  };
}

function downloadPatientExport(patient) {
  const payload = buildExportPayload(patient);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${patient.mrn.toLowerCase()}-summary.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderDashboardStats() {
  const stats = calculateDashboardStats(patients);
  document.getElementById("patientsTodayValue").textContent = stats.patientsToday;
  document.getElementById("patientsTodayMeta").textContent = stats.patientsTodayMeta;
  document.getElementById("completedChartsValue").textContent = stats.completedCharts;
  document.getElementById("completedChartsMeta").textContent = stats.completedChartsMeta;
  document.getElementById("criticalFollowupsValue").textContent = stats.criticalFollowups;
  document.getElementById("criticalFollowupsMeta").textContent = stats.criticalFollowupsMeta;
  document.getElementById("medRecValue").textContent = stats.medicationReconciliation;
  document.getElementById("medRecMeta").textContent = stats.medicationReconciliationMeta;
}

function renderRoleSummary() {
  const roleValue = document.getElementById("roleValue");
  const roleHelp = document.getElementById("roleHelp");
  const roleSelector = document.getElementById("roleSelector");
  if (!roleValue || !roleHelp || !roleSelector) return;

  roleValue.textContent = currentUser.label;
  roleHelp.textContent = currentUser.role === "clinician"
    ? "Can record encounters and complete care tasks."
    : "Can review audit history and manage cancellations.";
  roleSelector.value = currentUser.role;
}

function renderPatientList() {
  const searchField = document.getElementById("patientSearch");
  const searchTerm = searchField ? searchField.value.toLowerCase() : "";
  const filtered = patients.filter((patient) =>
    `${patient.name} ${patient.mrn} ${patient.priority} ${patient.status}`.toLowerCase().includes(searchTerm)
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
  const openTasks = patient.carePlan.tasks.filter((task) => task.status !== "Done");
  const canCompleteTask = hasPermission(currentUser.role, "task:complete");
  const detailCards = getDetailCardsForView(patient, openTasks);

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
      ${detailCards
        .map(
          (card) => `
            <article class="mini-card">
              <h4>${card.title}</h4>
              <ul>
                ${card.items.map((item) => `<li>${item}</li>`).join("")}
              </ul>
              ${card.action === "task" ? `<button class="ghost-btn action-btn" id="completeTaskBtn" type="button" ${canCompleteTask ? "" : "disabled"}>Complete next task</button>` : ""}
            </article>
          `
        )
        .join("")}
    </div>

    <div class="mini-card detail-notes">
      <h4>Recent notes</h4>
      <ul>
        ${patient.notes
          .map(
            (note) => `<li><strong>${note.title}</strong> — ${note.summary} <em>(${note.type}, ${note.time})</em></li>`
          )
          .join("")}
      </ul>
    </div>

    <div class="mini-card detail-notes">
      <h4>Recent audit trail</h4>
      <ul>
        ${auditTrail
          .filter((entry) => entry.patientName === patient.name)
          .slice(0, 4)
          .map((entry) => `<li><strong>${entry.actorLabel}</strong> — ${entry.details} <em>(${entry.action})</em></li>`)
          .join("") || "<li>No audit events for this patient yet.</li>"}
      </ul>
    </div>
  `;
}

function renderAppointments() {
  const patient = getSelectedPatient();
  const container = document.getElementById("appointmentsList");
  const canComplete = hasPermission(currentUser.role, "appointment:complete");
  const canCancel = hasPermission(currentUser.role, "appointment:cancel");
  container.innerHTML = patient.appointments
    .map(
      (appointment) => `
        <div class="list-item appointment-item ${appointment.status.toLowerCase().replace(/\s+/g, "-")}">
          <div>
            <strong>${appointment.time} • ${appointment.title}</strong>
            <span>${appointment.location} • ${appointment.status}</span>
          </div>
          <div class="appointment-actions">
            <button class="ghost-btn action-btn" type="button" data-action="complete" data-id="${appointment.id}" ${canComplete ? "" : "disabled"}>Complete</button>
            <button class="ghost-btn action-btn" type="button" data-action="cancel" data-id="${appointment.id}" ${canCancel ? "" : "disabled"}>Cancel</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderSnapshot() {
  const patient = getSelectedPatient();
  const openTasks = patient.carePlan.tasks.filter((task) => task.status !== "Done").length;
  const completedAppointments = patient.appointments.filter((appointment) => appointment.status === "Completed").length;
  const container = document.getElementById("snapshotPanel");
  container.innerHTML = `
    <div class="snapshot-item">
      <span>Care team</span>
      <strong>${patient.provider}</strong>
    </div>
    <div class="snapshot-item">
      <span>Outstanding balance</span>
      <strong>${formatCurrency(patient.billing.balance)}</strong>
    </div>
    <div class="snapshot-item">
      <span>Open care tasks</span>
      <strong>${openTasks}</strong>
    </div>
    <div class="snapshot-item">
      <span>Appointments completed</span>
      <strong>${completedAppointments}/${patient.appointments.length}</strong>
    </div>
    <div class="snapshot-item">
      <span>Active role</span>
      <strong>${currentUser.label}</strong>
    </div>
  `;
}

function renderAuditTrail() {
  const panel = document.getElementById("auditTrailList");
  if (!panel) return;

  if (!hasPermission(currentUser.role, "audit:view")) {
    panel.innerHTML = '<p class="mini-card">Switch to the Admin role to review the audit trail.</p>';
    return;
  }

  panel.innerHTML = auditTrail.length
    ? auditTrail
        .slice(0, 8)
        .map(
          (entry) => `
            <div class="audit-entry">
              <strong>${entry.actorLabel} • ${entry.action}</strong>
              <span>${entry.patientName}</span>
              <p>${entry.details}</p>
            </div>
          `
        )
        .join("")
    : '<p class="mini-card">No audit activity recorded yet.</p>';
}

function renderPermissions() {
  const exportButton = document.getElementById("exportBtn");
  const quickEncounterButton = document.getElementById("quickEncounterBtn");
  const saveEncounterButton = document.getElementById("saveEncounterBtn");
  const encounterInputs = document.querySelectorAll("#encounterForm input, #encounterForm select, #encounterForm textarea");
  const canCreateEncounter = hasPermission(currentUser.role, "encounter:create");
  const canExport = hasPermission(currentUser.role, "report:export");

  if (quickEncounterButton) quickEncounterButton.disabled = !canCreateEncounter;
  if (saveEncounterButton) saveEncounterButton.disabled = !canCreateEncounter;
  if (exportButton) exportButton.disabled = !canExport;

  encounterInputs.forEach((field) => {
    field.disabled = !canCreateEncounter;
  });
}

function render() {
  if (typeof document === "undefined") return;
  renderNavigation();
  applyViewState();
  renderRoleSummary();
  renderDashboardStats();
  renderPermissions();
  renderPatientList();
  renderPatientDetail();
  renderAppointments();
  renderSnapshot();
  renderAuditTrail();
  saveState();
}

function handlePatientSelection(id) {
  selectedPatientId = Number(id);
  const patient = getSelectedPatient();
  recordAudit("patient:select", patient.name, `Opened chart for ${patient.mrn}.`);
  render();
}

function handleEncounterSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const patient = getSelectedPatient();
  const result = createEncounterForPatient(patient, {
    title: form.title.value,
    summary: form.summary.value,
    type: form.type.value,
    vitals: form.vitals.value,
    followup: form.followup.value
  });

  if (!result.allowed) {
    appendAuditEntry(result.audit);
    saveState();
    document.getElementById("encounterStatus").textContent = result.message;
    render();
    return;
  }

  render();
  document.getElementById("encounterStatus").textContent = `Encounter saved for ${patient.name}: ${result.note.title}.`;
  form.reset();
}

function attachEvents() {
  document.getElementById("patientSearch").addEventListener("input", renderPatientList);

  document.getElementById("patientList").addEventListener("click", (event) => {
    const card = event.target.closest(".patient-card");
    if (card) handlePatientSelection(card.dataset.id);
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      setCurrentView(link.dataset.view);
      render();
    });
  });

  document.getElementById("quickEncounterBtn").addEventListener("click", () => {
    document.getElementById("encounterForm").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("roleSelector").addEventListener("change", (event) => {
    const nextUser = setCurrentRole(event.target.value);
    document.getElementById("encounterStatus").textContent = `Active role switched to ${nextUser.label}.`;
    render();
  });

  document.getElementById("encounterForm").addEventListener("submit", handleEncounterSubmit);

  document.getElementById("appointmentsList").addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const nextStatus = actionButton.dataset.action === "complete" ? "Completed" : "Cancelled";
    const result = updateAppointmentStatus(selectedPatientId, actionButton.dataset.id, nextStatus);
    if (!result.allowed) {
      if (result.audit) appendAuditEntry(result.audit);
      document.getElementById("encounterStatus").textContent = result.message;
      saveState();
      render();
      return;
    }

    document.getElementById("encounterStatus").textContent = `Appointment marked ${nextStatus.toLowerCase()}.`;
    render();
  });

  document.getElementById("patientDetail").addEventListener("click", (event) => {
    if (event.target.id !== "completeTaskBtn") return;

    const result = markTaskDone(getSelectedPatient());
    if (!result.allowed) {
      if (result.audit) appendAuditEntry(result.audit);
      document.getElementById("encounterStatus").textContent = result.message;
      saveState();
      render();
      return;
    }

    document.getElementById("encounterStatus").textContent = result.changed
      ? "Marked the next open care task as done."
      : "No open care tasks remain for this patient.";
    render();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const patient = getSelectedPatient();
    const permission = evaluatePermission(currentUser.role, "report:export", patient.name);
    if (!permission.allowed) {
      appendAuditEntry(permission.audit);
      saveState();
      document.getElementById("encounterStatus").textContent = permission.message;
      render();
      return;
    }

    downloadPatientExport(patient);
    recordAudit("report:export", patient.name, `Exported patient summary for ${patient.mrn}.`);
    document.getElementById("encounterStatus").textContent = `Exported a patient summary for ${patient.name}.`;
    render();
  });
}

function bootstrap() {
  attachEvents();
  render();
}

const appApi = {
  applyEncounterToPatient,
  buildExportPayload,
  calculateDashboardStats,
  createEncounterForPatient,
  hasPermission,
  normalizeAuditEntry,
  normalizePatient,
  parseVitalsInput,
  setCurrentRole,
  updateAppointmentStatus
};

if (typeof window !== "undefined") {
  window.__ehrApp = appApi;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = appApi;
}

if (typeof document !== "undefined") {
  bootstrap();
}