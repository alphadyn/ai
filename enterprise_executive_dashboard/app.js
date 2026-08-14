const dataByRange = {
  Q1: {
    revenue: '$4.21B',
    margin: '26.9%',
    clients: '17,520',
    pipeline: '$8.1B',
    bars: [52, 58, 62, 68, 74, 84],
    regions: [
      { name: 'North America', growth: '+10.2%', bookings: '$1.42B' },
      { name: 'Europe', growth: '+8.6%', bookings: '$1.09B' },
      { name: 'APAC', growth: '+13.8%', bookings: '$1.28B' },
      { name: 'LATAM', growth: '+6.4%', bookings: '$0.76B' }
    ],
    initiatives: [
      { name: 'AI field automation', progress: 82, tag: 'blue', detail: 'Deploying predictive maintenance for 18 critical sites.' },
      { name: 'Margin recovery program', progress: 74, tag: 'green', detail: 'Three manufacturing plants now above target operating leverage.' },
      { name: 'Customer expansion push', progress: 68, tag: 'yellow', detail: 'Strategic account team conversion pipeline improved to 72%.' }
    ],
    risks: [
      { label: 'Vendor concentration', level: 'medium', detail: 'Single-source dependency remains elevated in two components.' },
      { label: 'Cyber resilience', level: 'low', detail: 'No material incidents; remediation backlog is trending down.' },
      { label: 'Shipping throughput', level: 'high', detail: 'Port delays may compress margin by 90 basis points in Q4.' }
    ],
    activity: [
      { title: 'Board review completed', text: 'Capital allocation plan approved across 8 business units.', time: '42 min ago' },
      { title: 'Supply chain team briefed', text: 'Scenario modeling confirmed near-term routing alternatives.', time: '1 hr ago' },
      { title: 'Enterprise expansion signed', text: 'Three new multi-year contracts closed in industrial AI.', time: '4 hr ago' }
    ]
  },
  Q2: {
    revenue: '$4.82B',
    margin: '29.8%',
    clients: '18,940',
    pipeline: '$9.4B',
    bars: [56, 61, 67, 74, 82, 94],
    regions: [
      { name: 'North America', growth: '+14.6%', bookings: '$1.66B' },
      { name: 'Europe', growth: '+12.1%', bookings: '$1.31B' },
      { name: 'APAC', growth: '+16.9%', bookings: '$1.52B' },
      { name: 'LATAM', growth: '+9.8%', bookings: '$0.92B' }
    ],
    initiatives: [
      { name: 'AI field automation', progress: 88, tag: 'blue', detail: 'Adoption is above plan with reduced failure rates in service operations.' },
      { name: 'Margin recovery program', progress: 83, tag: 'green', detail: 'Operating leverage accelerated across core software and service lines.' },
      { name: 'Customer expansion push', progress: 79, tag: 'yellow', detail: 'Top 25 accounts are on track to exceed cross-sell forecast.' }
    ],
    risks: [
      { label: 'Vendor concentration', level: 'low', detail: 'Diversification reduced dependency on the top-two suppliers.' },
      { label: 'Cyber resilience', level: 'low', detail: 'Controls are stable and incident recovery remains within SLA.' },
      { label: 'Shipping throughput', level: 'medium', detail: 'Residual volatility remains moderate across trans-Pacific routes.' }
    ],
    activity: [
      { title: 'Global revenue beat', text: 'Q2 revenue exceeded guidance by 5.3% led by software expansion.', time: '18 min ago' },
      { title: 'AI pilot scaled', text: 'Customer success deployed predictive routing to 42 facilities.', time: '1 hr ago' },
      { title: 'Executive briefing ready', text: 'Prepared for investor materials and board strategy review.', time: '3 hr ago' }
    ]
  },
  Q3: {
    revenue: '$5.27B',
    margin: '31.2%',
    clients: '20,340',
    pipeline: '$10.6B',
    bars: [62, 68, 76, 84, 92, 99],
    regions: [
      { name: 'North America', growth: '+17.2%', bookings: '$1.82B' },
      { name: 'Europe', growth: '+15.4%', bookings: '$1.48B' },
      { name: 'APAC', growth: '+18.7%', bookings: '$1.73B' },
      { name: 'LATAM', growth: '+11.6%', bookings: '$1.02B' }
    ],
    initiatives: [
      { name: 'AI field automation', progress: 93, tag: 'blue', detail: 'Autonomous service orchestration is now standard for 12 lighthouse accounts.' },
      { name: 'Margin recovery program', progress: 90, tag: 'green', detail: 'Portfolio mix continues to improve spend efficiency and cash conversion.' },
      { name: 'Customer expansion push', progress: 86, tag: 'yellow', detail: 'Large account expansion pacing above target in all major regions.' }
    ],
    risks: [
      { label: 'Vendor concentration', level: 'low', detail: 'Supply chain resilience continues to improve across critical inputs.' },
      { label: 'Cyber resilience', level: 'medium', detail: 'Attack surface in edge environments remains under active review.' },
      { label: 'Shipping throughput', level: 'low', detail: 'Logistics recovery is firming after port optimization initiatives.' }
    ],
    activity: [
      { title: 'Quarterly risk review', text: 'Board-level risk dashboard confirmed lower concentration exposure.', time: '20 min ago' },
      { title: 'Frictionless renewal campaign', text: 'Customer retention improved across strategic renewals this month.', time: '2 hr ago' },
      { title: 'AI safety committee met', text: 'Governance review recommended expansion of deployment controls.', time: '5 hr ago' }
    ]
  },
  YTD: {
    revenue: '$15.46B',
    margin: '30.1%',
    clients: '18,940',
    pipeline: '$9.4B',
    bars: [46, 54, 63, 71, 81, 89],
    regions: [
      { name: 'North America', growth: '+15.5%', bookings: '$4.92B' },
      { name: 'Europe', growth: '+13.7%', bookings: '$4.16B' },
      { name: 'APAC', growth: '+18.1%', bookings: '$4.58B' },
      { name: 'LATAM', growth: '+10.9%', bookings: '$2.81B' }
    ],
    initiatives: [
      { name: 'AI field automation', progress: 91, tag: 'blue', detail: 'Average time-to-resolution improved by 28% across enterprise accounts.' },
      { name: 'Margin recovery program', progress: 85, tag: 'green', detail: 'year-to-date operating margin expanded by 4.2 points against plan.' },
      { name: 'Customer expansion push', progress: 81, tag: 'yellow', detail: 'Large account expansion pipeline remains diversified and durable.' }
    ],
    risks: [
      { label: 'Vendor concentration', level: 'low', detail: 'Portfolio mix reduced dependency risk materially year-to-date.' },
      { label: 'Cyber resilience', level: 'low', detail: 'Audit findings are closing faster than expected across core functions.' },
      { label: 'Shipping throughput', level: 'medium', detail: 'Residual shipping volatility remains manageable with alternate routing.' }
    ],
    activity: [
      { title: 'Annual operating review', text: 'YTD performance remains above plan across key transformation metrics.', time: '35 min ago' },
      { title: 'Investor briefing drafted', text: 'Prepared strategic update for the next capital markets conversation.', time: '3 hr ago' },
      { title: 'Shared value initiative launched', text: 'New climate and governance roadmap approved by the board.', time: '1 day ago' }
    ]
  }
};

