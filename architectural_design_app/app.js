const planData = {
  ground: {
    number: '01', label: 'Ground floor', title: 'Gathering spaces<br /><em>at the garden edge.</em>', description: 'The ground floor is an easy loop between arrival, living, cooking, and the courtyard. A private guest suite sits apart from the family zone.', rooms: [['01', 'Entry + study', '18 m²'], ['02', 'Living / dining', '54 m²'], ['03', 'Kitchen + scullery', '29 m²'], ['04', 'Guest suite', '26 m²']]
  },
  upper: {
    number: '02', label: 'Upper floor', title: 'Private rooms<br /><em>around a gallery.</em>', description: 'Four generous bedrooms open onto a naturally lit gallery. The primary suite takes the quiet garden corner, with a framed view through the trees.', rooms: [['01', 'Primary suite', '49 m²'], ['02', 'Bedrooms 02 + 03', '31 m²'], ['03', 'Bedrooms 04 + 05', '29 m²'], ['04', 'Gallery + bath', '25 m²']]
  }
};

const floorButtons = document.querySelectorAll('[data-floor]');
const plans = { ground: document.querySelector('#groundPlan'), upper: document.querySelector('#upperPlan') };
const planNumber = document.querySelector('#planNumber');
const planLabel = document.querySelector('#planLabel');
const planTitle = document.querySelector('#planTitle');
const planDescription = document.querySelector('#planDescription');
const roomList = document.querySelector('#roomList');

function renderPlan(floor) {
  const data = planData[floor];
  Object.entries(plans).forEach(([key, plan]) => plan.classList.toggle('hidden', key !== floor));
  floorButtons.forEach(button => {
    const selected = button.dataset.floor === floor;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  planNumber.textContent = data.number;
  planLabel.textContent = data.label;
  planTitle.innerHTML = data.title;
  planDescription.textContent = data.description;
  roomList.innerHTML = data.rooms.map(room => `<div><dt>${room[0]}</dt><dd>${room[1]}</dd><span>${room[2]}</span></div>`).join('');
}

floorButtons.forEach(button => button.addEventListener('click', () => renderPlan(button.dataset.floor)));
document.querySelector('#printButton').addEventListener('click', () => window.print());
