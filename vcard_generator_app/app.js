// Builds a vCard (.vcf) file and a matching QR code from the contact form.

const form = document.getElementById("contactForm");
const resultPanel = document.getElementById("resultPanel");
const vcfPreview = document.getElementById("vcfPreview");
const previewName = document.getElementById("previewName");
const qrCodeEl = document.getElementById("qrCode");
const qrNote = document.getElementById("qrNote");
const downloadVcfBtn = document.getElementById("downloadVcfBtn");
const downloadQrBtn = document.getElementById("downloadQrBtn");
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const removePhotoBtn = document.getElementById("removePhotoBtn");

const PHOTO_MAX_DIMENSION = 240;
const PHOTO_JPEG_QUALITY = 0.8;

let currentVcf = "";
let currentFileName = "contact.vcf";
// Base64 JPEG data (no data URL prefix) for the currently selected profile picture, if any.
let currentPhotoBase64 = "";

// Escapes text per the vCard 3.0 spec (RFC 2426): backslash, comma, semicolon, newline.
function escapeVcfValue(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function getFieldValue(id) {
  return document.getElementById(id).value.trim();
}

// Folds a property line to 75 octets per line per RFC 2426, with continuation lines indented by one space.
function foldVcfLine(line) {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const chunks = [line.slice(0, maxLength)];
  let rest = line.slice(maxLength);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, maxLength - 1));
    rest = rest.slice(maxLength - 1);
  }
  return chunks.join("\r\n");
}

function buildVcf(fields, options) {
  const includePhoto = !options || options.includePhoto !== false;
  const {
    firstName,
    middleName,
    lastName,
    organization,
    jobTitle,
    phoneMobile,
    phoneWork,
    email,
    website,
    street,
    city,
    state,
    postalCode,
    country,
    birthday,
    notes,
    photoBase64,
  } = fields;

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ") || "Unnamed Contact";

  const lines = ["BEGIN:VCARD", "VERSION:3.0"];

  lines.push(
    `N:${escapeVcfValue(lastName)};${escapeVcfValue(firstName)};${escapeVcfValue(middleName)};;`
  );
  lines.push(`FN:${escapeVcfValue(fullName)}`);

  if (includePhoto && photoBase64) {
    lines.push(foldVcfLine(`PHOTO;ENCODING=b;TYPE=JPEG:${photoBase64}`));
  }

  if (organization) lines.push(`ORG:${escapeVcfValue(organization)}`);
  if (jobTitle) lines.push(`TITLE:${escapeVcfValue(jobTitle)}`);
  if (phoneMobile) lines.push(`TEL;TYPE=CELL,VOICE:${escapeVcfValue(phoneMobile)}`);
  if (phoneWork) lines.push(`TEL;TYPE=WORK,VOICE:${escapeVcfValue(phoneWork)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcfValue(email)}`);
  if (website) lines.push(`URL:${escapeVcfValue(website)}`);

  if (street || city || state || postalCode || country) {
    lines.push(
      `ADR;TYPE=HOME:;;${escapeVcfValue(street)};${escapeVcfValue(city)};${escapeVcfValue(state)};${escapeVcfValue(postalCode)};${escapeVcfValue(country)}`
    );
  }

  if (birthday) {
    lines.push(`BDAY:${birthday.replace(/-/g, "")}`);
  }

  if (notes) lines.push(`NOTE:${escapeVcfValue(notes)}`);

  lines.push("END:VCARD");

  // vCard spec requires CRLF line endings.
  return { vcf: lines.join("\r\n") + "\r\n", fullName };
}

function renderQrCode(text) {
  qrCodeEl.innerHTML = "";
  // typeNumber 0 lets the library auto-size to fit the data.
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  qrCodeEl.innerHTML = qr.createSvgTag({ scalable: true });
  const svg = qrCodeEl.querySelector("svg");
  if (svg) {
    svg.removeAttribute("width");
    svg.removeAttribute("height");
  }
}

