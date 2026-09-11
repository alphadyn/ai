const planData = {
  ground: {
    number: '01', label: 'Ground floor', title: 'Gathering spaces<br /><em>at the garden edge.</em>', description: 'The ground floor is an easy loop between a generous entry hall, living, cooking, and the courtyard. The guest suite opens directly from this circulation spine.', rooms: [['01', 'Wide entry hall + study', '18 m²'], ['02', 'Living / dining + hall', '54 m²'], ['03', 'Kitchen + scullery', '29 m²'], ['04', 'Guest suite off hall', '26 m²']]
  },
  upper: {
    number: '02', label: 'Upper floor', title: 'Private rooms<br /><em>around a gallery.</em>', description: 'Four generous bedrooms open directly onto a naturally lit, 2.0 m-wide bedroom hall. The primary suite takes the quiet garden corner, with a framed view through the trees.', rooms: [['01', 'Primary suite off hall', '49 m²'], ['02', 'Bedrooms 02 + 03 off hall', '31 m²'], ['03', 'Bedrooms 04 + 05 off hall', '29 m²'], ['04', 'Bedroom hall + bath', '25 m²']]
  }
};

const floorButtons = document.querySelectorAll('[data-floor]');
const plans = { ground: document.querySelector('#groundPlan'), upper: document.querySelector('#upperPlan') };
const planNumber = document.querySelector('#planNumber');
const planLabel = document.querySelector('#planLabel');
const planTitle = document.querySelector('#planTitle');
const planDescription = document.querySelector('#planDescription');
const roomList = document.querySelector('#roomList');

document.querySelector('#groundPlan .dim-b').textContent = '10.5 m';
document.querySelector('#upperPlan .dim-b').textContent = '10.0 m';
document.querySelector('#groundPlan .living span').textContent = 'Living / dining + hall';
document.querySelector('#upperPlan .landing span').textContent = 'Bedroom hall';

const dimensionSummary = document.createElement('div');
dimensionSummary.className = 'dimension-summary';
dimensionSummary.innerHTML = '<div><span>Footprint</span><strong>14.8 × 10.5 m</strong><small>Ground floor / 155 m²</small></div><div><span>Upper footprint</span><strong>14.8 × 10.0 m</strong><small>Upper floor / 148 m²</small></div><div><span>Circulation</span><strong>2.0 m clear</strong><small>Upper gallery hall</small></div><div><span>Section height</span><strong>6.2 m</strong><small>Double-height living</small></div>';
document.querySelector('.floorplan-wrap').append(dimensionSummary);
const openingLegend = document.createElement('div');
openingLegend.className = 'opening-legend';
openingLegend.innerHTML = '<span><i class="opening-window"></i>Window line</span><span><i class="opening-door"></i>Door swing</span><span><i class="opening-fixture"></i>Fixture</span>';
document.querySelector('.floorplan-wrap').append(openingLegend);

function addFixtures(planSelector, roomSelector, fixtures) {
  const room = document.querySelector(`${planSelector} ${roomSelector}`);
  const fixtureGroup = document.createElement('span');
  fixtureGroup.className = 'fixture-group';
  fixtureGroup.setAttribute('aria-label', fixtures.join(', '));
  fixtureGroup.innerHTML = fixtures.map(fixture => `<i class="fixture-${fixture.toLowerCase().replaceAll(' ', '-')}">${fixture}</i>`).join('');
  room.append(fixtureGroup);
}

addFixtures('#groundPlan', '.kitchen', ['Island', 'Sink', 'Cooktop']);
addFixtures('#groundPlan', '.pantry', ['Counter']);
addFixtures('#groundPlan', '.powder', ['Vanity', 'WC']);
addFixtures('#groundPlan', '.bath', ['Bath', 'Vanity', 'WC']);
addFixtures('#upperPlan', '.primary-bath', ['Bath', 'Vanity', 'WC']);
addFixtures('#upperPlan', '.shared-bath', ['Bath', 'Shower', 'Vanity', 'WC']);

const scheduleRows = document.querySelectorAll('.schedule-row');
scheduleRows[5].lastElementChild.textContent = '148 m²';
scheduleRows[6].lastElementChild.textContent = '45 m²';
scheduleRows[7].lastElementChild.textContent = '58 m²';
scheduleRows[8].lastElementChild.textContent = '45 m²';
scheduleRows[9].lastElementChild.textContent = '303 m²';

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

renderPlan('ground');
floorButtons.forEach(button => button.addEventListener('click', () => renderPlan(button.dataset.floor)));
document.querySelector('#printButton').addEventListener('click', () => window.print());
