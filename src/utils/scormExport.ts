import { formatNormBadge } from '../i18n/normDisplay';
import { scriptJson } from './security';
import { caseLabel, stageLabel, variantLabel } from '../i18n/display';
import { Language } from '../i18n';
import { localizeNorms, localizeScenario } from '../i18n/content';
import scormLabels from '../i18n/scorm.json';
import { Scenario, NormsData } from '../types';

export async function generateScorm12Zip(
  scenario: Scenario,
  normsData: NormsData,
  lang: Language = 'uk'
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  scenario = localizeScenario(scenario, lang);
  normsData = localizeNorms(normsData, lang);

  // 1. imsmanifest.xml (SCORM 1.2 compliant)
  const manifestXml = `<?xml version="1.0" standalone="no" ?>
<manifest identifier="MANIFEST_${escapeXml(scenario.id)}" version="1.2"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG_${escapeXml(scenario.id)}">
    <organization identifier="ORG_${escapeXml(scenario.id)}">
      <title>${escapeXml(scenario.nazva)}</title>
      <item identifier="ITEM_${escapeXml(scenario.id)}" identifierref="RES_${escapeXml(scenario.id)}">
        <title>${escapeXml(scenario.nazva)}</title>
        <adlcp:masteryscore>100</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES_${escapeXml(scenario.id)}" type="web-content" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
      <file href="scorm-api.js" />
    </resource>
  </resources>
</manifest>`;

  zip.file('imsmanifest.xml', manifestXml);

  // 2. scorm-api.js
  const scormApiJs = `/**
 * SCORM 1.2 API Wrapper
 * Strictly adheres to Privacy & Anti-Profiling rules:
 * Transmits ONLY cmi.core.lesson_status = "completed".
 * NEVER transmits choices, scores, or user profiling data.
 */
var findAPITries = 0;
var maxTries = 500;
var scormAPI = null;

function scanForAPI(win) {
  while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
    findAPITries++;
    if (findAPITries > maxTries) return null;
    win = win.parent;
  }
  return win.API;
}

function getAPI() {
  if (scormAPI == null) {
    scormAPI = scanForAPI(window);
    if ((scormAPI == null) && (window.opener != null) && (typeof(window.opener) != "undefined")) {
      scormAPI = scanForAPI(window.opener);
    }
  }
  return scormAPI;
}

window.SCORM_INIT = function() {
  var api = getAPI();
  if (api) {
    api.LMSInitialize("");
    api.LMSSetValue("cmi.core.lesson_status", "incomplete");
    api.LMSCommit("");
  } else {
    console.log("[SCORM Offline/Mock] LMSInitialize called");
  }
};

window.SCORM_COMPLETE = function() {
  var api = getAPI();
  if (api) {
    // Only lesson_status = "completed", strictly zero PII & zero scores
    api.LMSSetValue("cmi.core.lesson_status", "completed");
    api.LMSCommit("");
    api.LMSFinish("");
  } else {
    console.log("[SCORM Offline/Mock] LMS completed status set");
  }
};
`;

  zip.file('scorm-api.js', scormApiJs);

  // 3. Standalone self-contained index.html player
  // Embeds scenario JSON and relevant norm entries
  const relevantNormIds = new Set(scenario.normy.map((n) => n.id));
  const embeddedNorms = normsData.normy.filter((n) =>
    relevantNormIds.has(n.id)
  );

  const standaloneHtml = generateStandaloneHtmlPlayer(
    scenario,
    embeddedNorms,
    lang
  );
  zip.file('index.html', standaloneHtml);

  return await zip.generateAsync({ type: 'blob' });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function generateStandaloneHtmlPlayer(
  scenario: Scenario,
  embeddedNorms: any[],
  lang: Language
): string {
  const labels = scormLabels[lang];
  const presentation = {
    normCodes: Object.fromEntries(embeddedNorms.map(norm => [norm.id, formatNormBadge(norm, lang)])),
    normsTitle: lang === 'uk' ? 'Застосовні норми права' : 'Applicable legal provisions',
    case: caseLabel(scenario.id, lang),
    stages: Object.fromEntries(
      scenario.vuzly.map((node) => [
        node.id,
        stageLabel(scenario, node.id, lang)
      ])
    ),
    variants: Object.fromEntries(
      scenario.vuzly.map((node) => [
        node.id,
        Object.fromEntries(
          node.varianty.map((v) => [
            v.id,
            variantLabel(scenario, node.id, v.id, lang)
          ])
        )
      ])
    )
  };
  const scenarioJson = scriptJson(scenario);
  const normsJson = scriptJson(embeddedNorms);

  return `<!DOCTYPE html>
<html lang="${lang}" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(scenario.nazva)} - ${escapeXml(labels.s0)}</title>
  <script src="scorm-api.js"></script>
  <style>
    :root {
      --bg: #070b14;
      --card: #111b2f;
      --card-border: #223456;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --emerald: #10b981;
      --gold: #f59e0b;
      --danger: #ef4444;
      --indigo: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6; overflow-wrap: anywhere;
      padding: 1rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h1, h2, h3 { color: #fff; margin-bottom: 0.75rem; }
    h1 { font-size: 1.5rem; border-bottom: 1px solid var(--card-border); padding-bottom: 0.75rem; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      color: var(--emerald);
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 1rem;
    }
    .context-box {
      background: rgba(255, 255, 255, 0.03);
      border-left: 4px solid var(--indigo);
      padding: 1rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 1.25rem;
      font-size: 0.95rem;
    }
    .options-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    .btn-option {
      background: #17233c;
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 1rem;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      font-size: 0.95rem;
      transition: all 0.2s;
    }
    .btn-option:hover {
      border-color: var(--emerald);
      background: #1d2c4b;
      transform: translateY(-2px);
    }
    .btn-primary {
      background: var(--emerald);
      color: #070b14;
      font-weight: 700;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 1rem;
      width: 100%;
    }
    .feedback-box {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 8px;
      padding: 1.25rem;
      margin: 1rem 0;
    }
    .scores-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      margin: 1rem 0;
      text-align: center;
    }
    .score-card {
      background: #0c1424;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.5rem;
    }
    .score-val { font-size: 1.25rem; font-weight: bold; }
    .score-val.pos { color: var(--emerald); }
    .score-val.zero { color: var(--gold); }
    .score-val.neg { color: var(--danger); }
    .disclaimer {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-align: center;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--card-border);
    }
   .consequence-stack { display:flex; flex-direction:column; gap:12px; } .consequence-immediate { border-left:4px solid #6BAEC4; } .consequence-delayed { border-left:4px solid #D99B38; }
</style>
</head>
<body>
  <div class="container" id="app">
    <!-- Rendered dynamically by script -->
  </div>

  <script>
    var presentation = ${scriptJson(presentation)};
    var scenario = ${scenarioJson};
    var norms = ${normsJson};
    var normsMap = Object.create(null);
    norms.forEach(function(n) { normsMap[n.id] = n; });

    var state = {
      step: 'briefing', // 'briefing', 'node', 'feedback', 'reflection'
      currentNodeId: scenario.pochatkovyi_vuzol,
      pathway: [],
      selectedVariant: null
    };

    window.onload = function() {
      if (window.SCORM_INIT) window.SCORM_INIT();
      render();
    };

    var labels = ${scriptJson(labels)};
    function element(tag, text, className, parent) {
      var node = document.createElement(tag);
      if (text !== undefined) node.textContent = String(text);
      if (className) node.className = className;
      (parent || document.getElementById('app')).appendChild(node);
      return node;
    }
    function action(text, callback, className, parent) {
      var button = element('button', undefined, className || 'btn-primary', parent);
      button.type = 'button';
      if (text !== undefined) button.textContent = text;
      button.addEventListener('click', callback);
      return button;
    }
    function renderNorms(ids) {
      var unique = Array.from(new Set(ids));
      if (!unique.length) return;
      element('h3', presentation.normsTitle);
      var cards = element('div', undefined, 'options-grid');
      unique.forEach(function(id) {
        var norm = normsMap[id]; if (!norm) return;
        var card = element('section', undefined, 'context-box', cards);
        var badge = element('strong', presentation.normCodes[id] || id, 'badge', card);
        badge.style.whiteSpace = 'nowrap';
        element('h4', norm.akt, undefined, card);
        element('p', norm.korotko, undefined, card);
      });
    }
    function render() {
      document.getElementById('app').replaceChildren();
      if (state.step === 'briefing') {
        element('span', presentation.case + ' • ' + scenario.tryvalist_khv + ' ' + labels.s1 + ' • ' + scenario.tema, 'badge');
        element('h1', scenario.nazva);
        var context = element('div', undefined, 'context-box');
        element('strong', labels.s2, undefined, context);
        element('p', scenario.kontekst, undefined, context);
        element('h3', labels.s3);
        element('p', scenario.sytuatsiia);
        action(labels.s4, startScenario);
        element('div', labels.s5, 'disclaimer');
      } else if (state.step === 'node') {
        var node = scenario.vuzly.find(function(v) { return v.id === state.currentNodeId; });
        element('span', presentation.stages[node.id], 'badge');
        element('h2', node.zapytannia);
        if (node.tekst) element('p', node.tekst);
        var options = element('div', undefined, 'options-grid');
        node.varianty.forEach(function(variant) {
          var button = action(undefined, function() { chooseOption(variant.id); }, 'btn-option', options);
          element('strong', presentation.variants[node.id][variant.id] + '.', undefined, button);
          button.appendChild(document.createTextNode(' ' + variant.tekst));
        });
      } else if (state.step === 'feedback') {
        var v = state.selectedVariant;
        element('span', labels.s7 + ' ' + presentation.variants[state.currentNodeId][v.id], 'badge');
        element('h2', labels.s8);
        var scores = element('div', undefined, 'scores-row');
        ['dobrochesnist', 'efektyvnist', 'dovira'].forEach(function(axis, index) {
          var card = element('div', undefined, 'score-card', scores);
          element('div', labels['s' + (9 + index)], undefined, card);
          var value = v.baly[axis];
          element('div', (value > 0 ? '+' : '') + value, 'score-val ' + (value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero'), card);
        });
        var feedback = element('div', undefined, 'consequence-stack');
        var immediate = element('div', undefined, 'feedback-box consequence-immediate', feedback);
        var delayed = element('div', undefined, 'feedback-box consequence-delayed', feedback);
        element('strong', labels.s12, undefined, immediate);
        element('p', v.naslidky.odrazu, undefined, immediate);
        element('strong', labels.s13, undefined, delayed);
        element('p', v.naslidky.vidkladeni, undefined, delayed);
        element('strong', labels.s14);
        element('p', v.chomu_taki_baly);
        var analysis = element('div', undefined, 'context-box');
        element('strong', labels.s15, undefined, analysis);
        element('p', v.zvorotnyi_zviazok, undefined, analysis);
        renderNorms(v.normy || []);
        action(v.nastupnyi_vuzol ? labels.s16 : labels.s17, nextStage);
      } else if (state.step === 'reflection') {
        if (window.SCORM_COMPLETE) window.SCORM_COMPLETE();
        element('span', labels.s20, 'badge');
        element('h1', labels.s21);
        var path = element('div', undefined, 'context-box');
        element('h3', labels.s22, undefined, path);
        var list = element('ul', undefined, undefined, path);
        state.pathway.forEach(function(p) {
          element('li', presentation.stages[p.nodeId] + ' · ' + labels.s19 + ' ' + presentation.variants[p.nodeId][p.variant.id] + ' — ' + p.variant.tekst, undefined, list);
        });
        renderNorms(state.pathway.flatMap(function(p) { return p.variant.normy || []; }));
        element('h3', labels.s23);
        var tips = element('ul');
        scenario.porady.forEach(function(tip) { element('li', tip, undefined, tips); });
        var info = element('div', undefined, 'feedback-box');
        element('strong', labels.s24, undefined, info);
        element('p', labels.s25, undefined, info);
        action(labels.s26, restart);
      }
    }

    function startScenario() {
      state.step = 'node';
      state.currentNodeId = scenario.pochatkovyi_vuzol;
      state.pathway = [];
      render();
    }

    function chooseOption(varId) {
      var node = scenario.vuzly.find(function(v) { return v.id === state.currentNodeId; });
      var variant = node.varianty.find(function(v) { return v.id === varId; });
      state.selectedVariant = variant;
      state.pathway.push({ nodeId: node.id, variant: variant });
      state.step = 'feedback';
      render();
    }

    function nextStage() {
      if (state.selectedVariant && state.selectedVariant.nastupnyi_vuzol) {
        state.currentNodeId = state.selectedVariant.nastupnyi_vuzol;
        state.step = 'node';
      } else {
        state.step = 'reflection';
      }
      render();
    }

    function restart() {
      state.step = 'briefing';
      state.currentNodeId = scenario.pochatkovyi_vuzol;
      state.pathway = [];
      state.selectedVariant = null;
      render();
    }
  </script>
</body>
</html>`;
}
