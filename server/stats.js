import { rateLimit } from './security.js';
export function validateCompletedPath(scenario, pathway) {
  if (!scenario || !Array.isArray(pathway) || !pathway.length || pathway.length > 100) return false;
  let next = scenario.pochatkovyi_vuzol;
  const seen = new Set();
  for (const step of pathway) {
    if (!step || Object.keys(step).some(k => !['nodeId','variantId'].includes(k)) || step.nodeId !== next || seen.has(next)) return false;
    seen.add(next);
    const option = scenario.vuzly.find(n => n.id === next)?.varianty.find(v => v.id === step.variantId);
    if (!option) return false;
    next = option.nastupnyi_vuzol;
  }
  return next === null;
}
export function addAggregate(aggregate, scenarioId, pathway) {
  const stats = aggregate[scenarioId] ||= { completions: 0, nodes: {} };
  stats.completions++;
  for (const {nodeId,variantId} of pathway) {
    const node = stats.nodes[nodeId] ||= { completions: 0, variants: {} };
    node.completions++; node.variants[variantId] = (node.variants[variantId] || 0) + 1;
  }
}
export function publicStats(scenario, aggregate) {
  const stats = aggregate[scenario.id];
  return { scenarioId: scenario.id, completions: stats?.completions || 0, nodes: scenario.vuzly.map(n => {
    const record = stats?.nodes[n.id];
    return { nodeId:n.id, completions:record?.completions || 0, variants:n.varianty.map(v => ({ variantId:v.id, percent:record?.completions ? Math.round((record.variants[v.id] || 0) / record.completions * 1000) / 10 : 0 })) };
  }) };
}
export function installStats(app, scenarios, readAggregate, update) {
  app.get('/api/stats/:scenarioId', (req,res) => {
    const scenario = scenarios.get(req.params.scenarioId);
    if (!scenario) return res.status(404).json({error:'notFound'});
    res.json(publicStats(scenario,readAggregate()));
  });
  app.post('/api/stats/record', rateLimit(30, 60 * 60000), async (req,res,next) => {
    const body = req.body;
    if (!body || Object.keys(body).some(k => !['scenarioId','pathway'].includes(k)) || !validateCompletedPath(scenarios.get(body.scenarioId),body.pathway)) return res.status(400).json({error:'invalidPath'});
    try { await update(draft => { draft.aggregateStats ||= {}; addAggregate(draft.aggregateStats,body.scenarioId,body.pathway); }); res.json({ok:true}); } catch(error) { next(error); }
  });
}