// A vCard photo can make the QR payload too dense to encode; fall back to a photo-less version when that happens.
function renderQrCodeWithFallback(fields) {
  const { vcf: fullVcf } = buildVcf(fields, { includePhoto: true });
  try {
    renderQrCode(fullVcf);
    qrNote.hidden = true;
  } catch (error) {
    const { vcf: vcfWithoutPhoto } = buildVcf(fields, { includePhoto: false });
    renderQrCode(vcfWithoutPhoto);
    qrNote.textContent = "The profile picture made the QR code too dense, so the QR code excludes the photo. The downloaded .vcf file still includes it.";
    qrNote.hidden = false;
  }
}

function readImageAsResizedJpegBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image file."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > PHOTO_MAX_DIMENSION) {
          height = Math.round((height * PHOTO_MAX_DIMENSION) / width);
          width = PHOTO_MAX_DIMENSION;
        } else if (height > PHOTO_MAX_DIMENSION) {
          width = Math.round((width * PHOTO_MAX_DIMENSION) / height);
          height = PHOTO_MAX_DIMENSION;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
        resolve(dataUrl.split(",")[1]);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function downloadBlob(content, mimeType, fileName) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

photoInput.addEventListener("change", async () => {
  const file = photoInput.files[0];
  if (!file) return;

  try {
    currentPhotoBase64 = await readImageAsResizedJpegBase64(file);
    photoPreview.src = `data:image/jpeg;base64,${currentPhotoBase64}`;
    photoPreview.hidden = false;
    removePhotoBtn.hidden = false;
  } catch (error) {
    window.alert("Could not read that image file. Please try a different one.");
    photoInput.value = "";
  }
});

removePhotoBtn.addEventListener("click", () => {
  currentPhotoBase64 = "";
  photoInput.value = "";
  photoPreview.src = "";
  photoPreview.hidden = true;
  removePhotoBtn.hidden = true;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const fields = {
    firstName: getFieldValue("firstName"),
    middleName: getFieldValue("middleName"),
    lastName: getFieldValue("lastName"),
    organization: getFieldValue("organization"),
    jobTitle: getFieldValue("jobTitle"),
    phoneMobile: getFieldValue("phoneMobile"),
    phoneWork: getFieldValue("phoneWork"),
    email: getFieldValue("email"),
    website: getFieldValue("website"),
    street: getFieldValue("street"),
    city: getFieldValue("city"),
    state: getFieldValue("state"),
    postalCode: getFieldValue("postalCode"),
    country: getFieldValue("country"),
    birthday: getFieldValue("birthday"),
    notes: getFieldValue("notes"),
    photoBase64: currentPhotoBase64,
  };

  const hasAnyValue = Object.entries(fields).some(
    ([key, value]) => key !== "photoBase64" && value.length > 0
  );
  if (!hasAnyValue && !currentPhotoBase64) {
    window.alert("Please fill in at least one field before generating a contact card.");
    return;
  }

  const { vcf, fullName } = buildVcf(fields);
  currentVcf = vcf;
  currentFileName = `${fullName.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "contact"}.vcf`;

  vcfPreview.textContent = vcf;
  previewName.textContent = fullName;
  renderQrCodeWithFallback(fields);

  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

form.addEventListener("reset", () => {
  resultPanel.hidden = true;
  currentVcf = "";
  currentPhotoBase64 = "";
  photoPreview.src = "";
  photoPreview.hidden = true;
  removePhotoBtn.hidden = true;
});

downloadVcfBtn.addEventListener("click", () => {
  if (!currentVcf) return;
  downloadBlob(currentVcf, "text/vcard;charset=utf-8", currentFileName);
});

downloadQrBtn.addEventListener("click", () => {
  const svg = qrCodeEl.querySelector("svg");
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(svgUrl);

    canvas.toBlob((pngBlob) => {
      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = currentFileName.replace(/\.vcf$/i, "_qr.png");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  img.src = svgUrl;
});