const metricMap = {
  revenue: 'Revenue',
  margin: 'Net margin',
  clients: 'Enterprise clients',
  pipeline: 'Pipeline value'
};

const regionTable = document.getElementById('regionTable');
const growthBars = document.getElementById('growthBars');
const initiativeList = document.getElementById('initiativeList');
const riskList = document.getElementById('riskList');
const activityList = document.getElementById('activityList');

const rangeButtons = document.querySelectorAll('.range-btn');
const metrics = document.querySelectorAll('.metric');

function renderRegions(items) {
  regionTable.innerHTML = items.map((item) => `
    <tr>
      <td>${item.name}</td>
      <td><span class="region-growth">${item.growth}</span></td>
      <td>${item.bookings}</td>
    </tr>
  `).join('');
}

function renderBars(values) {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const max = 100;

  growthBars.innerHTML = values.map((value, index) => `
    <div class="bar-group">
      <div class="bar primary" style="height:${(value / max) * 100}%"></div>
      <div class="bar secondary" style="height:${((value - 8) / max) * 100}%"></div>
      <span class="bar-label">${labels[index]}</span>
    </div>
  `).join('');
}

function renderInitiatives(items) {
  initiativeList.innerHTML = items.map((item) => `
    <div class="initiative-item">
      <div class="initiative-meta">
        <span class="pill ${item.tag}">${item.name.split(' ')[0]}</span>
        <strong>${item.progress}%</strong>
      </div>
      <h4>${item.name}</h4>
      <p>${item.detail}</p>
      <div class="progress"><span style="width:${item.progress}%"></span></div>
    </div>
  `).join('');
}

function renderRisks(items) {
  riskList.innerHTML = items.map((item) => `
    <div class="risk-item">
      <div class="risk-row">
        <strong>${item.label}</strong>
        <span class="risk-level ${item.level}">${item.level}</span>
      </div>
      <span>${item.detail}</span>
    </div>
  `).join('');
}

function renderActivity(items) {
  activityList.innerHTML = items.map((item) => `
    <div class="activity-item">
      <span class="activity-bullet"></span>
      <div>
        <strong>${item.title}</strong>
        <span>${item.text}</span>
        <time>${item.time}</time>
      </div>
    </div>
  `).join('');
}

function updateMetrics(rangeKey) {
  const active = dataByRange[rangeKey];

  metrics.forEach((metric) => {
    const key = metric.dataset.metric;
    metric.textContent = active[key];
    metric.title = `${metricMap[key]}: ${active[key]}`;
  });

  renderRegions(active.regions);
  renderBars(active.bars);
  renderInitiatives(active.initiatives);
  renderRisks(active.risks);
  renderActivity(active.activity);
}

rangeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    rangeButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
    updateMetrics(button.dataset.range);
  });
});

function setCurrentTime() {
  const currentDate = new Date();
  const label = currentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const dateCell = document.querySelector('.eyebrow');
  dateCell.textContent = `Executive command center • ${label}`;
}

updateMetrics('Q2');
setCurrentTime();
