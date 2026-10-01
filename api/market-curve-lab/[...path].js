import companiesHandler from '../../market-curve-lab/api/companies.js';
import searchHandler from '../../market-curve-lab/api/search.js';
import analysisHandler from '../../market-curve-lab/api/analysis.js';

const handlers = {
  companies: companiesHandler,
  search: searchHandler,
  analysis: analysisHandler,
};

export default async function handler(request, response) {
  const path = Array.isArray(request.query.path) ? request.query.path.join('/') : request.query.path;
  const routeHandler = handlers[path];
  if (!routeHandler) {
    response.status(404).json({ error: 'Market data route not found.' });
    return;
  }
  return routeHandler(request, response);
}